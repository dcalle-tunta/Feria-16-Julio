import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function toOptionalInt({ value }: { value: unknown }): unknown {
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

export class RecommendChatDto {
  @Transform(trimString)
  @IsString({ message: 'Ingresa un mensaje para la consulta.' })
  @IsNotEmpty({ message: 'Ingresa un mensaje para la consulta.' })
  prompt: string;

  @Transform(toOptionalInt)
  @IsOptional()
  @IsInt({ message: 'La categoría no es válida.' })
  @Min(1, { message: 'La categoría no es válida.' })
  category_id?: number;
}
