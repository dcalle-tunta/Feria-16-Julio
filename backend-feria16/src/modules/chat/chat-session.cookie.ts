import type { CookieOptions } from 'express';

export const FERIA_SESSION_COOKIE = 'feria_sid';

export const FERIA_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
} as const satisfies CookieOptions;

const SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() !== name) {
      continue;
    }

    const raw = part.slice(separator + 1).trim();
    if (raw.length === 0) {
      return null;
    }

    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  return null;
}

export function readFeriaSessionId(
  cookieHeader: string | undefined,
): string | null {
  const value = readCookie(cookieHeader, FERIA_SESSION_COOKIE);
  if (!value || !SESSION_ID.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

export function clipOptional(
  value: string | undefined,
  max: number,
): string | null {
  if (!value) {
    return null;
  }

  return value.length <= max ? value : value.slice(0, max);
}
