import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedactingLogger } from './common/logging/redacting-logger';
import { configureApp } from './configure-app';

async function bootstrap() {
  const logger = new RedactingLogger();
  const app = await NestFactory.create(AppModule, { logger });
  app.useLogger(logger);
  app.setGlobalPrefix('api/v1');
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
