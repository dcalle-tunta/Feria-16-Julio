import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  EstadoDisponibilidad,
  Moneda,
  TipoProducto,
} from '../../../common/enums/domain.enums';
import { MAX_PRODUCT_IMAGES, MAX_PRODUCT_PRICE } from './create-vendor-product.dto';

const TITLE_MESSAGE = 'El título debe tener entre 1 y 150 caracteres.';
const PRICE_MESSAGE =
  'El precio debe ser un número mayor o igual a 0, con hasta 2 decimales.';
const PRICE_MAX_MESSAGE = 'El precio no puede superar 99999999.99.';
const IMAGE_URL_MESSAGE = 'Cada imagen debe ser una URL http o https.';

const HTTP_URL = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNumber({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value.trim());
  }

  return value;
}

function trimUrls({ value }: { value: unknown }): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => (typeof item === 'string' ? item.trim() : item));
}

function isProvided(_object: object, value: unknown): boolean {
  return value !== undefined;
}

export class UpdateVendorProductDto {
  @Transform(trimValue)
  @ValidateIf(isProvided)
  @IsString({ message: TITLE_MESSAGE })
  @MinLength(1, { message: TITLE_MESSAGE })
  @MaxLength(150, { message: TITLE_MESSAGE })
  title?: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto.' })
  description?: string | null;

  @Transform(toNumber)
  @ValidateIf(isProvided)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: PRICE_MESSAGE },
  )
  @Min(0, { message: PRICE_MESSAGE })
  @Max(MAX_PRODUCT_PRICE, { message: PRICE_MAX_MESSAGE })
  price?: number;

  @ValidateIf(isProvided)
  @IsIn([Moneda.BOB, Moneda.USD], {
    message: 'La moneda debe ser BOB o USD.',
  })
  currency?: Moneda;

  @ValidateIf(isProvided)
  @IsIn([TipoProducto.PRODUCTO, TipoProducto.SERVICIO], {
    message: 'El tipo debe ser PRODUCTO o SERVICIO.',
  })
  type?: TipoProducto;

  @ValidateIf(isProvided)
  @IsIn(
    [EstadoDisponibilidad.DISPONIBLE, EstadoDisponibilidad.AGOTADO],
    { message: 'La disponibilidad debe ser DISPONIBLE o AGOTADO.' },
  )
  availability_status?: EstadoDisponibilidad;

  @Transform(trimUrls)
  @ValidateIf(isProvided)
  @IsArray({ message: 'Las imágenes deben enviarse como una lista de URLs.' })
  @ArrayMaxSize(MAX_PRODUCT_IMAGES, {
    message: 'Puedes enviar como máximo 8 imágenes.',
  })
  @IsUrl(HTTP_URL, { each: true, message: IMAGE_URL_MESSAGE })
  @MaxLength(500, {
    each: true,
    message: 'La URL de la imagen no puede superar los 500 caracteres.',
  })
  image_urls?: string[];
}
