import * as bcrypt from 'bcrypt';
import { BCRYPT_COST, hashPassword, verifyPassword } from './password.util';

describe('hashPassword', () => {
  it('genera un hash bcrypt con cost 12', async () => {
    expect(BCRYPT_COST).toBe(12);

    const hashed = await hashPassword('Password123');

    expect(hashed.startsWith('$2a$12$') || hashed.startsWith('$2b$12$')).toBe(
      true,
    );
    expect(await bcrypt.compare('Password123', hashed)).toBe(true);
    expect(await bcrypt.compare('otraClave1', hashed)).toBe(false);
    expect(await verifyPassword('Password123', hashed)).toBe(true);
    expect(await verifyPassword('otraClave1', hashed)).toBe(false);
    expect(await verifyPassword('Password123', 'no-es-bcrypt')).toBe(false);
  });
});
