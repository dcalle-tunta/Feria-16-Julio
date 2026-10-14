import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminVendorsController } from './admin-vendors.controller';
import { AdminVendorsService } from './admin-vendors.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminVendorsController],
  providers: [AdminVendorsService],
})
export class AdminModule {}
