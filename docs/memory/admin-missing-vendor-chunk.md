# Admin generated vendor chunk recovery

2026-10-20: appraisal cycle generated server page referenced a missing RizzUI
vendor chunk. Reproduced by requiring the generated page directly (failed with
the reported MODULE_NOT_FOUND). Stopped only admin, preserved `.next` at
`/tmp/drinksharbour-admin-next-recovery-1792518831633`, restarted on port 3000.
Requesting the app development bundle rebuilt the route. Same require now passes;
actual cycle HTTP 200 responses logged. Platform on 3002 preserved. No source,
dependency or data changes. Initiating cause unknown; no reinstall warranted.

Details: `docs/superpowers/specs/RESUME-admin-missing-vendor-chunk.md`.

Same-day recurrence established output collision: production BUILD_ID/minified
favicon written while dev process was running, followed by dev page output.
Permanent local fix: admin development defaults to `.next-dev`, production keeps
`.next`; VENUE_NEXT_DIST_DIR override preserved. Updated generated types, ignore,
cleanup scripts and README. Regression test loads actual config: both checks
pass after showing shared-folder failure before the fix. Restarted admin; cycle
module loads and actual browser requests return 200. No dependency reinstall.
