import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultaNegocioSugerido } from './entities/consulta-negocio-sugerido.entity';
import { Consulta } from './entities/consulta.entity';
import { SesionUsuario } from './entities/sesion-usuario.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SesionUsuario,
      Consulta,
      ConsultaNegocioSugerido,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class ChatModule {}
