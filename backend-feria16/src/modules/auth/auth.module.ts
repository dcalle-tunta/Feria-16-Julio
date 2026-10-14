import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { SignOptions } from 'jsonwebtoken';
import { NegocioDiaAtencion } from '../businesses/entities/negocio-dia-atencion.entity';
import { Negocio } from '../businesses/entities/negocio.entity';
import { Categoria } from '../system/entities/categoria.entity';
import { DiaSemana } from '../system/entities/dia-semana.entity';
import { AdminAuthController } from './admin-auth.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsuarioBackoffice } from './entities/usuario-backoffice.entity';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsuarioBackoffice,
      Negocio,
      NegocioDiaAtencion,
      Categoria,
      DiaSemana,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET no está configurado.');
        }

        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ??
          '12h') as NonNullable<SignOptions['expiresIn']>;

        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [TypeOrmModule, JwtModule, JwtAuthGuard, AuthService],
})
export class AuthModule {}
