import type { Request } from 'express';
import { EstadoNegocio, RolBackoffice } from '../../common/enums/domain.enums';

export enum AuthRole {
  VENDOR = 'VENDOR',
  ADMIN = 'ADMIN',
  OPERADOR = 'OPERADOR',
}

export interface AuthTokenPayload {
  sub: number;
  role: AuthRole;
}

export interface VendorLoginUser {
  id: number;
  name: string;
  status: EstadoNegocio;
  role: AuthRole.VENDOR;
}

export interface AdminLoginUser {
  id: number;
  name: string;
  role: AuthRole.ADMIN | AuthRole.OPERADOR;
}

export interface AuthenticatedVendor {
  id: number;
  role: AuthRole.VENDOR;
  name: string;
  status: EstadoNegocio;
}

export interface AuthenticatedStaff {
  id: number;
  role: AuthRole.ADMIN | AuthRole.OPERADOR;
  name: string;
}

export type AuthenticatedPrincipal = AuthenticatedVendor | AuthenticatedStaff;

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

export function readAuthTokenPayload(value: unknown): AuthTokenPayload | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as { sub?: unknown; role?: unknown };
  const sub =
    typeof candidate.sub === 'number' ? candidate.sub : Number(candidate.sub);

  if (!Number.isInteger(sub) || sub < 1) {
    return null;
  }

  if (
    candidate.role !== AuthRole.VENDOR &&
    candidate.role !== AuthRole.ADMIN &&
    candidate.role !== AuthRole.OPERADOR
  ) {
    return null;
  }

  return { sub, role: candidate.role };
}

export function staffAuthRole(
  rol: RolBackoffice,
): AuthRole.ADMIN | AuthRole.OPERADOR {
  return rol === RolBackoffice.ADMIN ? AuthRole.ADMIN : AuthRole.OPERADOR;
}
