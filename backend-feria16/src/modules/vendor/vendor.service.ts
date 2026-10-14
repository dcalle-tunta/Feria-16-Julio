import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  type QueryDeepPartialEntity,
} from 'typeorm';
import {
  EstadoDisponibilidad,
  Moneda,
  TipoProducto,
  type CodigoDiaAtencion,
} from '../../common/enums/domain.enums';
import {
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from '../../common/http/api-error.response';
import {
  hashPassword,
  verifyPassword,
} from '../../common/security/password.util';
import {
  DUPLICATE_CONTACT_CODE,
  DUPLICATE_CONTACT_MESSAGE,
  UNAUTHORIZED_MESSAGE,
} from '../auth/auth.service';
import { NegocioDiaAtencion } from '../businesses/entities/negocio-dia-atencion.entity';
import { Negocio } from '../businesses/entities/negocio.entity';
import { ProductoImagen } from '../products/entities/producto-imagen.entity';
import { ProductoServicio } from '../products/entities/producto-servicio.entity';
import { DiaSemana } from '../system/entities/dia-semana.entity';
import { CreateVendorProductDto } from './dto/create-vendor-product.dto';
import { UpdateVendorProductDto } from './dto/update-vendor-product.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import {
  CURRENT_PASSWORD_MISMATCH,
  passwordChangeFieldErrors,
  toVendorProduct,
  toVendorProfile,
  type VendorProductItem,
  type VendorProfile,
} from './vendor-profile';

const OPENING_DAYS_MESSAGE = 'Selecciona días de apertura válidos.';
const PRODUCT_NOT_FOUND_CODE = 'PRODUCT_NOT_FOUND';
const PRODUCT_NOT_FOUND_MESSAGE =
  'El producto no existe o no está disponible.';

@Injectable()
export class VendorService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getProfile(vendorId: number): Promise<VendorProfile> {
    const negocio = await this.loadNegocio(
      this.dataSource.manager,
      vendorId,
      false,
    );
    return toVendorProfile(negocio);
  }

  async updateProfile(
    vendorId: number,
    dto: UpdateVendorProfileDto,
  ): Promise<VendorProfile> {
    const details = passwordChangeFieldErrors(dto);
    if (details.length > 0) {
      throw new BadRequestException({
        error: VALIDATION_ERROR_CODE,
        message: VALIDATION_ERROR_MESSAGE,
        details,
      });
    }

    try {
      return await this.dataSource.transaction((manager) =>
        this.applyUpdate(manager, vendorId, dto),
      );
    } catch (error) {
      if (isDuplicateContact(error)) {
        throw duplicateContactException();
      }

      throw error;
    }
  }

  async listProducts(vendorId: number): Promise<{ data: VendorProductItem[] }> {
    const rows = await this.dataSource.getRepository(ProductoServicio).find({
      where: { negocio_id: vendorId },
      relations: { imagenes: true },
      order: { creado_en: 'DESC', id: 'DESC' },
    });

    return { data: rows.map((product) => toVendorProduct(product)) };
  }

  async createProduct(
    vendorId: number,
    dto: CreateVendorProductDto,
  ): Promise<VendorProductItem> {
    return this.dataSource.transaction(async (manager) => {
      const products = manager.getRepository(ProductoServicio);
      const saved = await products.save(
        products.create({
          negocio_id: vendorId,
          titulo: dto.title,
          descripcion: dto.description ?? null,
          precio: formatPrice(dto.price),
          moneda: dto.currency ?? Moneda.BOB,
          tipo: dto.type ?? TipoProducto.PRODUCTO,
          estado_disponibilidad:
            dto.availability_status ?? EstadoDisponibilidad.DISPONIBLE,
          activo: true,
        }),
      );

      if (dto.image_urls && dto.image_urls.length > 0) {
        await this.replaceImages(manager, saved.id, dto.image_urls);
      }

      const created = await this.loadOwnProduct(manager, vendorId, saved.id);
      return toVendorProduct(created);
    });
  }

  async updateProduct(
    vendorId: number,
    productId: number,
    dto: UpdateVendorProductDto,
  ): Promise<VendorProductItem> {
    return this.dataSource.transaction(async (manager) => {
      await this.loadOwnProduct(manager, vendorId, productId);
      const patch = productPatch(dto);

      if (Object.keys(patch).length > 0) {
        await manager
          .getRepository(ProductoServicio)
          .update({ id: productId }, patch);
      }

      if (dto.image_urls !== undefined) {
        await this.replaceImages(manager, productId, dto.image_urls);
      }

      const updated = await this.loadOwnProduct(manager, vendorId, productId);
      return toVendorProduct(updated);
    });
  }

  async deactivateProduct(
    vendorId: number,
    productId: number,
  ): Promise<VendorProductItem> {
    return this.dataSource.transaction(async (manager) => {
      await this.loadOwnProduct(manager, vendorId, productId);
      await manager
        .getRepository(ProductoServicio)
        .update({ id: productId }, { activo: false });
      const updated = await this.loadOwnProduct(manager, vendorId, productId);
      return toVendorProduct(updated);
    });
  }

  private async applyUpdate(
    manager: EntityManager,
    vendorId: number,
    dto: UpdateVendorProfileDto,
  ): Promise<VendorProfile> {
    const currentPassword = dto.current_password;
    const newPassword = dto.new_password;
    const changingPassword =
      currentPassword !== undefined && newPassword !== undefined;
    const negocio = await this.loadNegocio(manager, vendorId, changingPassword);

    if (changingPassword) {
      const matches = await verifyPassword(
        currentPassword,
        negocio.password_hash,
      );
      if (!matches) {
        throw new BadRequestException({
          error: VALIDATION_ERROR_CODE,
          message: VALIDATION_ERROR_MESSAGE,
          details: [
            { field: 'current_password', message: CURRENT_PASSWORD_MISMATCH },
          ],
        });
      }
    }

    await this.assertContactAvailable(manager, vendorId, dto);
    const dias = dto.opening_days
      ? await this.resolveOpeningDays(manager, dto.opening_days)
      : null;
    let passwordHash: string | undefined;
    if (changingPassword) {
      passwordHash = await hashPassword(newPassword);
    }
    const patch = profilePatch(dto, passwordHash);

    if (Object.keys(patch).length > 0) {
      await manager.getRepository(Negocio).update({ id: vendorId }, patch);
    }

    if (dias) {
      const atenciones = manager.getRepository(NegocioDiaAtencion);
      await atenciones.delete({ negocio_id: vendorId });
      await atenciones.save(
        dias.map((dia) =>
          atenciones.create({
            negocio_id: vendorId,
            dia_id: dia.id,
          }),
        ),
      );
    }

    const updated = await this.loadNegocio(manager, vendorId, false);
    return toVendorProfile(updated);
  }

  private async loadNegocio(
    manager: EntityManager,
    vendorId: number,
    withPassword: boolean,
  ): Promise<Negocio> {
    const query = manager
      .getRepository(Negocio)
      .createQueryBuilder('negocio')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .leftJoinAndSelect('negocio.dias_atencion', 'atencion')
      .leftJoinAndSelect('atencion.dia', 'dia')
      .where('negocio.id = :id', { id: vendorId });

    if (withPassword) {
      query.addSelect('negocio.password_hash');
    }

    const negocio = await query.getOne();
    if (!negocio) {
      throw unauthorized();
    }

    return negocio;
  }

  private async assertContactAvailable(
    manager: EntityManager,
    vendorId: number,
    dto: UpdateVendorProfileDto,
  ): Promise<void> {
    const negocios = manager.getRepository(Negocio);

    if (dto.phone !== undefined) {
      const taken = await negocios.findOne({
        where: { whatsapp: dto.phone },
        select: { id: true },
      });
      if (taken && taken.id !== vendorId) {
        throw duplicateContactException();
      }
    }

    if (dto.email) {
      const taken = await negocios.findOne({
        where: { email: dto.email },
        select: { id: true },
      });
      if (taken && taken.id !== vendorId) {
        throw duplicateContactException();
      }
    }
  }

  private async resolveOpeningDays(
    manager: EntityManager,
    codes: readonly CodigoDiaAtencion[],
  ): Promise<DiaSemana[]> {
    const unique = [...new Set(codes)];
    const dias = await manager.getRepository(DiaSemana).find({
      where: { codigo: In(unique) },
      select: { id: true, codigo: true, nombre: true },
    });

    if (unique.length === 0 || dias.length !== unique.length) {
      throw new BadRequestException({
        error: VALIDATION_ERROR_CODE,
        message: VALIDATION_ERROR_MESSAGE,
        details: [{ field: 'opening_days', message: OPENING_DAYS_MESSAGE }],
      });
    }

    return dias;
  }

  private async loadOwnProduct(
    manager: EntityManager,
    vendorId: number,
    productId: number,
  ): Promise<ProductoServicio> {
    const product = await manager.getRepository(ProductoServicio).findOne({
      where: { id: productId, negocio_id: vendorId },
      relations: { imagenes: true },
    });

    if (!product) {
      throw new NotFoundException({
        error: PRODUCT_NOT_FOUND_CODE,
        message: PRODUCT_NOT_FOUND_MESSAGE,
      });
    }

    return product;
  }

  private async replaceImages(
    manager: EntityManager,
    productId: number,
    urls: readonly string[],
  ): Promise<void> {
    const images = manager.getRepository(ProductoImagen);
    await images.delete({ producto_id: productId });

    if (urls.length === 0) {
      return;
    }

    await images.save(
      urls.map((url, index) =>
        images.create({
          producto_id: productId,
          imagen_url: url,
          orden: index + 1,
        }),
      ),
    );
  }
}

function formatPrice(price: number): string {
  return price.toFixed(2);
}

function productPatch(
  dto: UpdateVendorProductDto,
): QueryDeepPartialEntity<ProductoServicio> {
  const patch: QueryDeepPartialEntity<ProductoServicio> = {};

  if (dto.title !== undefined) {
    patch.titulo = dto.title;
  }
  if (dto.description !== undefined) {
    patch.descripcion = dto.description;
  }
  if (dto.price !== undefined) {
    patch.precio = formatPrice(dto.price);
  }
  if (dto.currency !== undefined) {
    patch.moneda = dto.currency;
  }
  if (dto.type !== undefined) {
    patch.tipo = dto.type;
  }
  if (dto.availability_status !== undefined) {
    patch.estado_disponibilidad = dto.availability_status;
  }

  return patch;
}

function profilePatch(
  dto: UpdateVendorProfileDto,
  passwordHash: string | undefined,
): QueryDeepPartialEntity<Negocio> {
  const patch: QueryDeepPartialEntity<Negocio> = {};

  if (dto.short_description !== undefined) {
    patch.descripcion_corta = dto.short_description;
  }
  if (dto.logo_url !== undefined) {
    patch.logo_url = dto.logo_url;
  }
  if (dto.phone !== undefined) {
    patch.whatsapp = dto.phone;
  }
  if (dto.email !== undefined) {
    patch.email = dto.email;
  }
  if (dto.sector !== undefined) {
    patch.sector = dto.sector;
  }
  if (dto.aisle_number !== undefined) {
    patch.pasillo_puesto = dto.aisle_number;
  }
  if (dto.latitude !== undefined) {
    patch.latitud = dto.latitude.toFixed(8);
  }
  if (dto.longitude !== undefined) {
    patch.longitud = dto.longitude.toFixed(8);
  }
  if (passwordHash !== undefined) {
    patch.password_hash = passwordHash;
  }

  return patch;
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
