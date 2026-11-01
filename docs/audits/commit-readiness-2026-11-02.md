# Selective commit review — 2 November 2026

User authorized committing completed changes, without pushing or deploying.
Repository inventory covers all pending paths. Detailed code review and isolation
in this pass cover the candidates below; it is not a claim that every line
of the remaining work was reviewed or that held work is broken.

## Selected candidates

| Change | Boundary |
| --- | --- |
| Standalone runtime without Upstash | No Redis client in runtime, ignored stale provider settings, local limiter thresholds preserved; Redis moved to development-only tooling |
| POS/KDS realtime availability | Public no-store capability endpoint; bounded/cancellable probe before authenticated socket connections; existing REST polling retained |
| Shop searchable filters | Complete category/subcategory/brand search, independently scrollable lists and accessible selections; only required test dependency declarations added |
| Robots policy | Exact query-key boundaries, rendering allowances, private-route restrictions and normalized sitemap origin |
| Existing type/style corrections | Literal animation typing, valid loyalty CSS ring and downlevel Set iteration |
| Existing cart/display typings | Optional legacy cart tenant field, nullable sale discounts and explicit absent contact links |

Mixed source files, manifests, locks and README files are assembled from the
committed baseline plus reviewed changes. No unrelated hunks are staged. Platform
test dependencies reuse existing baseline lockfile resolutions; no transitive
upgrades or broader security/dependency migration are included. Ignored agent
instructions/continuation notes are kept local.

## Held work

| Group | Reason it remains uncommitted |
| --- | --- |
| Generated build/cache output | Not application source; excluded from every commit |
| Venue, marketplace, money and fulfillment changes | Interdependent routes/models/services; wider workspace has 60 integration failures from missing venue MongoDB fixtures |
| Remaining admin and platform features | Not independently isolated and verified in this review; keep their existing work intact |
| Broad dependency upgrades, native embeddings and shared tooling | Require their own clean-install/native/build verification; do not hide them inside a small functional fix |
| Operational scripts and business records | May carry data-affecting operations or private context; not automatically published as application code |
| Other documentation and configuration | Retained with the work they describe unless directly needed by a selected commit |

## Verification

Starting inventory: 3,504 pending paths, including 1,708 generated build artifacts.
A narrow ignore rule now excludes the production-audit build directory. Other
reviewed ignore changes cover local caches and generated PDF reports.

Fresh checks in an isolated checkout of the committed baseline plus selected work:

- Backend: 4,023 passed, 0 failed, 16 skipped; 96.07 seconds.
- Shop UI: 5 passed. Socket connector: 7 passed. Robots policy: 2 passed.
- Platform module regressions: 88 passed, 0 failed.
- Original baseline and first four candidates had identical type diagnostics:
  12 pre-existing errors. The two small type-correction bundles remove all 12;
  the final isolated platform TypeScript check exits 0 with no diagnostics.
- Platform test entries reuse exact baseline admin lock resolutions; package and
  snapshot tables are unchanged. Backend dependency versions/integrities are unchanged.
- Targeted diff whitespace and credential-pattern checks pass. No environment
  credentials, generated bundles, operational data or ignored agent notes are staged.

Candidate code uses the existing installed dependencies for test execution; this
is not a fresh dependency installation or a production build.
CodeRabbit is unavailable, so targeted source/diff/dependency review is local.

## Created commits

- `b7d1183e` — fix(runtime): run independently of Upstash
- `1dfa2884` — fix(pos): probe socket availability before connecting
- `6a73df80` — fix(shop): make category and brand filters searchable and scrollable
- `33125d33` — fix(seo): match exact robots query keys and normalize sitemap origins
- `3e066747` — fix(platform): correct iteration typing and presentation styles
- `11b5c1a4` — fix(platform): complete cart and display typings

The final repository-hygiene commit contains this audit, the current memory note,
realtime operating notes and generated-artifact ignore rules. No push or deployment
is performed. The wider working tree is intentionally still dirty; its held work
needs a separate review, not a blanket commit. Validation is against the selected
committed-code snapshot, not a claim that every pending feature passes integration.
