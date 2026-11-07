# Vercel build fixes (2026-11-07)

Three Vercel failures on the `feat/plan-entitlements-billing` branch deploys
(platform/admin apps + backend function).

## 1. `ignoreCommand` exceeds Vercel's 256-character cap

Schema validation rejected `client/apps/platform/vercel.json` (and admin's was
just as long). The inline git-diff ignore logic now lives in:

- `scripts/quality/vercel-ignore-platform.sh`
- `scripts/quality/vercel-ignore-admin.sh`

Both `vercel.json` files invoke them via a short
`cd "$(git rev-parse --show-toplevel)" && bash scripts/quality/vercel-ignore-…sh`
line. Exit 1 = relevant changes (build), exit 0 = skip. If
`VERCEL_GIT_PREVIOUS_SHA` is missing from the clone (the build log showed
`fatal: bad object e6f51197…`), the scripts fall back to `HEAD^` instead of
bricking the gate.

## 2. Platform/admin install: "Headless installation requires a pnpm-lock.yaml"

The custom `installCommand` (`cd ../.. && pnpm install --frozen-lockfile`) ran
whatever stale `pnpm` happens to be on the build image's PATH, which ignored
the v9 lockfile as "not compatible" and then demanded one for the headless
(frozen) install. Installing at `client/` with the locally pinned pnpm 11.9
works fine — the binary version was the only variable.

Fix: `installCommand` now runs `corepack pnpm install --frozen-lockfile`, so
corepack activates the `packageManager`-pinned pnpm (`11.9.0`) instead of the
unknown PATH version. Vercel's own auto-detection (used by the server project,
which has no custom installCommand) already worked and was left untouched.

## 3. Backend function 506 MB, over the 250 MB uncompressed limit

Two dead-weight dependencies inflated the traced `index` function:

- **`googleapis` (~246 MB in `node_modules/.pnpm`)**: only
  `google.auth.OAuth2` was used, in `server/services/email.service.js`. It is
  swapped for `google-auth-library@11.3.3` (the auth layer underneath
  googleapis; already in the lockfile as its transitive dep). `OAuth2Client`
  exposes the same `setCredentials`/`getAccessToken` surface the code uses,
  so behavior is identical. The other "googleapis" matches (Tenant.js
  geocoding, ors/places services) are plain `fetch` REST calls and unaffected.
- **onnxruntime-node's linux postinstall (~200 MB of CUDA/TensorRT
  no-ops)**: the embedding pipeline runs CPU-only (`device: 'cpu'` in
  `server/utils/localEmbeddingRuntime.js`), and the npm tarball already ships
  the Linux x64 CPU binaries. `server/patches/onnxruntime-node@1.21.0.patch`
  (registered in `server/pnpm-workspace.yaml` under `patchedDependencies`)
  removes the `postinstall` script so the GPU provider download never runs.
  pnpm patch-commit chose patch hash
  `d572c573ff3a637fc5032bab554f7522259518212360891d3903aeb0eb052b63`.

Net effect on the traced function: roughly −436 MB, well under the limit.

## Verification

- `node --test __tests__/emailTransport.test.js __tests__/giftCheckout.email.test.js __tests__/emailSuppression.test.js` — 22/22 pass
- `node --test __tests__/dependencyCompatibility.test.js` — 3/3 pass
- `node --test __tests__/localEmbeddingRuntime.test.js` — 2/2 pass
- `email.service.js` loads at import (no SMTP handshake — lazy connect)
- `pnpm install --frozen-lockfile` in `server/` reproduces the patched
  onnxruntime-node (no `postinstall` in its scripts, CPU binaries present)
- Ignore scripts verified locally: missing previous SHA → fails open with
  `HEAD^`; no relevant diff → exit 0 (skip)

## Left alone on purpose

- The Node version warning (project settings "24.x" vs `engines: ">=22 <23"`)
  is informational — engines win and Node 22.x is what's used.
- If a future deploy ever needs >250 MB again, the fallback is the
  `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` beta env var; prefer shrinking instead.
