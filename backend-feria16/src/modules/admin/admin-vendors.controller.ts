import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth-token';
import { AuthRole } from '../auth/auth-token';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminVendorsService } from './admin-vendors.service';
import { ListAdminVendorsQuery } from './dto/list-admin-vendors.query';
import { UpdateVendorStatusDto } from './dto/update-vendor-status.dto';

@Controller('admin/vendors')
@UseGuards(JwtAuthGuard)
@Roles(AuthRole.ADMIN, AuthRole.OPERADOR)
export class AdminVendorsController {
  constructor(private readonly adminVendorsService: AdminVendorsService) {}

  @Get()
  list(@Query() query: ListAdminVendorsQuery) {
    return this.adminVendorsService.list(query);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVendorStatusDto,
  ) {
    return this.adminVendorsService.updateStatus(id, request.user.id, dto);
  }
}
