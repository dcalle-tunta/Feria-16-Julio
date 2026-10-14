import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CODIGOS_DIA_ATENCION,
  type CodigoDiaAtencion,
} from '../../../common/enums/domain.enums';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_LENGTH_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_RULE_MESSAGE,
} from '../../../common/security/password.util';

export { PASSWORD_RULE_MESSAGE };

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

export class RegisterVendorDto {
  @Transform(trimValue)
  @IsString({ message: 'El nombre debe tener entre 3 y 50 caracteres.' })
  @MinLength(3, { message: 'El nombre debe tener entre 3 y 50 caracteres.' })
  @MaxLength(50, { message: 'El nombre debe tener entre 3 y 50 caracteres.' })
  name: string;

  @Type(() => Number)
  @IsInt({ message: 'Selecciona una categoría válida.' })
  @Min(1, { message: 'Selecciona una categoría válida.' })
  category_id: number;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString({ message: 'La descripción no puede superar los 200 caracteres.' })
  @MaxLength(200, {
    message: 'La descripción no puede superar los 200 caracteres.',
  })
  short_description?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { message: 'El logo debe ser una URL http o https.' },
  )
  @MaxLength(500, {
    message: 'La URL del logo no puede superar los 500 caracteres.',
  })
  logo_url?: string | null;

  @Transform(trimValue)
  @IsString({
    message: 'Ingresa un número de celular boliviano válido (8 dígitos).',
  })
  @Matches(/^[67]\d{7}$/, {
    message: 'Ingresa un número de celular boliviano válido (8 dígitos).',
  })
  phone: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido.' })
  @MaxLength(150, { message: 'El correo no puede superar los 150 caracteres.' })
  email?: string | null;

  @IsArray({ message: 'Debes seleccionar al menos un día de apertura.' })
  @ArrayMinSize(1, {
    message: 'Debes seleccionar al menos un día de apertura.',
  })
  @ArrayUnique({ message: 'No repitas un día de apertura.' })
  @IsIn(CODIGOS_DIA_ATENCION, {
    each: true,
    message: 'Selecciona un día de apertura válido.',
  })
  opening_days: CodigoDiaAtencion[];

  @Transform(trimValue)
  @IsString({ message: 'El sector debe tener entre 1 y 100 caracteres.' })
  @MinLength(1, { message: 'El sector debe tener entre 1 y 100 caracteres.' })
  @MaxLength(100, { message: 'El sector debe tener entre 1 y 100 caracteres.' })
  sector: string;

  @Transform(trimValue)
  @IsString({ message: 'El pasillo debe tener entre 1 y 100 caracteres.' })
  @MinLength(1, { message: 'El pasillo debe tener entre 1 y 100 caracteres.' })
  @MaxLength(100, {
    message: 'El pasillo debe tener entre 1 y 100 caracteres.',
  })
  aisle_number: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 8 },
    { message: 'La latitud debe estar entre -90 y 90.' },
  )
  @Min(-90, { message: 'La latitud debe estar entre -90 y 90.' })
  @Max(90, { message: 'La latitud debe estar entre -90 y 90.' })
  latitude: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 8 },
    { message: 'La longitud debe estar entre -180 y 180.' },
  )
  @Min(-180, { message: 'La longitud debe estar entre -180 y 180.' })
  @Max(180, { message: 'La longitud debe estar entre -180 y 180.' })
  longitude: number;

  @IsString({ message: PASSWORD_RULE_MESSAGE })
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_RULE_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_MAX_LENGTH_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password: string;

  @IsBoolean({
    message: 'Debes aceptar los términos y políticas para continuar.',
  })
  @Equals(true, {
    message: 'Debes aceptar los términos y políticas para continuar.',
  })
  terms_accepted: boolean;
}
