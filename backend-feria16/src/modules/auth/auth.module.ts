import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioBackoffice } from './entities/usuario-backoffice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioBackoffice])],
  exports: [TypeOrmModule],
})
export class AuthModule {}
