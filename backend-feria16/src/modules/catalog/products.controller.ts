import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { SearchProductsQuery } from './dto/search-products.query';
import { ProductSearchService } from './product-search.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productSearch: ProductSearchService) {}

  @Get('search')
  search(@Query() query: SearchProductsQuery) {
    return this.productSearch.search(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productSearch.findOne(id);
  }
}
