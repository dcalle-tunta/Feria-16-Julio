import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { toSnakeCase } from '../http/snake-case';
import { toUtcIso } from '../http/utc-timestamp';
import { PASSWORD_HASH_FIELD } from '../logging/redact-sensitive';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => toApiResponse(data)));
  }
}

export function toApiResponse(value: unknown): unknown {
  return serializeValue(value, new WeakSet());
}

function serializeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toUtcIso(value);
  }

  if (seen.has(value)) {
    return undefined;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key.toLowerCase() === PASSWORD_HASH_FIELD) {
      continue;
    }

    if (typeof nested === 'function') {
      continue;
    }

    output[toSnakeCase(key)] = serializeValue(nested, seen);
  }

  return output;
}
