import { EstadoNegocio } from '../../common/enums/domain.enums';
import {
  planVendorStatusChange,
  rejectionReasonError,
  REJECTION_REASON_LENGTH,
  REJECTION_REASON_REQUIRED,
  type VendorStatusSnapshot,
} from './vendor-status.rules';

const NOW = new Date('2026-10-14T17:00:00.000Z');

function snapshot(
  partial: Partial<VendorStatusSnapshot> & Pick<VendorStatusSnapshot, 'estado'>,
): VendorStatusSnapshot {
  return {
    motivo_rechazo: null,
    aprobado_por_id: null,
    fecha_aprobacion: null,
    ...partial,
  };
}

describe('planVendorStatusChange', () => {
  it('aprueba por primera vez y guarda aprobador y fecha', () => {
    const next = planVendorStatusChange(
      snapshot({ estado: EstadoNegocio.PENDIENTE_VALIDACION }),
      {
        nextStatus: EstadoNegocio.APROBADO,
        staffId: 7,
        now: NOW,
      },
    );

    expect(next).toEqual({
      estado: EstadoNegocio.APROBADO,
      motivo_rechazo: null,
      aprobado_por_id: 7,
      fecha_aprobacion: NOW,
    });
  });

  it('rechaza un pendiente y guarda el motivo', () => {
    const next = planVendorStatusChange(
      snapshot({ estado: EstadoNegocio.PENDIENTE_VALIDACION }),
      {
        nextStatus: EstadoNegocio.RECHAZADO,
        rejectionReason: 'El puesto no coincide con el plano.',
        staffId: 7,
        now: NOW,
      },
    );

    expect(next?.estado).toBe(EstadoNegocio.RECHAZADO);
    expect(next?.motivo_rechazo).toBe('El puesto no coincide con el plano.');
    expect(next?.fecha_aprobacion).toBeNull();
  });

  it('reabre un rechazo, limpia el motivo y no aprueba', () => {
    const next = planVendorStatusChange(
      snapshot({
        estado: EstadoNegocio.RECHAZADO,
        motivo_rechazo: 'Datos incompletos.',
      }),
      {
        nextStatus: EstadoNegocio.PENDIENTE_VALIDACION,
        staffId: 7,
        now: NOW,
      },
    );

    expect(next).toEqual(
      snapshot({ estado: EstadoNegocio.PENDIENTE_VALIDACION }),
    );
  });

  it('suspende un aprobado sin tocar la fecha de aprobación', () => {
    const approvedAt = new Date('2026-01-02T00:00:00.000Z');
    const next = planVendorStatusChange(
      snapshot({
        estado: EstadoNegocio.APROBADO,
        aprobado_por_id: 3,
        fecha_aprobacion: approvedAt,
      }),
      {
        nextStatus: EstadoNegocio.SUSPENDIDO,
        staffId: 9,
        now: NOW,
      },
    );

    expect(next).toEqual(
      snapshot({
        estado: EstadoNegocio.SUSPENDIDO,
        aprobado_por_id: 3,
        fecha_aprobacion: approvedAt,
      }),
    );
  });

  it('reactiva un suspendido y conserva la primera aprobación', () => {
    const approvedAt = new Date('2026-01-02T00:00:00.000Z');
    const next = planVendorStatusChange(
      snapshot({
        estado: EstadoNegocio.SUSPENDIDO,
        aprobado_por_id: 3,
        fecha_aprobacion: approvedAt,
      }),
      {
        nextStatus: EstadoNegocio.APROBADO,
        staffId: 9,
        now: NOW,
      },
    );

    expect(next?.aprobado_por_id).toBe(3);
    expect(next?.fecha_aprobacion).toBe(approvedAt);
    expect(next?.estado).toBe(EstadoNegocio.APROBADO);
  });

  it('rechaza transiciones que no están en la máquina de estados', () => {
    const cases: Array<[EstadoNegocio, EstadoNegocio]> = [
      [EstadoNegocio.PENDIENTE_VALIDACION, EstadoNegocio.SUSPENDIDO],
      [EstadoNegocio.APROBADO, EstadoNegocio.RECHAZADO],
      [EstadoNegocio.APROBADO, EstadoNegocio.PENDIENTE_VALIDACION],
      [EstadoNegocio.RECHAZADO, EstadoNegocio.APROBADO],
      [EstadoNegocio.SUSPENDIDO, EstadoNegocio.RECHAZADO],
      [EstadoNegocio.APROBADO, EstadoNegocio.APROBADO],
    ];

    for (const [estado, nextStatus] of cases) {
      expect(
        planVendorStatusChange(snapshot({ estado }), {
          nextStatus,
          staffId: 1,
          now: NOW,
        }),
      ).toBeNull();
    }
  });
});

describe('rejectionReasonError', () => {
  it('exige el motivo solo al rechazar', () => {
    expect(rejectionReasonError(EstadoNegocio.RECHAZADO, undefined)).toBe(
      REJECTION_REASON_REQUIRED,
    );
    expect(rejectionReasonError(EstadoNegocio.RECHAZADO, 'no')).toBe(
      REJECTION_REASON_LENGTH,
    );
    expect(
      rejectionReasonError(EstadoNegocio.APROBADO, undefined),
    ).toBeNull();
    expect(
      rejectionReasonError(
        EstadoNegocio.RECHAZADO,
        'El número de puesto no coincide.',
      ),
    ).toBeNull();
  });
});
