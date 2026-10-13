import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductoImagen } from './entities/producto-imagen.entity';
import { ProductoServicio } from './entities/producto-servicio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductoServicio, ProductoImagen])],
  exports: [TypeOrmModule],
})
export class ProductsModule {}
