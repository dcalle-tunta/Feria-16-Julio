import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogSeedService } from '../../database/seed/catalog-seed.service';
import { Categoria } from './entities/categoria.entity';
import { ConfiguracionSistema } from './entities/configuracion-sistema.entity';
import { DiaSemana } from './entities/dia-semana.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfiguracionSistema, Categoria, DiaSemana]),
  ],
  providers: [CatalogSeedService],
  exports: [TypeOrmModule],
})
export class SystemModule {}
