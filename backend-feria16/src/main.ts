import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no incluidas en el DTO
      forbidNonWhitelisted: true, // Lanza error si envían propiedades extra
      transform: true, // Transforma tipos automáticamente (ej. string a number)
    }),
  );
  app.enableCors(); // Permite peticiones desde el frontend
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
