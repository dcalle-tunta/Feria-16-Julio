import { EstadoNegocio } from '../../common/enums/domain.enums';

export const INVALID_STATUS_TRANSITION_CODE = 'INVALID_STATUS_TRANSITION';
export const INVALID_STATUS_TRANSITION_MESSAGE =
  'La transición de estado no está permitida.';

export const VENDOR_NOT_FOUND_CODE = 'VENDOR_NOT_FOUND';
export const VENDOR_NOT_FOUND_MESSAGE = 'El puesto no existe.';

export const REJECTION_REASON_REQUIRED =
  'El motivo de rechazo es obligatorio.';
export const REJECTION_REASON_LENGTH =
  'El motivo de rechazo debe tener entre 3 y 255 caracteres.';

const ALLOWED_TRANSITIONS: Record<EstadoNegocio, readonly EstadoNegocio[]> = {
  [EstadoNegocio.PENDIENTE_VALIDACION]: [
    EstadoNegocio.APROBADO,
    EstadoNegocio.RECHAZADO,
  ],
  [EstadoNegocio.RECHAZADO]: [EstadoNegocio.PENDIENTE_VALIDACION],
  [EstadoNegocio.APROBADO]: [EstadoNegocio.SUSPENDIDO],
  [EstadoNegocio.SUSPENDIDO]: [EstadoNegocio.APROBADO],
};

export interface VendorStatusSnapshot {
  estado: EstadoNegocio;
  motivo_rechazo: string | null;
  aprobado_por_id: number | null;
  fecha_aprobacion: Date | null;
}

export interface VendorStatusChange {
  nextStatus: EstadoNegocio;
  rejectionReason?: string;
  staffId: number;
  now: Date;
}

export function rejectionReasonError(
  status: EstadoNegocio,
  rejectionReason: string | undefined,
): string | null {
  if (status !== EstadoNegocio.RECHAZADO) {
    return null;
  }

  if (!rejectionReason) {
    return REJECTION_REASON_REQUIRED;
  }

  if (rejectionReason.length < 3 || rejectionReason.length > 255) {
    return REJECTION_REASON_LENGTH;
  }

  return null;
}

export function planVendorStatusChange(
  current: VendorStatusSnapshot,
  change: VendorStatusChange,
): VendorStatusSnapshot | null {
  const allowed = ALLOWED_TRANSITIONS[current.estado];
  if (!allowed.includes(change.nextStatus)) {
    return null;
  }

  const next: VendorStatusSnapshot = {
    estado: change.nextStatus,
    motivo_rechazo: current.motivo_rechazo,
    aprobado_por_id: current.aprobado_por_id,
    fecha_aprobacion: current.fecha_aprobacion,
  };

  if (
    current.estado === EstadoNegocio.RECHAZADO &&
    change.nextStatus === EstadoNegocio.PENDIENTE_VALIDACION
  ) {
    next.motivo_rechazo = null;
  }

  if (change.nextStatus === EstadoNegocio.RECHAZADO) {
    next.motivo_rechazo = change.rejectionReason ?? null;
  }

  if (
    change.nextStatus === EstadoNegocio.APROBADO &&
    current.fecha_aprobacion === null
  ) {
    next.aprobado_por_id = change.staffId;
    next.fecha_aprobacion = change.now;
  }

  return next;
}
