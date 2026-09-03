import { describe, it, expect } from 'vitest';
import { LatestRequest, isAbortError } from './latest-request';

describe('LatestRequest', () => {
  it('treats only the newest attempt as current', () => {
    const r = new LatestRequest();
    const a = r.begin();
    const b = r.begin();

    expect(r.isCurrent(a.ticket)).toBe(false);
    expect(r.isCurrent(b.ticket)).toBe(true);
  });

  it('aborts the previous attempt when a new one begins', () => {
    const r = new LatestRequest();
    const a = r.begin();
    expect(a.signal.aborted).toBe(false);

    const b = r.begin();
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(false);
  });

  // The reported bug, reproduced as ordering rather than timing: "mo" was begun
  // first and answered last, and its result was applied over "monte".
  it('rejects a slow early response that resolves after a later one', () => {
    const r = new LatestRequest();
    const mo = r.begin();
    const monte = r.begin();

    // "monte" comes back first and is applied.
    expect(r.isCurrent(monte.ticket)).toBe(true);

    // "mo" limps in afterwards — it must NOT be allowed to overwrite.
    expect(r.isCurrent(mo.ticket)).toBe(false);
  });

  it('cancel() invalidates an in-flight attempt without starting one', () => {
    const r = new LatestRequest();
    const a = r.begin();

    r.cancel();

    expect(a.signal.aborted).toBe(true);
    expect(r.isCurrent(a.ticket)).toBe(false);
  });

  it('a fresh instance has no current ticket', () => {
    const r = new LatestRequest();
    expect(r.isCurrent(0)).toBe(false);
    expect(r.isCurrent(1)).toBe(false);
  });
});

describe('isAbortError', () => {
  it('recognises an aborted fetch', () => {
    const err = new Error('The user aborted a request.');
    err.name = 'AbortError';
    expect(isAbortError(err)).toBe(true);
  });

  it('does not swallow a genuine failure', () => {
    expect(isAbortError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAbortError(new Error('500'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
