import { HttpException, HttpStatus } from '@nestjs/common';
import { toUtcIso } from './utc-timestamp';

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details: ApiFieldError[];
  timestamp: string;
  rejection_reason?: string | null;
  retry_after_seconds?: number;
}

export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
export const VALIDATION_ERROR_MESSAGE = 'Los datos enviados no son válidos.';
export const INTERNAL_ERROR_MESSAGE = 'Ocurrió un error interno.';

const ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

const WHITELIST_MESSAGE = /^property (\S+) should not exist/;

export function errorCodeForStatus(status: number): string {
  return ERROR_CODES[status] ?? `HTTP_${status}`;
}

export function isErrorCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(value);
}

export function toApiErrorResponse(
  exception: unknown,
  now: Date = new Date(),
): {
  statusCode: number;
  body: ApiErrorResponse;
  retryAfterSeconds?: number;
} {
  const timestamp = toUtcIso(now);

  if (!(exception instanceof HttpException)) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: 'INTERNAL_SERVER_ERROR',
        message: INTERNAL_ERROR_MESSAGE,
        details: [],
        timestamp,
      },
    };
  }

  const statusCode = exception.getStatus();
  const raw = exception.getResponse();

  if (typeof raw === 'string') {
    return {
      statusCode,
      body: {
        error: errorCodeForStatus(statusCode),
        message: clientMessage(statusCode, raw),
        details: [],
        timestamp,
      },
    };
  }

  if (typeof raw !== 'object' || raw === null) {
    return {
      statusCode,
      body: {
        error: errorCodeForStatus(statusCode),
        message: clientMessage(statusCode, exception.message),
        details: [],
        timestamp,
      },
    };
  }

  const payload = raw as Record<string, unknown>;
  let details = readFieldErrors(payload.details);
  let message = readMessage(payload.message, exception.message);
  let error =
    typeof payload.error === 'string' && isErrorCode(payload.error)
      ? payload.error
      : errorCodeForStatus(statusCode);

  if (
    details.length === 0 &&
    Array.isArray(payload.message) &&
    payload.message.every((item) => typeof item === 'string')
  ) {
    details = detailsFromMessages(payload.message);
    message = VALIDATION_ERROR_MESSAGE;
    if (statusCode === HttpStatus.BAD_REQUEST) {
      error = VALIDATION_ERROR_CODE;
    }
  }

  const body: ApiErrorResponse = {
    error,
    message: clientMessage(statusCode, message),
    details,
    timestamp,
  };

  if (Object.hasOwn(payload, 'rejection_reason')) {
    const reason = payload.rejection_reason;
    if (typeof reason === 'string' || reason === null) {
      body.rejection_reason = reason;
    }
  }

  const retryAfterSeconds = readRetryAfterSeconds(payload.retry_after_seconds);
  if (retryAfterSeconds !== undefined) {
    body.retry_after_seconds = retryAfterSeconds;
  }

  return { statusCode, body, retryAfterSeconds };
}

function clientMessage(statusCode: number, message: string): string {
  if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return INTERNAL_ERROR_MESSAGE;
  }

  return message;
}

function readRetryAfterSeconds(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return undefined;
  }

  return value;
}

function readMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  return fallback;
}

function readFieldErrors(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const details: ApiFieldError[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const field = (item as { field?: unknown }).field;
    const message = (item as { message?: unknown }).message;
    if (typeof field === 'string' && typeof message === 'string') {
      details.push({ field, message });
    }
  }

  return details;
}

function detailsFromMessages(messages: string[]): ApiFieldError[] {
  return messages.map((message) => {
    const match = WHITELIST_MESSAGE.exec(message);
    if (match?.[1]) {
      return {
        field: match[1],
        message: 'Este campo no está permitido.',
      };
    }

    return { field: 'body', message };
  });
}
