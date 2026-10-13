import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

class EnvironmentVariables {
  @IsOptional()
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV?: (typeof NODE_ENVIRONMENTS)[number];

  @IsString()
  @MinLength(1)
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @MinLength(1)
  DB_USERNAME: string;

  @IsOptional()
  @IsString()
  DB_PASSWORD?: string;

  @IsString()
  @MinLength(1)
  DB_DATABASE: string;

  @IsString()
  @MinLength(1)
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  AI_API_KEY?: string;

  @IsOptional()
  @IsString()
  AI_MODEL?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const messages = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('; ');
    throw new Error(`Variables de entorno inválidas: ${messages}`);
  }

  return {
    NODE_ENV: validated.NODE_ENV,
    DB_HOST: validated.DB_HOST,
    DB_PORT: validated.DB_PORT,
    DB_USERNAME: validated.DB_USERNAME,
    DB_PASSWORD: validated.DB_PASSWORD ?? '',
    DB_DATABASE: validated.DB_DATABASE,
    JWT_SECRET: validated.JWT_SECRET,
    JWT_EXPIRES_IN: validated.JWT_EXPIRES_IN ?? '12h',
    AI_API_KEY: validated.AI_API_KEY ?? '',
    AI_MODEL: validated.AI_MODEL ?? '',
  };
}
