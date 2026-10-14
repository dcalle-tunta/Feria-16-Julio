import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoNegocio } from '../../../common/enums/domain.enums';

const STATUS_MESSAGE =
  'El estado debe ser PENDIENTE_VALIDACION, APROBADO, RECHAZADO o SUSPENDIDO.';
const REJECTION_REASON_LENGTH =
  'El motivo de rechazo debe tener entre 3 y 255 caracteres.';

function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class UpdateVendorStatusDto {
  @IsIn(Object.values(EstadoNegocio), { message: STATUS_MESSAGE })
  status: EstadoNegocio;

  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'El motivo de rechazo debe ser texto.' })
  @MaxLength(255, { message: REJECTION_REASON_LENGTH })
  rejection_reason?: string;
}
