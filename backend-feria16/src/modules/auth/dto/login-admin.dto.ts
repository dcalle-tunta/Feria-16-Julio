import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PASSWORD_REQUIRED_MESSAGE } from './login-vendor.dto';

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class LoginAdminDto {
  @Transform(trimValue)
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido.' })
  @MaxLength(150, { message: 'El correo no puede superar los 150 caracteres.' })
  email: string;

  @IsString({ message: PASSWORD_REQUIRED_MESSAGE })
  @IsNotEmpty({ message: PASSWORD_REQUIRED_MESSAGE })
  @MaxLength(72, {
    message: 'La contraseña no puede superar los 72 caracteres.',
  })
  password: string;
}
