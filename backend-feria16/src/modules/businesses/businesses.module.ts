import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';

@Module({
  controllers: [BusinessesController], // Debe estar aquí
})
export class BusinessesModule {}