export const PASSWORD_HASH_FIELD = 'password_hash';

export const SENSITIVE_LOG_KEYS = [
  PASSWORD_HASH_FIELD,
  'password',
  'current_password',
  'new_password',
] as const;

const SENSITIVE_KEY_SET = new Set<string>(SENSITIVE_LOG_KEYS);

const SENSITIVE_JSON =
  /"(password_hash|password|current_password|new_password)"\s*:\s*"(?:\\.|[^"\\])*"/gi;

const BCRYPT_HASH = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g;

export function redactSensitiveText(text: string): string {
  return text
    .replace(SENSITIVE_JSON, '"$1":"[REDACTED]"')
    .replace(BCRYPT_HASH, '[REDACTED]');
}

export function redactForLog(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (value instanceof Error) {
    const redacted = new Error(redactSensitiveText(value.message));
    redacted.name = value.name;
    if (value.stack) {
      redacted.stack = redactSensitiveText(value.stack);
    }
    if (value.cause !== undefined) {
      redacted.cause = redactForLog(value.cause, seen);
    }
    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, seen));
  }

  const source = value as Record<string, unknown>;
  const propertyName =
    typeof source.property === 'string' ? source.property.toLowerCase() : '';
  const hidesValidationValue = SENSITIVE_KEY_SET.has(propertyName);
  const output: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(source)) {
    if (SENSITIVE_KEY_SET.has(key.toLowerCase())) {
      output[key] = '[REDACTED]';
      continue;
    }

    if (hidesValidationValue && key === 'value') {
      output[key] = '[REDACTED]';
      continue;
    }

    output[key] = redactForLog(nested, seen);
  }

  return output;
}
