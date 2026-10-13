import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { ChatModule } from './modules/chat/chat.module';
import { ProductsModule } from './modules/products/products.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
    }),
    AuthModule,
    BusinessesModule,
    ProductsModule,
    ChatModule,
    SystemModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
