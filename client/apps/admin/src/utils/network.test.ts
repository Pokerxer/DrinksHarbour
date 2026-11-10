// network.test.ts — the classification this issue turned on: a request that
// never reached the server must read as a connection problem, never as an
// invitation to sign in again.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  credentialBlockerMessage,
  isBrowserOffline,
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  OFFLINE_MESSAGE,
  SESSION_LOADING_MESSAGE,
} from './network';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isBrowserOffline', () => {
  it('reads navigator.onLine of false as offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isBrowserOffline()).toBe(true);
  });

  it('reads navigator.onLine of true as online', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(isBrowserOffline()).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('is true for every browser wording of a dead connection', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('Load failed'))).toBe(true);
    expect(isNetworkError(new Error('fetch failed'))).toBe(true);
    expect(
      isNetworkError(
        new Error('NetworkError when attempting to fetch resource.')
      )
    ).toBe(true);
  });

  it('is false for real HTTP responses (even errors)', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(isNetworkError(new Error('Request failed with status 500'))).toBe(
      false
    );
    expect(isNetworkError(new Error('401 Unauthorized'))).toBe(false);
    expect(isNetworkError(new Error('Your session has expired'))).toBe(false);
  });

  it('treats every failure as network-level while the browser is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isNetworkError(new Error('anything at all'))).toBe(true);
    expect(isNetworkError('not even an Error')).toBe(true);
  });
});

describe('credentialBlockerMessage', () => {
  it('blames the connection, not the session, while offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(credentialBlockerMessage(true)).toBe(OFFLINE_MESSAGE);
    expect(credentialBlockerMessage(false)).toBe(OFFLINE_MESSAGE);
  });

  it('says "still loading" for an online session that has not resolved', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(credentialBlockerMessage(true)).toBe(SESSION_LOADING_MESSAGE);
  });

  it('keeps the sign-in request for an online, resolved, empty session', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(credentialBlockerMessage(false)).toBe(
      'Authentication required. Please sign in again.'
    );
  });

  it("the watcher's offline text and the guards' offline text are the same sentence", () => {
    // Never fork the wording between components.
    vi.stubGlobal('navigator', { onLine: false });
    expect(OFFLINE_MESSAGE).toBe(credentialBlockerMessage(true));

    vi.stubGlobal('navigator', { onLine: true });
    expect(NETWORK_ERROR_MESSAGE).toMatch(/Network error/);
  });
});
