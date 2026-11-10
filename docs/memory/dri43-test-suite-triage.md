# DRI-43 — Failed-test triage (2026-11-10)

Issue: "fix all the failed tests". Ran the full server suite (`node --test '__tests__/*.test.js'`, 789 files / ~5040 tests) and triaged every failure. No production code was broken; one test-helper regression and two environmental prerequisites accounted for everything.

## Failure classes found

1. **Missing `DRINKSHARBOUR_VENUE_TEST_MONGO_URI` (87 failures).** Every `venue*`/`market*`/`platformBeverageGate`/`occasionConversation` mongo test guards on the URI at `__tests__/helpers/venueMongo.js:6` — the env var is required, not optional (already noted in DRI-39). The shared fixture replica runs at `mongodb://127.0.0.1:29127?replicaSet=venuePhase0` (dbpath `/tmp/dh-venue-mongo-repl`). Run the suite as:
   ```
   export DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0'
   node --test '__tests__/*.test.js'
   ```
2. **`taxonomyPicker.test.js` — `req.get is not a function` (3 real failures).** The surface-aware navigation counts change (2026-11-10, uncommitted `category.controller.js`/`subcategory.controller.js`) reads `req.get('x-is-tenant-site')`, and the unit fakes in `taxonomyPicker.test.js` passed bare `req` objects. Fixed in the test file only: the `request()` helper now builds `const req = { get: () => undefined, ...incomingReq }`. Controller code untouched — `req.get()` is the standard Express pattern used by `product.controller.js` and elsewhere.
3. **Load-timeout cluster (13 files / 30 tests, all pass standalone).** `venue*` mongo tests with tight custom timeouts (90–120s) exceeded them under full-suite parallelism: all venue mongo files share the single `:29127` mongod, and `node --test` runs files at CPU-count concurrency. Verified every affected file green standalone after a fresh replica restart.

## Fixture-maintenance note

The `:29127` replica's dbpath (`/tmp/dh-venue-mongo-repl`) accumulates WiredTiger files across runs and the mongod runs for days at a time; a stale/overloaded instance amplifies the load-timeout class. On 2026-11-10 it was restarted from a clean dbpath and `venuePhase0` re-initiated — the documented disposable-fixture procedure (see `docs/memory/pos-till-acceptance-fixture.md`). If venue timeouts reappear in full-suite runs: (a) confirm the env var is set, (b) verify the failing file standalone, (c) restart the fixture mongod with a fresh dbpath before suspecting code.

Also: **use a durable TMPDIR for long runs.** The Paperclip run harness sets `TMPDIR`
to a per-run dir that the platform deletes when that heartbeat ends — and a full-suite
run (~85 min) outlives the heartbeat that launched it. `merchantRecoveryRestore.mongo.test.js`
does `mkdtemp` under `TMPDIR` and fails with ENOENT once the parent is gone; this hit
the 2026-11-10 run-1 at test 2250 (`paperclip-run-dri-43-…/phase-d-restore-…`). A
`mkdir -p "$TMPDIR"` at launch is NOT sufficient since the dir can vanish mid-run;
the in-test fallback (ensure parent exists, retry, then `/tmp`) is now baked into
`merchantRecoveryRestore.mongo.test.js` itself.
Instead export a durable path outside the run lifecycle for the whole invocation:
```
export TMPDIR='/private/var/folders/6r/48j62g153yngdnhfnh9jzz940000gn/T/opencode/dri43-tmp'
mkdir -p "$TMPDIR"
```

## Verified full-suite evidence (run 1, 2026-11-10, exit 1)

Log preserved at `server/test-logs/dri43-final-run4.log` (copied before the log path
was reused by a follow-up verification run). Final TAP:
**5121 tests / 5093 pass / 1 fail / 3 cancelled / 24 skipped — exit 1, duration ~27 min.**
- 1 fail = `merchantRecoveryRestore` ENOENT per above (deleted per-run TMPDIR, mid-run).
  Standalone re-verified green 1/1 (32s, exit 0) with the durable TMPDIR.
- 3 cancelled = node counts timed-out tests as cancelled: `venuePrepRead.http`,
  `venuePreparation`, `venuePrintBridge.http` each hit the old `120000ms` guard under
  full parallelism while same-file siblings passed at 72–115s. Contention, not defects.

## Final verified state

- **CLEAN (2026-11-10 ~17:20 WAT):** full-suite run completed end-to-end,
  log `server/test-logs/dri43-final6.log` (gitignored, inspectable):
  **5121 tests — 5097 pass / 0 fail / 0 cancelled / 24 skipped (env-gated
  guards), 0 `not ok` lines; duration_ms 2,841,485 (~47 min).** Exit code 0 by
  node --test semantics (`fail 0 / cancelled 0` ⇒ exit 0; the runner's post-run
  `.exit` file was not written — see runner-kill history below — so the
  terminal TAP summary is the cited evidence).
- Earlier killed/contended runs are preserved as `server/test-logs/
  *-killed.log` / `*-stalled.log` (+ `.exit` notes). None contained a dev-run
  code defect: run-1's single failure was the mid-run TMPDIR mkdtemp (fixed
  in-test), and every later failure/cancel batch traces to runner-relay deaths
  or double-suite contention on the shared `:29127` fixture.
- `taxonomyPicker.test.js` 6/6 standalone; all 13 formerly load-timeout venue
  files verified standalone and now pass under the completed full run.

## Prior in-flight notes (superseded)

- (In flight as of 2026-11-10 16:35 WAT) **run-6** — suite at `--test-concurrency=1`
  (single-child pipeline eliminating relay-drain starvation after runs 2-5 froze at
  4685/3970/2596/4602 across three concurrency settings), durable TMPDIR, fresh
  `:29127` fixture. Log: `server/test-logs/dri43-final6.log` (+ `.exit`). On
  completion the TAP summary replaces this section's citation; if run-6 also freezes,
  its last-active test file isolates the blockage and the evidence-based fallback gate
  applies (run-1 numbers + all standalone verifications + documented limitation).
- **Output-relay deadlock (ROOT-CAUSED 2026-11-10 ~15:50 WAT):** every node process the
  shell tool spawns runs at **nice +5**. Under heavy afternoon load (load avg 5→13,
  memory-pressure events), a nice-5 `node --test` parent cannot drain child stdout pipes
  fast enough; children block on full 64KB pipe buffers at 0% CPU, the log freezes
  mid-suite while the mongod keeps serving writes, and the run never completes. Hit by
  run-2, run-3 and run-4 at different positions (preserved as `dri43-run4-stalled.log`,
  `dri43-run3-stalled.log`); morning run-1 survived only because the box was lighter.
  Mitigation: launch the suite with **`--test-concurrency=6`** so fewer simultaneous
  children contend for the starved parent (run-5); changing niceness upward is not
  possible without root. A watcher can confirm a stall = `not-ok`/`^ok` count unchanged
  + mongod log still active + parent at 0% CPU.
- **Contention rule learned 2026-11-10: NEVER run two full suites in parallel on this
  box.** During the overlap window (13:08–13:44 WAT, two suites + shared mongod) sibling
  venue tests slowed from 72–115s solo to 140–243s, `venueCourses` timed out even at its
  raised 240s guard, and 24 timeout-cancellations accumulated
  (`server/test-logs/dri43-parallel-run-b.log`, no summary — killed under load; partial
  preserved also as `dri43-final-run5.log`). When a run hung (children at 0% CPU after
  the mid-suite mongod swap), killing and restarting the fixture per this doc was the
  recovery path.

## Robustness fixes applied (test files only)

- `venueCourses.mongo.test.js` + `venueReviewCorrections.mongo.test.js`: per-test
  timeout headroom raised for parallel-load conditions (`120s→240s`, `90s→240s`,
  `45s→120s`). These are hang-guards, not performance assertions; solo durations
  are 20–60s and the 3x multiplier only occurs when ~800 files share one mongod.
- `venuePrepRead.http.mongo.test.js`, `venuePreparation.mongo.test.js`,
  `venuePrintBridge.http.mongo.test.js`: same `120s→240s` headroom applied after
  run-1's timeout cancellations (edits, uncommitted; validated by verification runs).
- `merchantRecoveryRestore.mongo.test.js`: `mongorestore` now retries once against
  a freshly dropped target (with `--numParallelCollections=1`) because under load
  the shared replica transiently made it exit 1 with `--quiet` swallowing stderr;
  dump/restore failures now surface stderr in the error message.

