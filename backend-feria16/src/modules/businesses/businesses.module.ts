import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NegocioDiaAtencion } from './entities/negocio-dia-atencion.entity';
import { Negocio } from './entities/negocio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Negocio, NegocioDiaAtencion])],
  exports: [TypeOrmModule],
})
export class BusinessesModule {}
