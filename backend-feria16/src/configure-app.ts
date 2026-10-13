import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
}
