# Client security migration — 23 October 2026

Release status: blocked. Client production audit fell from 15 high / 14 moderate /
3 low to **2 high / 3 moderate / 2 low**, with zero critical findings. This is
progress, not a release certification. Hosted CI, staging journeys, credential
rotation, restore evidence and source redistribution rights remain separate gates.

## Changes

- Admin/shared Sharp 0.35.5; Playwright 1.55.1; scoped Effect 3.20.0 and
  PostCSS 8.5.31 overrides.
- Expo SDK54 retains React Native 0.81.5 and React 19.1.0. Its Metro family moves
  together from 0.83.3 to 0.83.8, which replaces the vulnerable image-size parser.
  No incompatible image-size major override or SDK major upgrade was applied.
- React DOM matches React in storefront and mobile. Storefront configuration
  references the repository's private Tailwind/TypeScript packages.
- Removed unused storefront Nodemailer and NextAuth's optional mail-provider
  peer. Both applications use Credentials providers; API email delivery is
  separate. An email provider must not be enabled without installing and testing
  a supported secure mail dependency.
- UploadThing previously returned `fakeId` for any caller. Both upload middleware
  functions now require a server session and a fresh authenticated backend profile.
  Active status, allowed role, matching identity and tenant membership are checked;
  request tenant hints are ignored. Backend failures deny uploads. Callbacks keep
  library signature verification and no longer log file metadata.
- Removed the unreferenced file-deletion server action and its UTApi wrapper;
  neither enforced authorization. Actual file upload components remain available.

## Verification

Isolated source copy: `/private/tmp/drinksharbour-client-security-20261023`, including
root `packages/`. Excludes real environment files and existing dependencies. Node
22.23.1, pnpm 11.9.0; frozen clean install with scripts disabled passed. Existing
development dependencies were not replaced. No live API/database/upload calls,
deployment, commit or push.

- Regression: 12 upload middleware cases first failed against fake auth, then
  passed with real authorization; final upload file has 13 passing cases including
  the supported forbidden response. Covers anonymous calls on both routes, backend
  token rejection, backend failures, identity/role/status and trusted tenant metadata.
- Eight runtime checks passed: actual React server rendering for all three apps,
  Credentials/JWT round trip without Nodemailer, native Sharp conversion, PostCSS
  source maps, 100 concurrent Effect contexts, and Metro scaled image assets.
  The same context test failed against the old graph: concurrent requests inherited
  another request's identity. It passes with Effect 3.20.0.
- Mobile unit suite: 546 tests / 36 files passed.
- Lint: admin 0 errors / 242 warnings; storefront 0 errors / 47 warnings.
- Admin, storefront and mobile type checks passed. Storefront production build
  and iOS Expo production export passed (Hermes bundle and image/font assets).
- Final full admin snapshot: **3,206 tests / 419 files passed**, one worker.
  Both production web builds passed; admin generates 188 pages. Latest upload
  file independently rechecked: 13 passed. No test timeouts were extended.
  An initial incomplete snapshot omitted root `packages/`, causing six collection
  failures; that snapshot was corrected. Initial runs also timed out during
  concurrent build load. The complete successful run above supersedes those;
  the failures remain recorded rather than counted as passed.
- Quality tooling: five tests passed; redacted working-tree credential scan found
  zero findings. This does not scan Git history.

The upload review also found and fixed an API MFA-token purpose bypass and POS
admin password-change invalidation gap; see
[authentication evidence](access-token-purpose-2026-10-23.md).
Final complete API regression: 4,206 passed, 37 skipped, zero failures or
cancellations. These are isolated snapshot results, not hosted CI evidence for
all concurrent working-tree changes.

`scripts/quality/verify-client-runtime.mjs` is included in the frontend CI job.
Audit gates remain enabled, with no ignored advisories or forced pass.

## Remaining dependency findings

| Package | Severity | Reported fix | Registry evidence |
| --- | --- | --- | --- |
| braces 3.0.3 | High | >=3.0.4 | 3.0.4 query returned E404; latest remains 3.0.3 |
| node-forge 1.4.0 | High | >=1.4.1 | 1.4.1 query returned E404; latest remains 1.4.0 |
| uuid | Moderate | >=11.1.1 | Deliberate parent/API migration remains |
| decode-uri-component | Moderate | >=0.4.3 | Remaining transitive dependency |
| postcss-selector-parser | Moderate | >=7.1.6 | Remaining transitive dependency |
| @eslint/plugin-kit | Low | >=0.3.4 | ESLint transitive dependency |
| quill 2.0.3 | Low | No published fix in audit | Rich text editor dependency |

Unavailable fixes are not an approval to ship. Recheck the registry and parent
releases before choosing a maintained replacement or reviewed local patch. Avoid
silencing findings, inventing version numbers or migrating Expo solely to change
the scanner count. Raw audits and build logs are local temporary evidence, not
customer handover artifacts.
