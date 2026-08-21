import { createAuthConfig } from './index';

describe('AuthConfig public contract', () => {
  it('publishes validated defaults through a stable interface', () => {
    const values: Record<string, string> = {
      JWT_SECRET: 'a-contract-test-secret-that-is-long-enough',
    };
    const config = {
      getOrThrow: (key: string) => values[key],
      get: (key: string, fallback: string) => values[key] ?? fallback,
    };

    expect(createAuthConfig(config as never)).toEqual({
      secret: values['JWT_SECRET'],
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      algorithm: 'HS256',
    });
  });

  it('does not invent a secret when validated configuration is absent', () => {
    const config = {
      getOrThrow: () => {
        throw new Error('JWT_SECRET is required');
      },
      get: (_key: string, fallback: string) => fallback,
    };

    expect(() => createAuthConfig(config as never)).toThrow('JWT_SECRET is required');
  });
});
