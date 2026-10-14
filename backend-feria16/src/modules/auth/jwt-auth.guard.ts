import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService, UNAUTHORIZED_MESSAGE } from './auth.service';
import type { AuthenticatedRequest, AuthRole } from './auth-token';
import { ROLES_KEY } from './roles.decorator';

export const FORBIDDEN_ROLE_MESSAGE =
  'No tienes permiso para realizar esta acción.';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.headers.authorization);

    if (!token) {
      throw unauthorized();
    }

    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw unauthorized();
    }

    const principal =
      await this.authService.loadAuthenticatedPrincipal(payload);
    const requiredRoles = this.reflector.getAllAndOverride<AuthRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles?.length && !requiredRoles.includes(principal.role)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: FORBIDDEN_ROLE_MESSAGE,
      });
    }

    request.user = principal;
    return true;
  }
}

function bearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) {
    return null;
  }

  const token = value.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function unauthorized(): UnauthorizedException {
  return new UnauthorizedException({
    error: 'UNAUTHORIZED',
    message: UNAUTHORIZED_MESSAGE,
  });
}
