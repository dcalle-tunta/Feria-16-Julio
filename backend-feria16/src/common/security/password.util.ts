import * as bcrypt from 'bcrypt';

export const BCRYPT_COST = 12;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\d).+$/u;
export const PASSWORD_RULE_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, combinando letras y números.';
export const PASSWORD_MAX_LENGTH_MESSAGE =
  'La contraseña no puede superar los 72 caracteres.';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

let pendingDummyHash: Promise<string> | undefined;

export function dummyPasswordHash(): Promise<string> {
  pendingDummyHash ??= hashPassword('feria16-login-no-user');
  return pendingDummyHash;
}
