import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CODIGOS_DIA_ATENCION } from '../../common/enums/domain.enums';
import { Categoria } from '../system/entities/categoria.entity';
import { DiaSemana } from '../system/entities/dia-semana.entity';

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
}

export interface OpeningDayItem {
  code: string;
  name: string;
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(DiaSemana)
    private readonly dias: Repository<DiaSemana>,
  ) {}

  async listCategories(): Promise<{ data: CategoryItem[] }> {
    const rows = await this.categorias.find({
      where: { activo: true },
      select: { id: true, nombre: true, slug: true },
      order: { id: 'ASC' },
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        name: row.nombre,
        slug: row.slug,
      })),
    };
  }

  async listOpeningDays(): Promise<{ data: OpeningDayItem[] }> {
    const rows = await this.dias.find({
      where: { codigo: In([...CODIGOS_DIA_ATENCION]) },
      select: { id: true, codigo: true, nombre: true },
      order: { id: 'ASC' },
    });

    return {
      data: rows.map((row) => ({
        code: row.codigo,
        name: row.nombre,
      })),
    };
  }
}
