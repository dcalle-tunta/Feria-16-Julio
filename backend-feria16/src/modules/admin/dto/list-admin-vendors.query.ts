import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EstadoNegocio } from '../../../common/enums/domain.enums';

const STATUS_MESSAGE =
  'El estado debe ser PENDIENTE_VALIDACION, APROBADO, RECHAZADO o SUSPENDIDO.';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value;
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

export class ListAdminVendorsQuery {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(Object.values(EstadoNegocio), { message: STATUS_MESSAGE })
  status?: EstadoNegocio;

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
