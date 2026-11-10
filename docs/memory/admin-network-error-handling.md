# Admin network error handling — offline must not read as "sign in again"

**Date:** 2026-11-10 · **Issue:** DRI-42 ("I keep facing this when the network is down… [Authentication required. Please sign in again.]") · **Status:** implemented, tests passing

## The bug

When the network was down, the admin dashboard told the user they were
unauthenticated. The exact string came from two guards in
`client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/index.tsx`
(`handleGenerate` and `performSave`): `if (!session?.user?.token)` →
`toast.error('Authentication required. Please sign in again.')`.

Two ways to hit it with a perfectly valid session:

1. **Reload while offline.** next-auth's session provider cannot reach
   `/api/auth/session`, so the session object stays empty and every guard
   computes "no token" = "not signed in".
2. **Action before the session resolves.** `useSession()` reports `loading`
   for a moment after mount; a save clicked in that window got the same
   signed-out message.

Separately, transport-level fetch failures were classified by substring
matching (`message.includes('fetch')`), which misses Safari's `Load failed`
and Node's `fetch failed` wording, so raw browser error text could surface.

## The fix

Shared default export in **`client/apps/admin/src/utils/network.ts`**:

- `isBrowserOffline()` — thin wrapper on `navigator.onLine`.
- `isNetworkError(error)` — transport failures (thrown `TypeError`, known
  browser wordings via `NETWORK_FAILURE_RE`, or the browser being offline).
  Never true for a real HTTP response, including 401/500.
- `OFFLINE_MESSAGE` / `NETWORK_ERROR_MESSAGE` / `SESSION_LOADING_MESSAGE`.
- `credentialBlockerMessage(sessionStillLoading)` — decides, for a missing
  token, whether the truth is offline / still loading / signed-out.
  **Ordering matters:** offline wins over "loading".

Wired in:

- **`connection-status-watcher.tsx`** (mounted once in the admin root
  layout) toasts `offline`/`online` transitions so the offline state is
  known *before* an action fails. Silent on mount (no reload noise).
- **Sub-product create-edit** — both guards now use
  `credentialBlockerMessage` (performSave reads `sessionStatusRef`); save
  catch classifies network errors *first* (a dead request cannot also be a
  401, duplicate, or version conflict); generate/load/archive/restore/
  delete catches route through `isNetworkError`.

## Evidence

- `cd client/apps/admin && npm test -- src/utils/network.test.ts` → 9/9 pass
  (offline/online detection; every browser's fetch-failure wording;
  HTTP responses misreporting as network; message-selection ordering).
- `npm run type:check` → clean.
- Full admin suite: 559/574 files pass; the 15 failing files (all
  `inventory-*` + one vendor-orders) **fail identically on the stashed
  baseline** — pre-existing, unrelated to this change.

## Remaining decisions

- The same substring-classification pattern exists in other admin services
  (`purchaseOrder.service.ts` already handles `TypeError`; most others do
  not). `isNetworkError` is the shared answer — migrate opportunistically.
- Auto-save on unmount still fails silently while offline (correct — no
  toast on teardown), so edits made while offline are lost on leave. If
  that matters, the follow-up is an async retry queue once `online` fires,
  which is a product decision, not a bug fix.
