// utils/network.ts — one place for "is this failure the network's fault?".
//
// The admin app previously classified request failures by substring matching
// (`message.includes('fetch')`), which silently missed the other browsers'
// wording: Safari/WebKit throws "Load failed", Node 18+ throws "fetch failed",
// and Firefox adds "NetworkError when attempting to fetch resource.". Meanwhile
// the missing-token guards ("Authentication required. Please sign in again.")
// fired whenever next-auth's session had not resolved — which is exactly what
// happens on a reload while offline — telling a connected user to re-sign-in
// for what is really a dead connection. Both cases are handled here.

/** Browser fetch failure messages worth recognising, across engines. */
const NETWORK_FAILURE_RE =
  /\b(failed to fetch|networkerror|network error|network request failed|load failed|fetch failed|internet disconnected|err_internet|err_connection|err_network)\b/i;

/**
 * True when the browser itself reports no connectivity. `navigator.onLine` is
 * a device-level signal (it cannot see captive portals), so it is used only as
 * the cheap first check — a live fetch that fails is the stronger evidence.
 */
export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * True when the error came from the transport — a thrown `TypeError` from
 * `fetch`, a DNS/socket failure reflected in the message, or the browser
 * reporting offline. Never true for a real HTTP response (even a 500 or a
 * 401): those reached the server and are that server's problem.
 */
export function isNetworkError(error: unknown): boolean {
  if (isBrowserOffline()) return true;
  if (!(error instanceof Error)) return false;
  // Every documented browser throws TypeError for network-level fetch
  // failures; response-level errors we throw ourselves are plain Errors.
  if (error.name === 'TypeError') return true;
  return NETWORK_FAILURE_RE.test(error.message);
}

/** Shown when an action needs the server but the device is offline. */
export const OFFLINE_MESSAGE =
  'You appear to be offline. Reconnect and try again — your work is still here.';

/** Shown when a live request fails at the transport level. */
export const NETWORK_ERROR_MESSAGE =
  'Network error. Please check your internet connection and try again.';

/**
 * Message for a blocker on missing credentials. Callers reach here when a
 * token they need is absent; this decides which story is true. A reload while
 * offline leaves the next-auth session empty for reasons that have nothing to
 * do with authentication, and an action taken while the session is still
 * resolving is not "unauthenticated" either — it is simply not ready.
 */
export const SESSION_LOADING_MESSAGE =
  'Your session is still loading — please try again in a moment.';

export function credentialBlockerMessage(sessionStillLoading = false): string {
  if (isBrowserOffline()) return OFFLINE_MESSAGE;
  if (sessionStillLoading) return SESSION_LOADING_MESSAGE;
  return 'Authentication required. Please sign in again.';
}

