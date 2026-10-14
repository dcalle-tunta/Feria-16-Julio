import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from '../../common/http/api-error.response';
import { NegocioDiaAtencion } from '../businesses/entities/negocio-dia-atencion.entity';
import { Negocio } from '../businesses/entities/negocio.entity';
import {
  toAdminVendor,
  totalPages,
  type AdminVendor,
  type AdminVendorPage,
} from './admin-vendor.view';
import { ListAdminVendorsQuery } from './dto/list-admin-vendors.query';
import { UpdateVendorStatusDto } from './dto/update-vendor-status.dto';
import {
  INVALID_STATUS_TRANSITION_CODE,
  INVALID_STATUS_TRANSITION_MESSAGE,
  planVendorStatusChange,
  rejectionReasonError,
  VENDOR_NOT_FOUND_CODE,
  VENDOR_NOT_FOUND_MESSAGE,
} from './vendor-status.rules';

@Injectable()
export class AdminVendorsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(query: ListAdminVendorsQuery): Promise<AdminVendorPage> {
    const qb = this.dataSource
      .getRepository(Negocio)
      .createQueryBuilder('negocio')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .orderBy('negocio.fecha_registro', 'DESC')
      .addOrderBy('negocio.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.status) {
      qb.andWhere('negocio.estado = :estado', { estado: query.status });
    }

    const [rows, totalResults] = await qb.getManyAndCount();
    await this.attachOpeningDays(this.dataSource.manager, rows);

    return {
      totalResults,
      page: query.page,
      limit: query.limit,
      totalPages: totalPages(totalResults, query.limit),
      data: rows.map((row) => toAdminVendor(row)),
    };
  }

  async updateStatus(
    vendorId: number,
    staffId: number,
    dto: UpdateVendorStatusDto,
  ): Promise<AdminVendor> {
    const reasonError = rejectionReasonError(dto.status, dto.rejection_reason);
    if (reasonError) {
      throw new BadRequestException({
        error: VALIDATION_ERROR_CODE,
        message: VALIDATION_ERROR_MESSAGE,
        details: [{ field: 'rejection_reason', message: reasonError }],
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const negocio = await manager
        .getRepository(Negocio)
        .createQueryBuilder('negocio')
        .setLock('pessimistic_write')
        .where('negocio.id = :id', { id: vendorId })
        .getOne();

      if (!negocio) {
        throw new NotFoundException({
          error: VENDOR_NOT_FOUND_CODE,
          message: VENDOR_NOT_FOUND_MESSAGE,
        });
      }

      const next = planVendorStatusChange(
        {
          estado: negocio.estado,
          motivo_rechazo: negocio.motivo_rechazo,
          aprobado_por_id: negocio.aprobado_por_id,
          fecha_aprobacion: negocio.fecha_aprobacion,
        },
        {
          nextStatus: dto.status,
          rejectionReason: dto.rejection_reason,
          staffId,
          now: new Date(),
        },
      );

      if (!next) {
        throw new ConflictException({
          error: INVALID_STATUS_TRANSITION_CODE,
          message: INVALID_STATUS_TRANSITION_MESSAGE,
        });
      }

      await manager.update(Negocio, { id: vendorId }, next);
      const updated = await this.loadVendor(manager, vendorId);
      return toAdminVendor(updated);
    });
  }

  private async loadVendor(
    manager: EntityManager,
    vendorId: number,
  ): Promise<Negocio> {
    const negocio = await manager
      .getRepository(Negocio)
      .createQueryBuilder('negocio')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .where('negocio.id = :id', { id: vendorId })
      .getOne();

    if (!negocio) {
      throw new NotFoundException({
        error: VENDOR_NOT_FOUND_CODE,
        message: VENDOR_NOT_FOUND_MESSAGE,
      });
    }

    await this.attachOpeningDays(manager, [negocio]);
    return negocio;
  }

  private async attachOpeningDays(
    manager: EntityManager,
    negocios: Negocio[],
  ): Promise<void> {
    if (negocios.length === 0) {
      return;
    }

    const rows = await manager.getRepository(NegocioDiaAtencion).find({
      where: { negocio_id: In(negocios.map((negocio) => negocio.id)) },
      relations: { dia: true },
    });
    const byVendor = new Map<number, NegocioDiaAtencion[]>();

    for (const row of rows) {
      const current = byVendor.get(row.negocio_id) ?? [];
      current.push(row);
      byVendor.set(row.negocio_id, current);
    }

    for (const negocio of negocios) {
      negocio.dias_atencion = byVendor.get(negocio.id) ?? [];
    }
  }
}
