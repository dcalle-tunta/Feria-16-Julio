export enum RolBackoffice {
  ADMIN = 'ADMIN',
  OPERADOR = 'OPERADOR',
}

export enum EstadoNegocio {
  PENDIENTE_VALIDACION = 'PENDIENTE_VALIDACION',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  SUSPENDIDO = 'SUSPENDIDO',
}

export enum Moneda {
  BOB = 'BOB',
  USD = 'USD',
}

export enum TipoProducto {
  PRODUCTO = 'PRODUCTO',
  SERVICIO = 'SERVICIO',
}

export enum EstadoDisponibilidad {
  DISPONIBLE = 'DISPONIBLE',
  AGOTADO = 'AGOTADO',
}

export const CODIGOS_DIA_ATENCION = ['JUEVES', 'DOMINGO', 'OTROS'] as const;

export type CodigoDiaAtencion = (typeof CODIGOS_DIA_ATENCION)[number];
