import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSubProductDraft } from './draft-cleanup';

afterEach(() => vi.unstubAllGlobals());

describe('legacy sub-product draft cleanup', () => {
  it.each(['{"_savedAt":"2099-01-01","productId":"other-tenant"}', 'broken json'])('removes stale data without reading or restoring it: %s', (draft) => {
    const data = new Map([['subproduct-draft', draft], ['other-form', 'keep']]);
    vi.stubGlobal('window', { localStorage: { removeItem: (key: string) => data.delete(key) } });
    clearSubProductDraft();
    expect(data.has('subproduct-draft')).toBe(false);
    expect(data.get('other-form')).toBe('keep');
  });

  it('does not turn a server save into a failure when storage access is blocked', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('Storage blocked'); } });
    expect(() => clearSubProductDraft()).not.toThrow();
  });

  it('is safe outside the browser', () => {
    vi.stubGlobal('window', undefined);
    expect(() => clearSubProductDraft()).not.toThrow();
  });
});
