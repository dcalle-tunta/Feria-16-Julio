import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  CODIGOS_DIA_ATENCION,
  Moneda,
  type CodigoDiaAtencion,
} from '../../../common/enums/domain.enums';
import {
  PRODUCT_SORTS,
  type ProductSort,
} from '../product-search.rules';

const PRICE_MESSAGE = 'El precio debe ser un número mayor o igual a 0.';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function toOptionalNumber({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : Number(trimmed);
  }

  return value;
}

function toQueryList({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}

function toDefaultInt(fallback: number) {
  return ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? fallback : Number(trimmed);
    }

    return value;
  };
}

export class SearchProductsQuery {
  @Transform(trimString)
  @IsOptional()
  @IsString({ message: 'Ingrese un término para buscar.' })
  q?: string;

  @Transform(toOptionalNumber)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: PRICE_MESSAGE })
  @Min(0, { message: PRICE_MESSAGE })
  price_min?: number;

  @Transform(toOptionalNumber)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: PRICE_MESSAGE })
  @Min(0, { message: PRICE_MESSAGE })
  price_max?: number;

  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : value,
  )
  @IsOptional()
  @IsIn([Moneda.BOB, Moneda.USD], {
    message: 'La moneda debe ser BOB o USD.',
  })
  currency?: Moneda;

  @Transform(toQueryList)
  @IsOptional()
  @IsArray()
  @IsIn(CODIGOS_DIA_ATENCION, {
    each: true,
    message: 'El día de atención no es válido.',
  })
  days?: CodigoDiaAtencion[];

  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? 'RELEVANCE'
      : value,
  )
  @IsIn(PRODUCT_SORTS, {
    message: 'El orden debe ser RELEVANCE, PRICE_ASC, PRICE_DESC o NEWEST.',
  })
  sort_by: ProductSort = 'RELEVANCE';

  @Transform(toDefaultInt(1))
  @IsInt({ message: 'La página debe ser un entero mayor o igual a 1.' })
  @Min(1, { message: 'La página debe ser un entero mayor o igual a 1.' })
  page: number = 1;

  @Transform(toDefaultInt(10))
  @IsInt({ message: 'El límite debe ser un entero entre 1 y 50.' })
  @Min(1, { message: 'El límite debe ser un entero entre 1 y 50.' })
  @Max(50, { message: 'El límite debe ser un entero entre 1 y 50.' })
  limit: number = 10;
}
