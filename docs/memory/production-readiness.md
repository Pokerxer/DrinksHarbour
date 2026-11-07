---
name: Production readiness audit
description: Repository-wide engineering baseline, CI/CD gaps and credential exposure remediation.
type: project
---

2026-10-19 user requested whole-repository production readiness work, especially
CI/CD and version control. Git already exists; no GitHub workflows initially.
Large pre-existing dirty checkout must be preserved; no commit/push/deploy asked.
Credential literals were removed from eight tracked operational scripts; history
still requires owner rotation. Never print old values or rewrite history casually.

2026-10-21: added pinned CI, guarded manual web release, Dependabot, readiness,
redacted credential checks, runtime/package consistency and operational runbooks.
Corrected DrinksHarbour branding and removed unused starter mail/demo dependencies.
Next15.5.28/16.4.2, next-auth patch, Swiper12.2.0, official SheetJS0.20.3 and
compatible dependency updates are locked. Client audit fell218→32 findings:
0critical,15high,14moderate,3low. Server fell44→13:1critical,6high,6moderate.
Do not advertise this checkout as production-ready or ready for source resale.

Clean verification: API4092passed/36skipped; admin3174tests/410files passed;
mobile546tests/36files passed; web/mobile types pass. Web type scripts must run
Next typegen first on clean installs (next-env is ignored). Both final web production builds
passed. Existing lint warnings and449
@ts-nocheck files limit assurance. Native/ML/image/Expo/auth dependency migrations,
credential rotation, hosted CI/deployment controls, actual backup restore, staging
journeys and source/asset provenance remain gates. No commit/push/deploy occurred.

Other venue work changed during testing; preserve it. Snapshot results must not
be claimed as a complete check of a moving checkout. See
`docs/audits/production-readiness-2026-10-19.md` and
`docs/superpowers/specs/RESUME-production-readiness.md` for exact results,
temporary verification paths and pending steps.

22October server follow-up: replaced Xenova with Transformers.js3.8.1, scoped
Sharp0.35.5, Nodemailer10.2.1 and official SheetJS0.20.3. Fresh production audit
0critical/0high/10moderate.4.3.1 was rejected because ONNX1.30 package lacked
darwin/x64; native inference on stable3.8.1 passed (384normalized values,
related cosine0.9211 vs unrelated0.1063).56 focused compatibility tests passed.
Fixed browser-cache-in-Node and missing async inference await, added model
disposal and writable temp/cache-directory option. Final cache/model tests10
passed and actual inference repeated successfully. CI includes native smoke.
Full stable suite initially had2 file timeouts; both passed independently9tests.
Serial full-suite retry PASSED:4167passed,37skipped,0failed/0cancelled. Final
cache/native inference passed; high/critical production audit gate exited0.
No active working-tree dependency installation, server restart or deployment;
verification used isolated clean installations. Client release blockers persist.
See docs/audits/server-dependencies-2026-10-22.md for final evidence and limits.

23October client:15high→2high,3moderate,2low,0critical. Remaining high patches
braces3.0.4/node-forge1.4.1 are not published (registry E404). Do not bypass audit.
Scoped Sharp/Effect/PostCSS/Metro patches, Playwright update, removed unused
Nodemailer optional peer, React/DOM alignment and private local config bindings.
Both web builds, app types, mobile546tests, iOS export and8real runtime checks pass;
lint0errors242/47warnings. Full admin snapshot passed3,206tests/419files, one worker;
latest upload file13tests and final admin types passed separately. API final
retry passed4,206tests/37skips,0failures/cancellations in359.9seconds. One file
timed out in the first run; its38tests passed independently and in the full retry.
Fixed anonymous UploadThing middleware and removed dead unsecured delete action.
Effect concurrency test demonstrably fails on old graph and passes on patched.
Also fixed pending-MFA/proof/refresh JWTs being accepted as API access tokens,
including POS admin path; restored its password-change invalidation parity.
45focused auth tests pass. Preserve ordinary untyped access JWT compatibility;
POS tokens remain limited to their POS path. See23October client/auth audit docs.
No live operations, active dependency replacement, commit, push or deployment.
