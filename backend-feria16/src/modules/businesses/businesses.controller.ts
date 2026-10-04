// src/modules/businesses/businesses.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { CreateBusinessStep1Dto } from './dto/create-business-step1.dto';

@Controller('businesses')
export class BusinessesController {
  
  @Post('step1')
  createStep1(@Body() createBusinessDto: CreateBusinessStep1Dto) {
    // Si los datos llegan aquí, es porque pasaron todas las validaciones
    return {
      message: 'Validación exitosa, listo para el paso 2',
      data: createBusinessDto
    };
  }
}