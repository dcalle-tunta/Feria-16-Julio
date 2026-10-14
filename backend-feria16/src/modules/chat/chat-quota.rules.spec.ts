import {
  CHAT_SETTING_DEFAULTS,
  countAfterProcessedPrompt,
  evaluateChatQuota,
  resolveChatSettings,
} from './chat-quota.rules';

const NOW = new Date('2026-10-14T16:00:00.000Z');

describe('resolveChatSettings', () => {
  it('usa 20, 60 y 5 cuando falta una fila o el valor no es entero', () => {
    expect(resolveChatSettings([])).toEqual(CHAT_SETTING_DEFAULTS);
    expect(
      resolveChatSettings([
        { clave: 'MAX_CONSULTAS_SESION', valor: '8' },
        { clave: 'TIEMPO_BLOQUEO_MINUTOS', valor: 'no-numero' },
      ]),
    ).toEqual({
      maxConsultasSesion: 8,
      tiempoBloqueoMinutos: 60,
      maxNegociosSugeridos: 5,
    });
  });
});

describe('evaluateChatQuota', () => {
  const base = {
    maxConsultas: 20,
    bloqueoMinutos: 60,
    now: NOW,
  };

  it('deja pasar y no reinicia cuando no hay bloqueo y queda cupo', () => {
    expect(
      evaluateChatQuota({
        ...base,
        consultasRealizadas: 19,
        bloqueadoHasta: null,
      }),
    ).toEqual({ kind: 'allow', reset: false });
  });

  it('al llegar al máximo, la siguiente petición abre el bloqueo sin sumar consultas', () => {
    expect(
      evaluateChatQuota({
        ...base,
        consultasRealizadas: 20,
        bloqueadoHasta: null,
      }),
    ).toEqual({
      kind: 'reject',
      retryAfterSeconds: 3600,
      bloqueadoHasta: new Date('2026-10-14T17:00:00.000Z'),
      persistBlock: true,
    });
  });

  it('si el bloqueo sigue vigente, responde 429 y no cambia el contador', () => {
    const bloqueadoHasta = new Date('2026-10-14T16:30:00.000Z');
    expect(
      evaluateChatQuota({
        ...base,
        consultasRealizadas: 20,
        bloqueadoHasta,
      }),
    ).toEqual({
      kind: 'reject',
      retryAfterSeconds: 1800,
      bloqueadoHasta,
      persistBlock: false,
    });
  });

  it('redondea hacia arriba los segundos que faltan, con un mínimo de 1', () => {
    const decision = evaluateChatQuota({
      ...base,
      consultasRealizadas: 20,
      bloqueadoHasta: new Date(NOW.getTime() + 10),
    });

    expect(decision).toMatchObject({
      kind: 'reject',
      retryAfterSeconds: 1,
      persistBlock: false,
    });
  });

  it('si el bloqueo ya venció, la consulta vuelve a empezar en cero', () => {
    expect(
      evaluateChatQuota({
        ...base,
        consultasRealizadas: 20,
        bloqueadoHasta: new Date('2026-10-14T15:59:00.000Z'),
      }),
    ).toEqual({ kind: 'allow', reset: true });

    expect(
      evaluateChatQuota({
        ...base,
        consultasRealizadas: 20,
        bloqueadoHasta: NOW,
      }),
    ).toEqual({ kind: 'allow', reset: true });
  });
});

describe('countAfterProcessedPrompt', () => {
  it('suma una consulta procesada', () => {
    expect(countAfterProcessedPrompt(0)).toBe(1);
    expect(countAfterProcessedPrompt(19)).toBe(20);
  });
});
