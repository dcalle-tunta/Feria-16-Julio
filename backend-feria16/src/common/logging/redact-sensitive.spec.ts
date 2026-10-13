import { redactForLog, redactSensitiveText } from './redact-sensitive';

const HASH = `$2b$12$${ 'a'.repeat(53) }`;

describe('redactForLog', () => {
  it('no conserva password_hash ni un hash bcrypt', () => {
    const redacted = redactForLog({
      nombre: 'Ana',
      password_hash: HASH,
      password: 'Password123',
      nested: {
        current_password: 'Actual123',
        new_password: 'Nueva1234',
      },
      error: {
        property: 'password_hash',
        value: 'Password123',
      },
    }) as {
      nombre: string;
      password_hash: string;
      nested: { current_password: string; new_password: string };
      error: { value: string };
    };

    expect(redacted.nombre).toBe('Ana');
    expect(redacted.password_hash).toBe('[REDACTED]');
    expect(redacted.nested.current_password).toBe('[REDACTED]');
    expect(redacted.nested.new_password).toBe('[REDACTED]');
    expect(redacted.error.value).toBe('[REDACTED]');
    expect(JSON.stringify(redacted)).not.toContain(HASH);
    expect(JSON.stringify(redacted)).not.toContain('Password123');
  });

  it('limpia hashes escritos dentro de un texto', () => {
    const text = redactSensitiveText(
      `guardado ${HASH} y "password_hash":"otro"`,
    );

    expect(text).not.toContain(HASH);
    expect(text).toContain('[REDACTED]');
    expect(text).not.toContain('"otro"');
  });
});
