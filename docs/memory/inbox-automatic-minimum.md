# Inbox automatic minimum — 2026-10-12

Current cadence: automatic minimums refresh only at 00:00/12:00 Africa/Lagos
in the background. Inbox/page reads consume saved minimums. Earlier on-read
refresh below is superseded; see RESUME-minimum-refresh-cadence.md.

Main /notifications catches up automatic minimums before recipient stock alerts:
shared getPlan includeSales/updateMinimum, then stock scan reads persisted target.
Reuse local sales + posted net transfer out formula/persistence/cache; no client
minimum recalculation or guessed warehouse demand. Planning cache five minutes,
recipient cooldown one minute. Server-owned refresh is eligible for stock viewers
but demand/cost inputs remain private; no request overrides influence it.

minimumNoticeFields identifies a fresh active matching saved target. Alerts show
Automatic minimum stock, confidence and calculation date; stale/missing/ineligible
policy falls back transparently. Forecast source is asserted only for verified
active policy, since incomplete calculations can hold an older automatic target.

Handoff: docs/superpowers/specs/RESUME-inbox-automatic-minimum.md.
Existing minimum formula/configured floor/physical stock/prices are unchanged.

Verified after final source-label correction: backend 3,718 passed / five skipped;
admin 2,718 passed in 313 files. Types/lint/format/syntax/whitespace passed.
