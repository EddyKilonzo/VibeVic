import { corsOrigins } from './env';

/**
 * The allowlist is compared to a browser's `Origin` header verbatim, and that
 * header is a scheme, host and port with no path — not even a bare `/`. Every
 * case below is about the gap between that and what a person types into a
 * dashboard field, which is whatever their address bar showed them.
 */
describe('corsOrigins', () => {
  it('reads a single origin', () => {
    expect(corsOrigins({ CORS_ORIGINS: 'https://example.com' })).toEqual(['https://example.com']);
  });

  it('splits a comma-separated list and trims the spaces around it', () => {
    expect(
      corsOrigins({ CORS_ORIGINS: 'https://a.example.com, https://b.example.com' }),
    ).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  /**
   * The production failure this function was changed for: the frontend's real
   * address, copied with the slash the browser shows, matched no origin and
   * every preflight came back without an `Access-Control-Allow-Origin`.
   */
  it('drops a trailing slash, so an address copied from a browser matches', () => {
    expect(corsOrigins({ CORS_ORIGINS: 'https://vibe-vic.vercel.app/' })).toEqual([
      'https://vibe-vic.vercel.app',
    ]);
  });

  it('drops repeated trailing slashes', () => {
    expect(corsOrigins({ CORS_ORIGINS: 'https://example.com///' })).toEqual([
      'https://example.com',
    ]);
  });

  it('leaves a port alone', () => {
    expect(corsOrigins({ CORS_ORIGINS: 'http://localhost:3000/' })).toEqual([
      'http://localhost:3000',
    ]);
  });

  /**
   * An empty allowlist means no browser origin is allowed, which `main.ts`
   * documents as the intended reading rather than an oversight. Blank entries
   * left by a trailing comma must not turn into an empty-string origin.
   */
  it('is empty when nothing is configured', () => {
    expect(corsOrigins({ CORS_ORIGINS: '' })).toEqual([]);
  });

  it('ignores blank entries left by a stray comma', () => {
    expect(corsOrigins({ CORS_ORIGINS: 'https://example.com,,  ,/' })).toEqual([
      'https://example.com',
    ]);
  });
});
