# Client dependency migration — 22 October 2026

Scope: remaining client high advisories across admin, storefront and Expo tooling.
Preserve unrelated source changes and active development installations. Resolve
and test in an isolated copy; do not deploy, rotate credentials or change live data.

Files: app/shared package manifests, `client/pnpm-workspace.yaml` and its lockfile;
small compatibility tests in `scripts/quality/` as needed. Prefer parent updates
or compatible scoped overrides. Record reasons and native/API tests for crossings
of a major version. Never suppress findings or blindly force an audit fix.

Initial production audit:15high,14moderate,3low,0critical. Paths include
Playwright, Effect via UploadThing, direct Sharp, PostCSS in Next/Expo, Nodemailer
via NextAuth, Metro image-size, Expo node-forge and Tailwind braces.

Also align storefront React/React DOM versions and bind shared Tailwind/TypeScript
configuration to local workspace packages. Registry packages with the same names
are not substitutes for the project's private configuration.

Verify frozen clean installation; actual image, authentication-mail, upload/runtime
and Metro asset compatibility; web/mobile types and tests; both production web
builds; refreshed production audit. Ordinary business checks require no real SMTP,
uploaded customer files, API credentials or production database. Native mobile
device acceptance and protected hosted CI remain separate release evidence.

Upload boundary: replace the fake identity in `api/uploadthing/core.ts` with a
server session followed by a fresh authenticated `/api/users/me` check. Derive
identity, role and tenant from that response, fail closed on backend errors, and
retain UploadThing's signed callback handling. Cover both upload routes, revoked
sessions, customer denial and trusted tenant metadata in adjacent tests. Remove
the unused unauthenticated file-deletion server action and its private wrapper.

Status (23 October): lockfile and clean installation verified; runtime checks,
mobile tests, all app types, storefront build and iOS export pass. Remaining
high advisories are braces/node-forge, whose reported patch versions are not
published. Full admin snapshot3206tests passed, as did both web builds and the
latest13upload tests. Complete API retry passed4206tests/37skips with zero
failures/cancellations. See
`docs/audits/client-dependencies-2026-10-23.md` for exact results and limitations.

23 October review extension: `protect` and `optionalProtect` verify signatures
but do not distinguish pending-MFA, step-up or refresh JWTs from access tokens.
Add signed-token regression cases before changing those two boundaries. Reject
explicit non-access purposes before querying a user; preserve current untyped
access tokens so existing sessions are not invalidated by this patch.
The mixed POS/admin guard requires the same check on its admin path. That path
must also honor password-change invalidation. Focused tests now pass; full suite
result belongs in `docs/audits/access-token-purpose-2026-10-23.md`.
