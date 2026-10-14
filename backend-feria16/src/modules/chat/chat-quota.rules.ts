export const CHAT_SETTING_DEFAULTS = {
  maxConsultasSesion: 20,
  tiempoBloqueoMinutos: 60,
  maxNegociosSugeridos: 5,
} as const;

export const CHAT_SETTING_KEYS = {
  maxConsultasSesion: 'MAX_CONSULTAS_SESION',
  tiempoBloqueoMinutos: 'TIEMPO_BLOQUEO_MINUTOS',
  maxNegociosSugeridos: 'MAX_NEGOCIOS_SUGERIDOS',
} as const;

export const RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED';
export const RATE_LIMIT_MESSAGE =
  'Se alcanzó el límite de usos, por favor espere antes de intentar nuevamente.';

export const INVALID_CATEGORY = 'INVALID_CATEGORY';
export const INVALID_CATEGORY_MESSAGE =
  'La categoría seleccionada no existe o no está activa.';

export interface ChatSettings {
  maxConsultasSesion: number;
  tiempoBloqueoMinutos: number;
  maxNegociosSugeridos: number;
}

export interface ChatSettingRow {
  clave: string;
  valor: string;
}

export type ChatQuotaDecision =
  | { kind: 'allow'; reset: boolean }
  | {
      kind: 'reject';
      retryAfterSeconds: number;
      bloqueadoHasta: Date;
      persistBlock: boolean;
    };

export function resolveChatSettings(rows: readonly ChatSettingRow[]): ChatSettings {
  const values = new Map(rows.map((row) => [row.clave, row.valor]));

  return {
    maxConsultasSesion: readSetting(
      values.get(CHAT_SETTING_KEYS.maxConsultasSesion),
      CHAT_SETTING_DEFAULTS.maxConsultasSesion,
    ),
    tiempoBloqueoMinutos: readSetting(
      values.get(CHAT_SETTING_KEYS.tiempoBloqueoMinutos),
      CHAT_SETTING_DEFAULTS.tiempoBloqueoMinutos,
    ),
    maxNegociosSugeridos: readSetting(
      values.get(CHAT_SETTING_KEYS.maxNegociosSugeridos),
      CHAT_SETTING_DEFAULTS.maxNegociosSugeridos,
    ),
  };
}

export function evaluateChatQuota(input: {
  consultasRealizadas: number;
  bloqueadoHasta: Date | null;
  maxConsultas: number;
  bloqueoMinutos: number;
  now: Date;
}): ChatQuotaDecision {
  const blockedUntil = input.bloqueadoHasta;

  if (blockedUntil && blockedUntil.getTime() > input.now.getTime()) {
    return {
      kind: 'reject',
      retryAfterSeconds: secondsUntil(blockedUntil, input.now),
      bloqueadoHasta: blockedUntil,
      persistBlock: false,
    };
  }

  const reset = blockedUntil !== null;
  const consultasRealizadas = reset ? 0 : input.consultasRealizadas;

  if (consultasRealizadas >= input.maxConsultas) {
    return {
      kind: 'reject',
      retryAfterSeconds: input.bloqueoMinutos * 60,
      bloqueadoHasta: new Date(
        input.now.getTime() + input.bloqueoMinutos * 60_000,
      ),
      persistBlock: true,
    };
  }

  return { kind: 'allow', reset };
}

export function countAfterProcessedPrompt(consultasRealizadas: number): number {
  return consultasRealizadas + 1;
}

function readSetting(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return fallback;
  }

  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : fallback;
}

function secondsUntil(until: Date, now: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}
