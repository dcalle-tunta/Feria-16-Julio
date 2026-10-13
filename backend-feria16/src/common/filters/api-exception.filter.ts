import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { toApiErrorResponse } from '../http/api-error.response';
import { redactForLog } from '../logging/redact-sensitive';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { statusCode, body } = toApiErrorResponse(exception);

    if (statusCode >= 500) {
      this.logger.error(redactForLog(exception));
    }

    response.status(statusCode).json(body);
  }
}
