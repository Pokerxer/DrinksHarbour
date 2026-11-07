---
date: 2026-10-19
updated: 2026-10-23
status: blocked-for-release
scope: current checkout; local engineering evidence
---

# DrinksHarbour production and source-handover review

23 October client follow-up: production findings are now **0 critical / 2 high /
3 moderate / 2 low**, down from15high. Remaining high fixes for braces and
node-forge are not published in the registry. Fixed anonymous UploadThing access,
React/configuration mismatches and request-context contamination in Effect.
Both web builds, all app types, mobile tests, iOS bundle export and eight runtime
checks passed. Full admin snapshot:3,206passed/419files; latest upload file13passed.
Complete API retry passed4,206tests with37skips and0failures/cancellations after
one initial harness timeout; no timeout limits were extended. See
[client evidence](client-dependencies-2026-10-23.md) and
[API token-purpose fix](access-token-purpose-2026-10-23.md).

22 October follow-up: the server production graph now reports0critical/0high
and10moderate findings after maintained model/mail/spreadsheet migrations.
Real local inference, native image processing and mail/workbook compatibility
passed; final server suite:4,167passed/37optional skips,0failures/cancellations.
Production high/critical audit gate passed. See [server migration evidence](server-dependencies-2026-10-22.md).
Client findings and external release gates below remain unresolved.

**Decision: do not advertise this checkout as production-ready or ready for source
handover yet.** Engineering controls were added and concrete defects fixed, but
security, build and operational evidence is incomplete. This is a local review,
not a line-by-line certification of every file or evidence about the deployed site.

## Repository and product facts

Git already existed: `github.com/Pokerxer/DrinksHarbour`, branch
`feat/plan-entitlements-billing`, initial HEAD `e6f51197`. There were approximately
6,004 tracked files and411 changed/untracked paths before this review. Preserve
unrelated work. No commit, push, production deployment or live-data changes were
performed for this audit. No GitHub workflows existed at the start.

DrinksHarbour is the product name. The admin README still described an Isomorphic
starter; that README was corrected. Unused starter email actions/templates with
fictional receipts and SMTP debug settings were removed. Internal package/storage
names remain for compatibility. Branding is separate from asset/source provenance:
starter redistribution terms and third-party asset rights remain unverified.

## Implemented controls and fixes

- SHA-pinned, read-only GitHub CI: source credential scan, quality-tool tests,
  API unit/HTTP tests, disposable transaction databases, web/mobile checks,
  production web builds and high/critical dependency gates.
- Manual protected Vercel release workflow verifies successful CI for the exact
  main commit. Environment credentials, reviewers and deployment integration
  restrictions still require account configuration; no actual hosted run occurred.
- Dependabot configuration, Node22 runtime pin, explicit client pnpm version,
  corrected workspace build approvals, frozen installs and contribution rules.
- Removed embedded database credential literals from eight tracked operational
  scripts. Operations now require configured environment values. A redacted scan
  catches selected credential patterns without printing the matched values.
- New `/ready` database ping with timeout,503 on dependency failure, no diagnostic
  disclosure and no caching. Existing `/health` remains process liveness.
- Replaced unsupported `next lint`, fixed actual JSX/import/hook errors and
  extracted catalog form effects into a tested React component. No lint rules or
  type checks were disabled to obtain green results.
- Limited dashboard test workers after reproducing resource-related timeouts.
- Added release, recovery, isolated backup restore and source-handover procedures.
  Source archive exclusions omit known private reports, backups, environment
  files and business documents. Exclusions do not sanitize Git history or prove
  every remaining source asset contains only synthetic data.

## Verification evidence

Measurements below refer to the checkout and installation specified; they must
not be substituted for checks on the final reviewed release commit.

| Gate | Observed result |
| --- | --- |
| Quality tooling | 5 tests passed (3 credential-scan,2 existing build-isolation); working-tree scan0 findings |
| Readiness/configuration regression tests | 7 passed |
| API, original installed dependency graph | 4,092 passed,36 skipped,0 failed;4,128 tests |
| Admin, final clean client graph | 410 test files /3,174 tests passed with2 workers |
| Focused catalog/inventory component tests | 9 passed |
| Admin clean types after adding Next type generation | Passed |
| Platform clean types after adding Next type generation | Passed |
| Mobile tests | 36 files /546 tests passed |
| Mobile types | Passed |
| Admin lint, final clean graph | 0 errors,242 warnings |
| Platform lint, final clean graph | 0 errors,47 warnings; internal signup links corrected |
| Platform production build, final clean graph /Next16.4.2 | Passed |
| Admin production build, final clean graph /Next15.5.28 | Passed |
| Client frozen clean install, final graph | Passed with pnpm11.9.0 using a writable temporary cache/store |
| Isolated server clean install | npm ci --ignore-scripts succeeded;4,092 passed,36 skipped,0 failed |
| Synthetic replica-set integration | 33 passed after focused current-source recheck;9 nested optional/failpoint checks skipped |
| Workflow/config syntax | YAML and Vercel JSON parsed; hosted workflow execution not verified |
| Source archive exclusions | git archive preview excluded report/memory directories and retained environment example |

Server HTTP tests cannot bind local fixture ports inside the sandbox; the clean
run was repeated with the required access. Sandbox failures are not application
test evidence. Some Mongo integration fixtures are optional/skipped locally.
There are449 web files containing `@ts-nocheck`, so typecheck success is limited.

## Security and release blockers

1. **Credential rotation:** removed literals still exist in Git history. The
   owner must rotate/revoke affected database credentials and check access logs.
   Do not print old values or distribute repository history as a clean artifact.
2. **Dependency findings:** original server production audit44 findings
   (4critical/24high). Compatible lock updates plus removal of unused `paystack-api`
   first reduced this to13 (1critical/6high/6moderate). The22October follow-up
   replaced Xenova with maintained Transformers.js, migrated SheetJS/Nodemailer
   and patched its scoped image runtime:0critical/0high/10moderate production
   findings remain. Stable ONNX diagnostic dependencies add moderate findings;
   the native-incompatible4.x candidate was rejected. Client workspace
   audit originally218 findings (9critical/109high/79moderate/21low). Framework/auth
   updates, Swiper12.2.0, official SheetJS0.20.3 and compatible transitive patches
   reduced this to32 (0critical/15high/14moderate/3low). Remaining high findings
   include Playwright, effect, sharp, PostCSS, Nodemailer, image-size, node-forge
   and braces. Counts are advisory graph
   results, not proof that every issue is reachable. Do not downgrade libraries
   to obsolete releases just because an automated audit suggests it.
3. **Release-commit verification:** Next15.5.28 (admin/core), Next16.4.2
   (platform), next-auth4.24.15 and compatible lint config were resolved. Unused
   starter email dependencies were removed, including their obsolete Next preview
   server. A writable temporary pnpm cache was needed after repeated cache failures.
   Both web type scripts now generate Next declarations before checking a clean
   checkout. Frozen clean installs, types/tests and both production builds passed
   on the isolated verification graph. These results do not patch deployed code
   or replace one full hosted check on the reviewed release commit.
4. **Operational evidence:** branch protection, required CI, protected deployment
   environments, API deployment provider, alert delivery, backup policy and actual
   isolated restore/RPO/RTO have not been verified. Written runbooks are preparatory.
5. **Staging acceptance:** real browser journeys for buyer setup, two-tenant
   isolation, login/MFA, checkout/POS, signed webhook replays, stock/returns and
   network failure need a controlled synthetic staging environment and evidence.
6. **Source distribution:** document starter/assets/dependency licenses, remove
   private business material from the exact release artifact, and verify a buyer
   can install/configure it independently. Existing operational scripts contain
   business-specific identifiers; exclusions alone do not finish that review.

## Review boundaries and follow-through

Authentication, tenant authority, refresh rotation, CSRF, webhook signatures,
rate limiting, Redis integration and graceful shutdown already exist. This audit
does not claim these controls were missing or prove all their runtime paths safe.
Do not apply speculative architecture rewrites to the large dirty checkout.

Use `docs/operations/release.md` as the release gate and
`docs/superpowers/specs/RESUME-production-readiness.md` for the next session.
Both final web builds passed. Tests and builds used synthetic settings in an
isolated copy; no production environment files were copied. Both temporary
MongoDB fixture processes shut down cleanly. Remaining gates above are unresolved.

### Snapshot consistency

Venue source/tests changed outside this audit while checks ran. The initial
isolated request test lacked a seat-capacity fix already in the working checkout.
A second fixture needed the current recovery route and raw collection state setup
(the Tenant model hook normalizes `isActive`). Those changes were preserved and
copied for rechecks. The lapse fixture then passed. No independent audit fix is
claimed for those externally edited files. A reviewed release commit still needs
one complete hosted CI run; results across snapshots are not that evidence.
