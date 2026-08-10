# RESUME: a 1-D barcode on the employee badge

Written 2026-08-10. **ALL FOUR STEPS DONE the same day** — see "What shipped"
at the foot of this file. Kept for the reasoning, not as a to-do list.

---

## Prompt

> In `/Users/mac/Documents/drinksharbour`, the employee badge card only carries
> a QR code, so it cannot be read by a 1-D laser scanner. Make it scannable:
> auto-assign every employee a short badge number, and print a CODE_128 barcode
> on the badge alongside the QR.
>
> Step 1 of 4 is already done and uncommitted
> (`server/services/badgeNumber.helpers.js`). Read
> `docs/superpowers/specs/RESUME-badge-1d-barcode.md` first — it has the width
> arithmetic that drives every design decision, the invariants, and the
> baselines. TDD. Don't commit unless I ask.

---

## The constraint that decides everything

A CR80 card is **53.98mm × 85.6mm** with a **5mm** margin (`employee-badge.tsx`
around the jsPDF setup), so roughly **44mm of printable width**.

`qrPayload()` encodes `employeeProfile.attendance.rfidBadge` when set, otherwise
the employee's **24-character hex `_id`**. A QR does not care how long that is.
A 1-D barcode does:

| payload | CODE_128 encoding | modules | bar width over 44mm |
|---|---|---|---|
| 24-char ObjectId | Code Set B, 1 char/symbol | ~299 | **~0.15mm** ❌ |
| 8 digits | Code Set C, **2 digits/symbol** | ~79 | **~0.55mm** ✅ |

Entry-level laser scanners need about **0.19mm** (7.5 mil) and are usually
specified at **0.25mm** (10 mil). So the existing payload is not "tight", it is
**unreadable**, and no amount of layout work fixes it. This is why the work is
"assign a short number", not "draw a barcode".

**Digits are load-bearing, not cosmetic.** Code Set C packs a *pair* of digits
into one symbol but only one letter per symbol, so an 8-character alphanumeric
code prints twice as wide as an 8-digit one. If you change the alphabet, redo
the arithmetic before you change the layout.

---

## What is already done (uncommitted)

**`server/services/badgeNumber.helpers.js`** + `__tests__/badgeNumber.helpers.test.js`
— 10 tests, green. Exports `BADGE_NUMBER_LENGTH` (8), `generateBadgeNumber(random?)`,
`isBadgeNumber(v)`, `formatBadgeNumber(v)`.

Two decisions locked in with tests:

- **Digits only**, for the width reason above.
- **Random, not sequential.** The kiosk accepts a badge number **typed** as well
  as scanned, so the number *is* the credential. Sequential numbering would let
  anybody derive a colleague's badge from their own and clock in as them. Uses
  `crypto.randomInt`, not `Math.random`. First digit is 1–9 so the code cannot
  pick up a leading zero that a spreadsheet round trip would eat.
- `random` is injected purely so the collision-retry loop (step 2) can be tested
  without waiting for a one-in-ten-million coincidence.

---

## The four steps

**1. DONE** — the badge-number rule (above).

**2. Per-tenant uniqueness + assignment.**
   - A **compound partial index on `{tenant, 'employeeProfile.attendance.rfidBadge'}`**.
     **NOT a field-level `unique: true`** — see the invariant below, this has
     bitten this repo before.
   - Assign on employee create, with retry on duplicate key (that is what the
     injected `random` is for).
   - A backfill script for the **39 existing Wyn City employees**. Only fill
     where the field is empty — `isBadgeNumber()` exists to answer "is this one
     of ours", so a hand-entered `STAFF-0042` is never overwritten.

**3. A CODE_128 encoder as a pure util** (client side, `*-utils.ts`).
   Hand-rolled rather than adding `jsbarcode`: vitest here is
   `environment: 'node'` so a rendering dep cannot be tested, the admin build has
   already OOM'd once on dependency weight, and the algorithm is small and
   well-specified — Code Set B/C selection, **checksum mod 103**, stop pattern.
   One encoder feeds the on-screen card, the PDF and the tests, so they cannot
   drift. Worth testing against a known-good vector from the spec.

**4. Render it on the badge** — bars plus the human-readable number
   (`formatBadgeNumber` groups it `1234 5678`), in BOTH the on-screen card and
   the jsPDF output, alongside the existing QR.
   **The layout is the hard part:** photo + info table + QR (`const q = 20`mm) +
   barcode on a 53.98mm portrait card. The QR will probably have to shrink.
   Print a test card and scan it before calling this done.

---

## Invariants not to break

- **`rfidBadge` stays FREE TEXT.** A business with pre-printed cards puts its own
  numbering in it and that must keep working. `isBadgeNumber` returning false for
  `STAFF-0042` is the design, not a gap.
- **The clock lookup does not change.** `attendance.controller.js` matches
  `employeeProfile.attendance.rfidBadge` **exactly, first**, then falls back to
  `_id` when the scan `isObjectIdLike`. A generated number lands on the first
  branch with no server change.
- **Never a field-level `unique: true`.** Mongoose **never drops a de-declared
  index nor re-options an existing one**, and an old field-level unique here once
  enforced accidental GLOBAL uniqueness across tenants. Isolation in this repo is
  shared-DB row-level `tenant`, so uniqueness must be compound and per-tenant.
- **The kiosk needs no change.** `kiosk-scan-view.tsx` already lists `CODE_128,
  CODE_39, EAN_13, EAN_8, UPC_EAN_EXTENSION` alongside `QR_CODE`, and a USB laser
  wedge is a keyboard caught by the existing `pushScanKey` buffer — which
  **must keep ignoring modifier keys**, because Shift was truncating every
  uppercase badge.
- **Do not regress the double-punch guard** (`678b2abd`): server
  `MIN_PUNCH_INTERVAL_SECONDS=60` plus the client `SCAN_COOLDOWN_MS` deduped
  **by code**.
- `normaliseBadgeScan` deliberately trims only whitespace and null bytes —
  `rfidBadge` may legitimately contain spaces. Don't make it more opinionated.

---

## Baselines (measured 2026-08-10, with all current uncommitted work)

- **Server:** `node --test '__tests__/*.test.js'` from `server/` — **1860/1863**.
  The 3 failures are pre-existing (1 pricelist tenant-scope, 2 SO-number) and are
  not yours. `npm test` is broken.
- **Admin:** `npx vitest run` from `client/apps/admin` — **565/565**.
  `environment: 'node'`, **no jsdom, components cannot be rendered** — which is
  why every screen has a `*-utils.ts`.
- **Admin typecheck:** `./node_modules/.bin/tsc --noEmit` — **464** errors, all
  pre-existing. **Never `npx tsc`** — it installs a decoy `tsc@2.0.4` that prints
  "This is not the tsc command you are looking for" and exits 0.
- ESLint 9 cannot run in this repo at all (no flat config). Pre-existing.

## Files

- `server/services/badgeNumber.helpers.js` — done
- `server/models/User.js` — `employeeProfile.attendance.rfidBadge`, and where the
  compound index goes
- `server/services/employee.helpers.js` — where the profile payload maps `rfidBadge`
- `server/controllers/attendance.controller.js` — the badge lookup (read only;
  it should not need changing)
- `client/apps/admin/src/app/shared/employees/employee-badge.tsx` — `qrPayload()`,
  the jsPDF geometry, the on-screen `QRCodeCanvas` and the hidden hi-res one

---

## Also uncommitted from the same session, unrelated to this

Two other pieces of work are sitting in the tree. **Do not revert them**, and be
aware they are why the baselines above are higher than any older note:

1. **The kiosk crash fix** — `kiosk-scanner-utils.ts` + 21 tests. html5-qrcode's
   `stop()` throws a **string, synchronously**, escaping `.catch()/.finally()`
   and taking the page to the error boundary. Two of those tests run against the
   **real** library on purpose; don't delete them for being integration tests.
2. **Scheduling seam fixes** — `checkSwapShiftStillValid` (a stale swap rewrote
   two people's attendance history) and `unrosteredRecords` (punches whose shift
   was cancelled vanished off the history page while their minutes still
   counted).

## Open question for the user, still unanswered

`publishShifts` has no future-only constraint, so publishing a range covering
past days publishes past drafts — which immediately become ended-and-published
and are counted as **absences** for whoever is on them, though staff were never
told. A blanket "future only" would break publishing today's roster mid-day, so
it needs a policy decision rather than a guess.

---

## What shipped (2026-08-10, uncommitted)

All four steps, TDD. Server 1883/1886 (the same 3 pre-existing failures), admin
vitest 603/603, admin tsc 464 (baseline).

**2 — uniqueness + assignment.** `models/User.js` gained the compound partial
index `{tenant, employeeProfile.attendance.rfidBadge}`, unique, filtered to
`{$type: 'string', $gt: ''}` — the `$gt` keeps out any legacy `''`, which would
collide exactly the way a missing value does. `badgeNumber.helpers.js` grew
`assignBadgeNumber` (write, and redraw only on a duplicate-key error naming OUR
index — an email clash must NOT be retried), `needsBadgeNumber`,
`withBadgeNumber` and `carryOverBadgeNumber`. `employee.controller.js` issues a
number on create and answers 409 for a hand-entered duplicate.
`badgeNumber.index.test.js` pins the index SHAPE, so the field-level-unique
mistake fails a test rather than reaching a database.

**`carryOverBadgeNumber` is the non-obvious one.** The edit form full-replaces
the HR profile, so any submission omitting `rfidBadge` used to delete it — and
that number is on a card in somebody's pocket. An explicit value still wins,
because overwriting is how an employee moves onto a pre-printed card.

**3 — the encoder.** `barcode-utils.ts`, hand-rolled, 20 tests. The symbol table
is checked against three documented Code 128 invariants (six elements summing to
11, an even number of bar modules, no repeated pattern), and the module counts
in the table at the top of this file are now assertions: 79 for an 8-digit
badge, 299 for an ObjectId.

**Verified against a real decoder, not just its own arithmetic.** The generated
PDF card was rasterised at ~356 dpi and read back with zxing-cpp: `'19283746'`,
format Code 128. Both code sets round-tripped.

**4 — the card.** `badge-utils.ts` owns every decision (`badgePayload`,
`badgeBarcodeLayout`, `formatBadgeNumber`, `badgePdfLayout`); the component only
draws. Two things the layout work turned up, both caught by rendering the PDF
and looking at it:

- The card had **no vertical slack at all**, and the first attempt printed the
  human-readable number *underneath the footer band*. The block from the QR down
  is now anchored UP from the footer and the info rows absorb what is left —
  which is why `badgePdfLayout` takes a row count.
- The avatar disc is drawn AFTER the header text, so shrinking the header band
  made it **paint over "STAFF ID CARD"**. Now a tested invariant
  (`titleY < photo.y`).

The **BADGE / RFID info row is gone**: the number prints under the bars, grouped
and larger. Putting it back costs the barcode its height — there is a test.

`badgeBarcodeLayout` returns **null** for an employee with no badge number yet,
and the card then prints no bars at all. A 0.15mm barcode is worse than none: it
looks like it works, and fails at the kiosk at the start of somebody's shift.

### Still to do

- **Run the backfill** — `node scripts/backfill-employee-badge-numbers.js`
  (dry run) then `--apply`, for the 39 Wyn City employees. Never overwrites, so
  it is re-runnable. It calls `User.createIndexes()` first, which creates the
  new index and drops nothing.
- **Print a card and scan it with the actual shop scanner.** The decode above is
  a rasterised PDF, which proves the encoding and the geometry but not the
  printer or the scanner in the room.
