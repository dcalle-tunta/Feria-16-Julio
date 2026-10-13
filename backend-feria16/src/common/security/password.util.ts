import * as bcrypt from 'bcrypt';

export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}
