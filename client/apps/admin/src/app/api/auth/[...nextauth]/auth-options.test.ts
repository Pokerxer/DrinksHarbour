import { describe, expect, test } from 'vitest';
import { authOptions } from './auth-options';

/**
 * NextAuth v4 keeps a caller-supplied provider `id` in `provider.options.id`
 * and leaves the factory default (e.g. 'credentials') at the top level;
 * `parseProviders` resolves `userOptions?.id ?? defaults.id` at runtime.
 * Reading `provider.id` alone therefore reports 'credentials' for the pos-pin
 * provider. Mirror the runtime resolution here.
 */
function effectiveProviderIds(): string[] {
  return authOptions.providers.map(
    (p) => (p as { options?: { id?: string }; id: string }).options?.id ?? p.id
  );
}

describe('registered providers', () => {
  test('does not register a Google OAuth provider', () => {
    // GoogleProvider carried live credentials and
    // allowDangerousEmailAccountLinking with no signIn callback checking the
    // account against the backend, so /api/auth/signin/google minted a valid
    // session with no role and no API token.
    expect(effectiveProviderIds()).not.toContain('google');
  });

  test('registers only the credentials, mfa and pos-pin providers', () => {
    expect(effectiveProviderIds().sort()).toEqual([
      'credentials',
      'mfa',
      'pos-pin',
    ]);
  });

  test('registers no OAuth provider of any kind', () => {
    expect(authOptions.providers.map((p) => p.type)).not.toContain('oauth');
  });
});
