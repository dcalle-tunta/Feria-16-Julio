import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth-token';
import { AuthRole } from '../auth/auth-token';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateVendorProductDto } from './dto/create-vendor-product.dto';
import { UpdateVendorProductDto } from './dto/update-vendor-product.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorService } from './vendor.service';

@Controller('vendor')
@UseGuards(JwtAuthGuard)
@Roles(AuthRole.VENDOR)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get('me')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.vendorService.getProfile(request.user.id);
  }

  @Patch('me')
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    return this.vendorService.updateProfile(request.user.id, dto);
  }

  @Get('products')
  listProducts(@Req() request: AuthenticatedRequest) {
    return this.vendorService.listProducts(request.user.id);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  createProduct(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateVendorProductDto,
  ) {
    return this.vendorService.createProduct(request.user.id, dto);
  }

  @Patch('products/:id')
  updateProduct(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVendorProductDto,
  ) {
    return this.vendorService.updateProduct(request.user.id, id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.OK)
  deactivateProduct(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vendorService.deactivateProduct(request.user.id, id);
  }
}
