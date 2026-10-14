import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  QueryFailedError,
} from 'typeorm';
import { EstadoNegocio } from '../../common/enums/domain.enums';
import {
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
  type ApiFieldError,
} from '../../common/http/api-error.response';
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
} from '../../common/security/password.util';
import { NegocioDiaAtencion } from '../businesses/entities/negocio-dia-atencion.entity';
import { Negocio } from '../businesses/entities/negocio.entity';
import { Categoria } from '../system/entities/categoria.entity';
import { DiaSemana } from '../system/entities/dia-semana.entity';
import {
  AuthRole,
  readAuthTokenPayload,
  staffAuthRole,
  type AdminLoginUser,
  type AuthenticatedPrincipal,
  type VendorLoginUser,
} from './auth-token';
import { LoginAdminDto } from './dto/login-admin.dto';
import { BOLIVIAN_WHATSAPP, LoginVendorDto } from './dto/login-vendor.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { UsuarioBackoffice } from './entities/usuario-backoffice.entity';

export const DUPLICATE_CONTACT_CODE = 'DUPLICATE_CONTACT';
export const DUPLICATE_CONTACT_MESSAGE =
  'El número de WhatsApp o correo ingresado ya se encuentra registrado.';
export const REGISTER_SUCCESS_MESSAGE =
  '¡Registro Recibido! Tu puesto ha sido enviado a validación con éxito.';

export const INVALID_CREDENTIALS_CODE = 'INVALID_CREDENTIALS';
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas.';
export const ACCOUNT_PENDING_APPROVAL = 'ACCOUNT_PENDING_APPROVAL';
export const ACCOUNT_PENDING_MESSAGE =
  'Tu registro se encuentra en proceso de revisión por nuestro equipo. Te notificaremos por WhatsApp en un máximo de 24 horas hábiles.';
export const ACCOUNT_REJECTED = 'ACCOUNT_REJECTED';
export const ACCOUNT_REJECTED_MESSAGE = 'Tu registro fue rechazado.';
export const ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED';
export const ACCOUNT_SUSPENDED_MESSAGE =
  'Tu cuenta se encuentra suspendida.';
export const UNAUTHORIZED_MESSAGE = 'No autorizado.';

export interface VendorLoginResponse {
  access_token: string;
  token_type: 'Bearer';
  user: VendorLoginUser;
}

export interface AdminLoginResponse {
  access_token: string;
  token_type: 'Bearer';
  user: AdminLoginUser;
}

const CATEGORY_MESSAGE =
  'La categoría seleccionada no existe o no está activa.';
const OPENING_DAYS_MESSAGE = 'Selecciona días de apertura válidos.';

export interface RegisterVendorResponse {
  id: number;
  status: EstadoNegocio;
  message: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterVendorDto): Promise<RegisterVendorResponse> {
    const dias = await this.assertReferences(this.dataSource.manager, dto);
    await this.assertContactAvailable(this.dataSource.manager, dto);
    const passwordHash = await hashPassword(dto.password);

    try {
      const saved = await this.dataSource.transaction((manager) =>
        this.insertVendor(manager, dto, passwordHash, dias),
      );

      return {
        id: saved.id,
        status: EstadoNegocio.PENDIENTE_VALIDACION,
        message: REGISTER_SUCCESS_MESSAGE,
      };
    } catch (error) {
      if (isDuplicateContact(error)) {
        throw duplicateContactException();
      }

      throw error;
    }
  }

  async loginVendor(dto: LoginVendorDto): Promise<VendorLoginResponse> {
    const column = BOLIVIAN_WHATSAPP.test(dto.login_identifier)
      ? 'whatsapp'
      : 'email';
    const negocio = await this.dataSource
      .getRepository(Negocio)
      .createQueryBuilder('negocio')
      .addSelect('negocio.password_hash')
      .where(`negocio.${column} = :identifier`, {
        identifier: dto.login_identifier,
      })
      .getOne();
    const passwordMatches = await this.passwordMatches(
      dto.password,
      negocio?.password_hash,
    );

    if (!negocio || !passwordMatches) {
      throw invalidCredentials();
    }

    this.assertVendorApproved(negocio);
    return {
      access_token: this.signToken(negocio.id, AuthRole.VENDOR),
      token_type: 'Bearer',
      user: {
        id: negocio.id,
        name: negocio.nombre,
        status: negocio.estado,
        role: AuthRole.VENDOR,
      },
    };
  }

  async loginAdmin(dto: LoginAdminDto): Promise<AdminLoginResponse> {
    const usuario = await this.dataSource
      .getRepository(UsuarioBackoffice)
      .createQueryBuilder('usuario')
      .addSelect('usuario.password_hash')
      .where('usuario.email = :email', { email: dto.email })
      .getOne();
    const passwordMatches = await this.passwordMatches(
      dto.password,
      usuario?.password_hash,
    );

    if (!usuario || !passwordMatches) {
      throw invalidCredentials();
    }

    const role = staffAuthRole(usuario.rol);
    return {
      access_token: this.signToken(usuario.id, role),
      token_type: 'Bearer',
      user: {
        id: usuario.id,
        name: usuario.nombre,
        role,
      },
    };
  }

  async loadAuthenticatedPrincipal(
    token: unknown,
  ): Promise<AuthenticatedPrincipal> {
    const payload = readAuthTokenPayload(token);
    if (!payload) {
      throw unauthorized();
    }

    if (payload.role === AuthRole.VENDOR) {
      const negocio = await this.dataSource.getRepository(Negocio).findOne({
        where: { id: payload.sub },
        select: {
          id: true,
          nombre: true,
          estado: true,
          motivo_rechazo: true,
        },
      });

      if (!negocio) {
        throw unauthorized();
      }

      this.assertVendorApproved(negocio);
      return {
        id: negocio.id,
        role: AuthRole.VENDOR,
        name: negocio.nombre,
        status: negocio.estado,
      };
    }

    const usuario = await this.dataSource
      .getRepository(UsuarioBackoffice)
      .findOne({
        where: { id: payload.sub },
        select: { id: true, nombre: true, rol: true },
      });

    if (!usuario || staffAuthRole(usuario.rol) !== payload.role) {
      throw unauthorized();
    }

    return {
      id: usuario.id,
      role: staffAuthRole(usuario.rol),
      name: usuario.nombre,
    };
  }

  private signToken(sub: number, role: AuthRole): string {
    return this.jwtService.sign({ sub, role });
  }

  private async passwordMatches(
    plain: string,
    hash: string | null | undefined,
  ): Promise<boolean> {
    const comparisonHash = hash ?? (await dummyPasswordHash());
    const matches = await verifyPassword(plain, comparisonHash);
    return Boolean(hash) && matches;
  }

  private assertVendorApproved(
    negocio: Pick<Negocio, 'estado' | 'motivo_rechazo'>,
  ): void {
    switch (negocio.estado) {
      case EstadoNegocio.APROBADO:
        return;
      case EstadoNegocio.PENDIENTE_VALIDACION:
        throw new ForbiddenException({
          error: ACCOUNT_PENDING_APPROVAL,
          message: ACCOUNT_PENDING_MESSAGE,
        });
      case EstadoNegocio.RECHAZADO:
        throw new ForbiddenException({
          error: ACCOUNT_REJECTED,
          message: ACCOUNT_REJECTED_MESSAGE,
          rejection_reason: negocio.motivo_rechazo,
        });
      case EstadoNegocio.SUSPENDIDO:
        throw new ForbiddenException({
          error: ACCOUNT_SUSPENDED,
          message: ACCOUNT_SUSPENDED_MESSAGE,
        });
      default: {
        const unhandled: never = negocio.estado;
        void unhandled;
        throw unauthorized();
      }
    }
  }

  private async assertReferences(
    manager: EntityManager,
    dto: RegisterVendorDto,
  ): Promise<DiaSemana[]> {
    const details: ApiFieldError[] = [];
    const categoria = await manager.findOne(Categoria, {
      where: { id: dto.category_id, activo: true },
      select: { id: true },
    });

    if (!categoria) {
      details.push({ field: 'category_id', message: CATEGORY_MESSAGE });
    }

    const codes = [...new Set(dto.opening_days)];
    const dias =
      codes.length === 0
        ? []
        : await manager.find(DiaSemana, {
            where: { codigo: In(codes) },
            select: { id: true, codigo: true },
          });

    if (codes.length === 0 || dias.length !== codes.length) {
      details.push({
        field: 'opening_days',
        message:
          codes.length === 0
            ? 'Debes seleccionar al menos un día de apertura.'
            : OPENING_DAYS_MESSAGE,
      });
    }

    if (details.length > 0) {
      throw new BadRequestException({
        error: VALIDATION_ERROR_CODE,
        message: VALIDATION_ERROR_MESSAGE,
        details,
      });
    }

    return dias;
  }

  private async assertContactAvailable(
    manager: EntityManager,
    dto: RegisterVendorDto,
  ): Promise<void> {
    const where: FindOptionsWhere<Negocio>[] = [{ whatsapp: dto.phone }];
    if (dto.email) {
      where.push({ email: dto.email });
    }

    const taken = await manager.findOne(Negocio, {
      where,
      select: { id: true },
    });

    if (taken) {
      throw duplicateContactException();
    }
  }

  private async insertVendor(
    manager: EntityManager,
    dto: RegisterVendorDto,
    passwordHash: string,
    dias: DiaSemana[],
  ): Promise<Negocio> {
    const negocio = manager.create(Negocio, {
      categoria_id: dto.category_id,
      nombre: dto.name,
      descripcion_corta: dto.short_description ?? null,
      logo_url: dto.logo_url ?? null,
      whatsapp: dto.phone,
      email: dto.email ?? null,
      password_hash: passwordHash,
      sector: dto.sector,
      pasillo_puesto: dto.aisle_number,
      latitud: dto.latitude.toFixed(8),
      longitud: dto.longitude.toFixed(8),
      terminos_aceptados: true,
      terminos_aceptados_en: new Date(),
      estado: EstadoNegocio.PENDIENTE_VALIDACION,
      motivo_rechazo: null,
      aprobado_por_id: null,
      fecha_aprobacion: null,
    });
    const saved = await manager.save(negocio);
    const atenciones = dias.map((dia) =>
      manager.create(NegocioDiaAtencion, {
        negocio_id: saved.id,
        dia_id: dia.id,
      }),
    );
    await manager.save(atenciones);
    return saved;
  }
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    error: INVALID_CREDENTIALS_CODE,
    message: INVALID_CREDENTIALS_MESSAGE,
  });
}

function unauthorized(): UnauthorizedException {
  return new UnauthorizedException({
    error: 'UNAUTHORIZED',
    message: UNAUTHORIZED_MESSAGE,
  });
}

function duplicateContactException(): ConflictException {
  return new ConflictException({
    error: DUPLICATE_CONTACT_CODE,
    message: DUPLICATE_CONTACT_MESSAGE,
  });
}

function isDuplicateContact(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string; errno?: number };
  return (
    driverError?.code === 'ER_DUP_ENTRY' ||
    driverError?.errno === 1062 ||
    error.message.includes('ER_DUP_ENTRY')
  );
}
