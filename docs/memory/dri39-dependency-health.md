# DRI-39 — Dependency health sweep (2026-11-07)

Full-stack dependency freshness pass under the constraint "nothing breaks".
Server, platform, admin, isomorphic-core and commerce-core were audited against
the npm registry, then updated inside **verified-only** boundaries. Resume
anchor: `docs/superpowers/specs/RESUME-dri39-dependency-health.md`.

## What held (verified)

- Server: same-major bumps + majors `@anthropic-ai/sdk@1.6`, `dotenv@18`,
  `googleapis@189`, `imapflow@2.11` (breaking = Node>=20 only), `node-cron@4`,
  `pdf-parse@2` (code migrated in `services/documentText.service.js` +
  `utils/extractOccasionDocument.js`; verified against a real PDF),
  `stripe@23`, dev `redis@6`/`@types/nodemailer@8`. Full 5000+ test suite green
  (final run recorded in the RESUME file).
- Client: platform `next 16.4.5`, react 19.3.1 family, etc.; admin
  `next 15.5.29`, react 19.3.1, TS 5.9.3, jotai 2.20.3, lucide 0.577, etc.
- Package-manager reality: **use pnpm everywhere.** npm's arborist crashes
  (`Cannot read properties of null`) on the client `file:` workspace layout and
  npm installs here are 10x slower on this machine. Server got
  `server/pnpm-workspace.yaml` + `server/pnpm-lock.yaml` (allowBuilds approved
  for onnxruntime-node/protobufjs/sharp; do not delete). `sharp` became an
  explicit server dependency because `middleware/imageUpload.middleware.js`
  requires it directly and pnpm has no legacy hoisting.

## What was caught breaking and fixed or reverted

- `@headlessui/react` 2.2.10 REVERTED to 2.2.0: rizzui 1.0.1's typings wrap
  ExtractProps and their new typing makes rizzui Select `onChange` unknown-typed
  (breaks ~dozens of admin pages' annotated handlers). Re-light only together
  with a rizzui typings migration task.
- `sanitize-html` 2.18.1 REVERTED to the 2.17.5 pin: it now pulls
  htmlparser2@12 which is ESM-only and the server graph must stay
  CJS-requireable (`__tests__/cjsRequireable.test.js` guards this family).
- mongoose 9.12 `Query#cast` reads `model.db.config`; the
  `expiryNoticeQuery.test.js` stub model got the real-model shape
  (`db`/`base`) — production path unaffected.
- `posSocketGateway.test.js` stale expectation replaced (see RESUME; tokenless
  sockets are the deliberate kiosk-pairing design).
- Platform `CartContext` 9th `sizeLabel` param missing from the action payload
  type + public interface → added; platform type:check failing at baseline for
  this before any dependency change.
- Admin `purchases-vendor-detail.tsx` nullish-coalescing TS2881 fixed
  (`i.totalCost ?? (i.packPrice ?? 0) * (i.packQty ?? 0)`; also kills a NaN
  fallback path).

## Verified check matrix

`pnpm --filter admin type:check` ✓ · platform type:check ✓ · both lint scripts
0 errors ✓ · platform vitest venue (14) + shop (27) ✓ · admin vitest (see
RESUME for final counts) · commerce-core `pnpm test` ✓ · root quality scripts ✓
(`npm run test:quality`, secret-scan 0 findings) · server suite with the
`DRINKSHARBOUR_VENUE_TEST_MONGO_URI` env var ✓ (without it 87 tests fail on the
URI guard — the env var is required, not optional).

## Deferred majors — deliberately not applied

Each needs a dedicated migration+QA task (see RESUME file for the reasoning and
usage counts): zod@4 (+resolvers coupling), tailwindcss@4, admin next@16,
@tanstack/react-table@9, recharts@3, framer-motion@14 (133+66 files), jotai@3,
rizzui@2, swiper@14, react-dropzone@20, react-player@3, eslint@10 +
eslint-config-next@16, vitest@5, typescript@7 (Go-based, unsupported by the
Next toolchain yet), @huggingface/transformers@4 (runtime rewrite; pinned
3.8.1), chalk@6 (ESM-only; unused in server code anyway).
`@headlessui/react@2.2.10` joins this list after the rizzui block above.
Expo mobile SDK 54 set is internally coherent; SDK upgrades are their own
`npx expo install --fix`+QA migration.

## Environmental notes for the next session

- `mongorestore`/`mongodump` are NOT installed (no brew on the machine);
  `merchantRecoveryRestore.mongo.test.js` fails on the binary, not the logic.
- Two mongod replica sets already run for tests: port 29127 (`venuePhase0`)
  and 27029 (`peerTest`, `PEER_TEST_MONGO` env var).
- node is at `/usr/local/bin/node` but non-interactive shells need
  `export PATH="/usr/local/bin:$PATH"`.
