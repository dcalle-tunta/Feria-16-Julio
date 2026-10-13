import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { entities } from '../database/entities';
import {
  createPool,
  createPoolCluster,
  type PoolClusterOptions,
  type PoolOptions,
} from 'mysql2';

function createMysqlDriver() {
  return {
    createPool(config: PoolOptions) {
      const pool = createPool(config);
      pool.on('connection', (connection) => {
        connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
        connection.query("SET time_zone = '+00:00'");
      });
      return pool;
    },
    createPoolCluster(config: PoolClusterOptions) {
      return createPoolCluster(config);
    },
  };
}

export function buildTypeOrmOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.get<string>('DB_PASSWORD') ?? '',
    database: config.getOrThrow<string>('DB_DATABASE'),
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    driver: createMysqlDriver(),
    entities,
    synchronize: config.get<string>('NODE_ENV') === 'development',
  };
}
