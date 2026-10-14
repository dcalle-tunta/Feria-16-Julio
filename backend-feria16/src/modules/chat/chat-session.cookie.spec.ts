import {
  FERIA_SESSION_COOKIE,
  FERIA_SESSION_COOKIE_OPTIONS,
  readFeriaSessionId,
} from './chat-session.cookie';

const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('feria_sid', () => {
  it('se emite HttpOnly, SameSite=Lax y Path=/', () => {
    expect(FERIA_SESSION_COOKIE).toBe('feria_sid');
    expect(FERIA_SESSION_COOKIE_OPTIONS).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('lee el id y descarta una cookie que no es un uuid', () => {
    expect(
      readFeriaSessionId(
        `tema=oscuro; ${FERIA_SESSION_COOKIE}=${SESSION_ID.toUpperCase()}`,
      ),
    ).toBe(SESSION_ID);
    expect(readFeriaSessionId('feria_sid=no-es-una-sesion')).toBeNull();
    expect(readFeriaSessionId(undefined)).toBeNull();
  });
});
