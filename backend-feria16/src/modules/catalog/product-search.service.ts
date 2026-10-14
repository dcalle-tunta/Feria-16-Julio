import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EstadoNegocio } from '../../common/enums/domain.enums';
import { VALIDATION_ERROR_CODE } from '../../common/http/api-error.response';
import { ProductoServicio } from '../products/entities/producto-servicio.entity';
import { SearchProductsQuery } from './dto/search-products.query';
import {
  toPublicProductCard,
  toPublicProductDetail,
  type PublicProductCard,
  type PublicProductDetail,
} from './product-public.card';
import {
  assertProductSearch,
  planProductSearchText,
  ProductSearchError,
  totalPages,
  type NormalizedProductSearch,
  type ProductSearchTextPlan,
  type ProductSort,
} from './product-search.rules';

const PRODUCT_FULLTEXT =
  'MATCH(producto.titulo, producto.descripcion) AGAINST (:fulltextQuery IN NATURAL LANGUAGE MODE)';
const BUSINESS_FULLTEXT =
  'MATCH(negocio.nombre, negocio.descripcion_corta) AGAINST (:fulltextQuery IN NATURAL LANGUAGE MODE)';

function likeAnyTextColumn(parameter: string): string {
  const pattern = `LIKE :${parameter} ESCAPE '\\\\'`;

  return `(producto.titulo ${pattern} OR producto.descripcion ${pattern} OR negocio.nombre ${pattern} OR negocio.descripcion_corta ${pattern})`;
}

export const PRODUCT_NOT_FOUND_CODE = 'PRODUCT_NOT_FOUND';
export const PRODUCT_NOT_FOUND_MESSAGE =
  'El producto no existe o no está disponible.';

const VENDOR_COLUMNS = [
  'negocio.id',
  'negocio.nombre',
  'negocio.whatsapp',
  'negocio.sector',
  'negocio.pasillo_puesto',
  'negocio.latitud',
  'negocio.longitud',
];

export interface ProductSearchPage {
  totalResults: number;
  page: number;
  limit: number;
  totalPages: number;
  data: PublicProductCard[];
}

@Injectable()
export class ProductSearchService {
  constructor(
    @InjectRepository(ProductoServicio)
    private readonly productos: Repository<ProductoServicio>,
  ) {}

  async search(dto: SearchProductsQuery): Promise<ProductSearchPage> {
    const query = this.normalize(dto);
    const text = planProductSearchText(query.q);
    const totalResults = await this.buildQuery(query, text).getCount();
    const rows = await this.pageQuery(query, text).getMany();

    return {
      totalResults,
      page: query.page,
      limit: query.limit,
      totalPages: totalPages(totalResults, query.limit),
      data: rows.map((row) => toPublicProductCard(row)),
    };
  }

  async findOne(id: number): Promise<PublicProductDetail> {
    const row = await this.productos
      .createQueryBuilder('producto')
      .innerJoin('producto.negocio', 'negocio')
      .leftJoin('producto.imagenes', 'imagen')
      .select([
        'producto.id',
        'producto.titulo',
        'producto.descripcion',
        'producto.precio',
        'producto.moneda',
        'producto.tipo',
        'producto.estado_disponibilidad',
        'producto.actualizado_en',
        ...VENDOR_COLUMNS,
        'imagen.id',
        'imagen.imagen_url',
        'imagen.orden',
      ])
      .where('producto.id = :id', { id })
      .andWhere('producto.activo = 1')
      .andWhere('negocio.estado = :estado', {
        estado: EstadoNegocio.APROBADO,
      })
      .orderBy('imagen.orden', 'ASC')
      .addOrderBy('imagen.id', 'ASC')
      .getOne();

    if (!row) {
      throw new NotFoundException({
        error: PRODUCT_NOT_FOUND_CODE,
        message: PRODUCT_NOT_FOUND_MESSAGE,
      });
    }

    return toPublicProductDetail(row);
  }

  private normalize(dto: SearchProductsQuery): NormalizedProductSearch {
    try {
      return assertProductSearch(dto);
    } catch (error) {
      if (error instanceof ProductSearchError) {
        throw new BadRequestException({
          error: VALIDATION_ERROR_CODE,
          message: error.message,
          details: [{ field: error.field, message: error.message }],
        });
      }

      throw error;
    }
  }

  private pageQuery(
    query: NormalizedProductSearch,
    text: ProductSearchTextPlan,
  ): SelectQueryBuilder<ProductoServicio> {
    const qb = this.buildQuery(query, text);
    this.attachVendor(qb);
    this.attachCoverImage(qb);
    this.applySort(qb, query.sortBy, text);
    qb.skip((query.page - 1) * query.limit).take(query.limit);
    return qb;
  }

  private attachVendor(qb: SelectQueryBuilder<ProductoServicio>): void {
    qb.addSelect(VENDOR_COLUMNS);
  }

  /** Una sola imagen, la de menor `orden`, para no duplicar filas al paginar. */
  private attachCoverImage(qb: SelectQueryBuilder<ProductoServicio>): void {
    qb.leftJoin(
      'producto.imagenes',
      'imagen',
      `imagen.orden = (
        SELECT MIN(portada.orden)
        FROM producto_imagenes portada
        WHERE portada.producto_id = producto.id
      )`,
    ).addSelect(['imagen.id', 'imagen.imagen_url', 'imagen.orden']);
  }

  private buildQuery(
    query: NormalizedProductSearch,
    text: ProductSearchTextPlan,
  ): SelectQueryBuilder<ProductoServicio> {
    const qb = this.productos
      .createQueryBuilder('producto')
      .innerJoin('producto.negocio', 'negocio')
      .select([
        'producto.id',
        'producto.titulo',
        'producto.descripcion',
        'producto.precio',
        'producto.moneda',
        'producto.estado_disponibilidad',
        'producto.actualizado_en',
      ])
      .where('producto.activo = 1')
      .andWhere('negocio.estado = :estado', {
        estado: EstadoNegocio.APROBADO,
      });

    this.applyTextMatch(qb, text);
    this.applyPrice(qb, query);
    this.applyOpeningDays(qb, query);
    return qb;
  }

  private applyTextMatch(
    qb: SelectQueryBuilder<ProductoServicio>,
    text: ProductSearchTextPlan,
  ): void {
    if (text.fulltextQuery) {
      qb.andWhere(`(${PRODUCT_FULLTEXT} OR ${BUSINESS_FULLTEXT})`, {
        fulltextQuery: text.fulltextQuery,
      });
    }

    text.likePatterns.forEach((pattern, index) => {
      const parameter = `likeToken${index}`;
      qb.andWhere(likeAnyTextColumn(parameter), { [parameter]: pattern });
    });
  }

  private applyPrice(
    qb: SelectQueryBuilder<ProductoServicio>,
    query: NormalizedProductSearch,
  ): void {
    if (query.currency) {
      qb.andWhere('producto.moneda = :currency', { currency: query.currency });
    }

    if (query.priceMin !== undefined) {
      qb.andWhere('producto.precio >= :priceMin', {
        priceMin: query.priceMin,
      });
    }

    if (query.priceMax !== undefined) {
      qb.andWhere('producto.precio <= :priceMax', {
        priceMax: query.priceMax,
      });
    }
  }

  private applyOpeningDays(
    qb: SelectQueryBuilder<ProductoServicio>,
    query: NormalizedProductSearch,
  ): void {
    if (query.days.length === 0) {
      return;
    }

    qb.andWhere(
      `EXISTS (
        SELECT 1
        FROM negocio_dias_atencion nda
        INNER JOIN dias_semana dia ON dia.id = nda.dia_id
        WHERE nda.negocio_id = producto.negocio_id
          AND dia.codigo IN (:...openingDays)
      )`,
      { openingDays: query.days },
    );
  }

  private applySort(
    qb: SelectQueryBuilder<ProductoServicio>,
    sortBy: ProductSort,
    text: ProductSearchTextPlan,
  ): void {
    switch (sortBy) {
      case 'PRICE_ASC':
        qb.orderBy('producto.precio', 'ASC').addOrderBy('producto.id', 'ASC');
        return;
      case 'PRICE_DESC':
        qb.orderBy('producto.precio', 'DESC').addOrderBy('producto.id', 'ASC');
        return;
      case 'NEWEST':
        qb.addSelect('producto.creado_en');
        qb.orderBy('producto.creado_en', 'DESC').addOrderBy(
          'producto.id',
          'DESC',
        );
        return;
      case 'RELEVANCE':
        this.applyRelevanceSort(qb, text);
        return;
      default: {
        const unhandled: never = sortBy;
        void unhandled;
      }
    }
  }

  private applyRelevanceSort(
    qb: SelectQueryBuilder<ProductoServicio>,
    text: ProductSearchTextPlan,
  ): void {
    if (!text.fulltextQuery) {
      qb.orderBy('producto.id', 'ASC');
      return;
    }

    qb.addSelect(
      `(${PRODUCT_FULLTEXT} + ${BUSINESS_FULLTEXT})`,
      'relevance_score',
    );
    qb.orderBy('relevance_score', 'DESC').addOrderBy('producto.id', 'ASC');
  }
}
