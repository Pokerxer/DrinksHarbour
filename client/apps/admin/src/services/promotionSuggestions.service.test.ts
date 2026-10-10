import { afterEach, expect, it, vi } from 'vitest';
import { promotionSuggestionsRequest } from './promotionSuggestions.service';
afterEach(() => vi.unstubAllGlobals());
it('requires authentication and gives usable feedback for non-JSON responses', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => {
        throw Error('HTML');
      },
    }))
  );
  await expect(
    promotionSuggestionsRequest('', '', new AbortController().signal)
  ).rejects.toThrow('Sign in');
  await expect(
    promotionSuggestionsRequest('token', '', new AbortController().signal)
  ).rejects.toThrow('Unable to load');
});
