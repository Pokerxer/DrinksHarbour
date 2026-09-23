import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());

describe('explicit duplication intent', () => {
  it('never starts duplication on a fresh page load', async () => {
    const intent = await import('./duplicate-intent');
    expect(intent.takeDuplicateSource()).toBeNull();
  });
  it('consumes a Duplicate click once', async () => {
    const intent = await import('./duplicate-intent');
    intent.requestDuplicate('source-id');
    expect(intent.takeDuplicateSource()).toBe('source-id');
    expect(intent.takeDuplicateSource()).toBeNull();
  });
  it('does not retain a pending copy across a page refresh', async () => {
    const intent = await import('./duplicate-intent');
    intent.requestDuplicate('source-id');
    // Refresh creates a fresh JavaScript runtime, not persisted draft storage.
    vi.resetModules();
    const refreshed = await import('./duplicate-intent');
    expect(refreshed.takeDuplicateSource()).toBeNull();
  });
});
