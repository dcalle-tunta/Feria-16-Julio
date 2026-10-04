// src/modules/businesses/dto/create-business-step1.dto.ts
import { IsString, Length, IsNotEmpty, Matches, ArrayMinSize, IsArray } from 'class-validator';

export class CreateBusinessStep1Dto {
  @IsString()
  @Length(3, 50, { message: 'El nombre debe tener entre 3 y 50 caracteres.' })
  nombre: string;

  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @Length(0, 200, { message: 'La descripción no puede superar los 200 caracteres.' })
  descripcion_corta: string;

  @Matches(/^[67]\d{7}$/, { message: 'Ingresa un número de celular boliviano válido (8 dígitos).' })
  whatsapp: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debes seleccionar al menos un día de apertura.' })
  dias_atencion_ids: number[];
}