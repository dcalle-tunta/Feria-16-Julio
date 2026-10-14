import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { SystemModule } from '../system/system.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductsController } from './products.controller';
import { ProductSearchService } from './product-search.service';

@Module({
  imports: [SystemModule, ProductsModule],
  controllers: [CatalogController, ProductsController],
  providers: [CatalogService, ProductSearchService],
})
export class CatalogModule {}
