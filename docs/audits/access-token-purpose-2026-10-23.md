# API token purpose — 23 October 2026

Found while reviewing the backend authorization used by client uploads.

`user.service.js` signs a five-minute `pending_mfa` challenge with the same key as
access tokens. Signature verification in `protect`, `optionalProtect` and the
admin branch of `protectPOSOrAdmin` previously accepted it as a normal session.
MFA proof and refresh JWTs could also cross that boundary when signed with the
same key. A valid signature alone does not establish the token's intended use.

`server/utils/accessToken.js` now rejects explicit non-access token purposes.
Both normal API guards use it before looking up a user. The mixed POS guard
continues to admit POS tokens only through its existing tenant-checked POS path;
its admin path requires an access token. Existing untyped access tokens remain
valid, as do explicitly typed access tokens. No token issuers or live sessions
were rewritten, and MFA challenge/verification endpoints retain their behavior.

The POS admin branch also omitted the normal API's password-change invalidation
check. It now selects `passwordChangedAt` and rejects older access tokens before
attaching the user. This aligns back-office reporting with `protect`.

## Evidence

- Signed-token tests initially reproduced 24 main-guard/guest-auth failures, then
  six POS admin failures. The password-change regression also failed before the
  fix. Tests use a synthetic signing key and stub database reads, not live users.
- Final focused run: **45 passed, zero failed** (39 boundary cases and six existing
  MFA controller tests). Normal legacy/access sessions, tenant-checked POS
  sessions and tokens issued after password changes retain access.
- Initial complete server rerun: 4,188 passed, 37 skipped, zero assertion failures,
  one cancelled file (`productResearch.service.test.js`, harness timeout). All 38
  tests in that file passed unchanged in 201ms on immediate recheck. Do not call
  that complete run green.
- Final complete unchanged retry: **4,206 passed, 37 skipped, zero failures or
  cancellations**, 4,243 tests in 359.9 seconds. Same 60-second timeout ceiling;
  the previously cancelled file also passed within this complete run.
- The isolated 22 October verified server graph contains only these
  authentication source/test additions for this
  rerun. It is not a claim to validate other concurrent checkout edits.

Files: `server/middleware/auth.middleware.js`, `server/middleware/pos.middleware.js`,
`server/utils/accessToken.js`, `server/__tests__/accessTokenPurpose.test.js`.
No server restart, live database operation, token rotation or deployment.
