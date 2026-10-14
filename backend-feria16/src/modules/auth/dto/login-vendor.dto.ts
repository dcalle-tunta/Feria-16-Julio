import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateBy,
  isEmail,
} from 'class-validator';

export const LOGIN_IDENTIFIER_MESSAGE =
  'Ingresa un WhatsApp de 8 dígitos o un correo válido.';

export const PASSWORD_REQUIRED_MESSAGE = 'La contraseña es obligatoria.';

export const BOLIVIAN_WHATSAPP = /^[67]\d{7}$/;

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class LoginVendorDto {
  @Transform(trimValue)
  @IsString({ message: LOGIN_IDENTIFIER_MESSAGE })
  @IsNotEmpty({ message: LOGIN_IDENTIFIER_MESSAGE })
  @ValidateBy({
    name: 'isLoginIdentifier',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        (BOLIVIAN_WHATSAPP.test(value) || isEmail(value)),
      defaultMessage: () => LOGIN_IDENTIFIER_MESSAGE,
    },
  })
  login_identifier: string;

  @IsString({ message: PASSWORD_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: PASSWORD_REQUIRED_MESSAGE })
  @MaxLength(72, {
    message: 'La contraseña no puede superar los 72 caracteres.',
  })
  password: string;
}
