# Multi-role shift templates — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shift template describes a crew — 1 bartender-or-barback plus 2 servers-or-runners — and generating a range emits one open shift row per required position per worked day, each row accepting any of its position's roles.

**Architecture:** Purely additive. `ShiftTemplate` gains `positions: [{roles, count}]` and keeps `role` as the mirrored legacy/display field. `Shift` gains `altRoles` and `templatePosition`, both defaulting to empty/null so every shipped row is already valid. One normaliser, `templatePositions()`, is the only reader of `positions`, which is what lets a legacy template generate byte-identically to today. No migration script.

**Tech Stack:** Node/Express/Mongoose server (`node:test`, unit-only, no database), Next.js admin client (Vitest, `environment: 'node'`).

**Spec:** `docs/superpowers/specs/2026-08-12-multi-role-shift-templates-design.md`

## Global Constraints

- **Branch:** all work happens on `feat/multi-role-shift-templates`. `main` is not touched.
- **Commit at the end of each task. NEVER push.** The user's standing "don't commit" rule was lifted for this branch specifically, on 2026-08-12, so that per-task review and crash recovery have real commit ranges to work from. The branch stays local — `git push` is out of scope for every task in this plan. The user can squash, reset, or delete the branch afterwards.
- **Server tests:** `cd server && node --test '__tests__/*.test.js'`. Baseline **1973 pass / 1976 total, `# fail 3`**. The 3 are pre-existing (1 pricelist tenant-scope, 2 SO-number). **`npm test` is BROKEN — never use it.**
- **Admin tests:** `cd client/apps/admin && ./node_modules/.bin/vitest run`. Baseline **684/684**.
- **Admin types:** `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit`. Baseline **456 errors**, all pre-existing. **NEVER `npx tsc`** — it installs a decoy `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and exits 0, so a typecheck that verified nothing looks like a pass.
- **Admin tests cannot render components** — `environment: 'node'`, no jsdom. Every decision worth testing goes in a `*-utils.ts`.
- **Rules live in `server/services/*.helpers.js`, never a controller.** The server suite is unit-only with no database, so controller code is untested by construction.
- **`checkAssignment` is the ONE judge.** `judgeAssignments` and `planPatternFill` delegate to it and add no rules of their own.
- **`role_mismatch` stays the only member of `FORCEABLE_CODES`.**
- **`Shift.employee === null` = OPEN SHIFT.** Single nullable ref, one row per person per day. Do not revisit.
- **Creation never publishes.** Generated and filled rows are `draft`.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `server/models/ShiftTemplate.js` | `positions` subdocument array; `role` kept required | 1 |
| `server/models/Shift.js` | `altRoles`, `templatePosition` | 1 |
| `server/services/shift.helpers.js` | `templatePositions` normaliser; generation, judging, fill, payload changes | 1–5 |
| `server/controllers/shift.controller.js` | seat parsing, populate, `?role=` filter | 6 |
| `server/__tests__/shift.helpers.test.js` | planner + judge tests | 1–4 |
| `server/__tests__/shift.payloads.test.js` | payload builder tests | 5 |
| `client/apps/admin/src/app/shared/employees/shift-position-utils.ts` | **new** — all position arithmetic the UI needs | 7 |
| `client/apps/admin/src/app/shared/employees/shift-position-utils.test.ts` | **new** | 7 |
| `client/apps/admin/src/services/shift.service.ts` | types + fill seat payload | 8 |
| `client/apps/admin/src/app/(hydrogen)/employees/shifts/templates/page.tsx` | positions editor | 9 |
| `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx` | fill drawer position dropdown | 10 |

---

## Task 0: Establish the browser baseline before touching the fill drawer

`f91201bb` shipped the fill drawer and **it has never been opened in a browser.** Tasks 9 and 10 edit those same screens. Without a before-state, a bug you introduce and a bug already sitting there are indistinguishable.

**Files:** none — this task writes no code.

- [ ] **Step 1: Start the backend**

```bash
cd /Users/mac/Documents/drinksharbour/server && npm run dev
```

Expected: listening on `:5001`.

- [ ] **Step 2: Start the admin client**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && npm run dev
```

- [ ] **Step 3: Run the seven manual checks**

They are listed at the end of `docs/superpowers/plans/2026-08-12-shift-pattern-fill.md`. Work through all seven against the fill drawer, both entry points, and `fill-report-modal.tsx`.

- [ ] **Step 4: Write down the result**

Record each check as PASS or FAIL with what you saw, in your report back. **Do not fix anything you find** — a pre-existing bug is out of scope for this plan, and knowing it was already there is the entire point of this task. Report it and continue.

---

## Task 1: The `templatePositions` normaliser and the model fields

**Files:**
- Modify: `server/models/ShiftTemplate.js:25` (add `positions` beside `role`)
- Modify: `server/models/Shift.js:28` (add `altRoles`, `templatePosition`)
- Modify: `server/services/shift.helpers.js` (add `templatePositions`, export it)
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Produces: `templatePositions(template) -> Array<{_id: string|null, roles: string[], count: number}>`. Roles are id **strings** (already through `idOf`). `roles` is never empty in a returned entry. Returns `[]` only when the template has neither positions nor a role. Tasks 2 and 4 both consume it.

- [ ] **Step 1: Write the failing tests**

Add to `server/__tests__/shift.helpers.test.js`. Follow the file's existing `describe`/`it` style with `node:test` and `node:assert/strict`.

```js
describe('templatePositions', () => {
  it('normalises a legacy single-role template into one position of count 1', () => {
    const out = templatePositions({ role: 'r1' });
    assert.deepEqual(out, [{ _id: null, roles: ['r1'], count: 1 }]);
  });

  it('returns the template positions when it has them', () => {
    const out = templatePositions({
      role: 'r1',
      positions: [
        { _id: 'p1', roles: ['r1', 'r2'], count: 1 },
        { _id: 'p2', roles: ['r3'], count: 2 },
      ],
    });
    assert.deepEqual(out, [
      { _id: 'p1', roles: ['r1', 'r2'], count: 1 },
      { _id: 'p2', roles: ['r3'], count: 2 },
    ]);
  });

  it('drops a position with no roles rather than emitting a role-less shift', () => {
    const out = templatePositions({
      role: 'r1',
      positions: [{ _id: 'p1', roles: [], count: 3 }, { _id: 'p2', roles: ['r3'], count: 1 }],
    });
    assert.deepEqual(out, [{ _id: 'p2', roles: ['r3'], count: 1 }]);
  });

  it('floors a bad count to 1 rather than generating nothing', () => {
    const out = templatePositions({ positions: [{ _id: 'p1', roles: ['r1'], count: 0 }] });
    assert.equal(out[0].count, 1);
  });

  it('returns nothing for a template with neither positions nor a role', () => {
    assert.deepEqual(templatePositions({}), []);
  });
});
```

Add `templatePositions` to the destructured require at the top of the test file.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.helpers.test.js
```

Expected: FAIL — `templatePositions is not a function`.

- [ ] **Step 3: Implement the normaliser**

In `server/services/shift.helpers.js`, place it immediately **above** `planShiftGeneration` so it reads before its first caller:

```js
/**
 * A template's positions, with a legacy single-role template normalised into
 * one position of count 1.
 *
 * THE ONE READER of `positions` — every planner goes through it, exactly as
 * patternDates is the one reader of recurrence/cycleDays/anchorDate. A second
 * reader is how a template written before positions existed starts generating a
 * different roster from the one it has generated for months.
 *
 * A position with no roles is dropped rather than normalised: a shift nobody
 * can be checked against is the thing ShiftTemplate.role was made required to
 * prevent.
 *
 * @param {object} template
 * @returns {{_id: string|null, roles: string[], count: number}[]}
 */
function templatePositions(template) {
  const raw = Array.isArray(template?.positions) ? template.positions : [];
  const positions = raw
    .map((p) => ({
      _id: p?._id ? idOf(p._id) : null,
      roles: (Array.isArray(p?.roles) ? p.roles : []).map(idOf).filter(Boolean),
      count: Math.max(1, Math.floor(Number(p?.count)) || 1),
    }))
    .filter((p) => p.roles.length);

  if (positions.length) return positions;

  const role = template?.role ? idOf(template.role) : null;
  return role ? [{ _id: null, roles: [role], count: 1 }] : [];
}
```

Add `templatePositions,` to `module.exports`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.helpers.test.js
```

Expected: PASS, no new failures.

- [ ] **Step 5: Add the model fields**

In `server/models/ShiftTemplate.js`, immediately after the `role` field (line 25):

```js
    // The crew this shift needs: "1 bartender-or-barback, 2 servers". Each
    // entry generates `count` open rows a worked day, each accepting any of
    // `roles`. Empty means the legacy single-role shape, which
    // shift.helpers.templatePositions normalises to one position of count 1 —
    // that fallback is why no backfill was ever needed.
    //
    // The subdocument _id is LOAD-BEARING: it is the generation idempotency
    // handle, and it survives both reordering and edits to `roles`.
    positions: {
      type: [
        new Schema({
          roles: {
            type: [{ type: ObjectId, ref: 'EmployeeRole' }],
            validate: {
              validator: (v) => Array.isArray(v) && v.length > 0,
              message: 'A position must accept at least one role',
            },
          },
          count: { type: Number, min: 1, max: 20, default: 1 },
        }),
      ],
      default: [],
    },
```

Extend the `role` field's comment to record that it is now mirrored:

```js
    // What the shift needs someone to be able to do. Required: a shift nobody
    // is qualified for cannot be checked against an employee's capabilities.
    // Now also the DISPLAY role — mirrored from positions[0].roles[0] on save,
    // so TEMPLATE_POPULATE, the ?role= filter and the roster colour fallback
    // keep working unchanged.
    role: { type: ObjectId, ref: 'EmployeeRole', required: true },
```

In `server/models/Shift.js`, immediately after the `role` field (line 28):

```js
    // The other roles this shift accepts, beyond `role`. Empty = single-role,
    // which is what every row written before crews existed means — which is
    // why this could be added without touching a single existing document.
    // checkAssignment tests the INTERSECTION of [role, ...altRoles] against
    // what the employee holds.
    altRoles: { type: [{ type: ObjectId, ref: 'EmployeeRole' }], default: [] },
    // Which template position this row fills. Null for a hand-made shift and
    // for every row generated before positions existed. This is what makes the
    // generation idempotency key derivable from the row.
    templatePosition: { type: ObjectId, default: null },
```

- [ ] **Step 6: Run the whole server suite**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`** — the pre-existing 3, and nothing more. Total rises by the 5 new tests.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add server/models/ShiftTemplate.js server/models/Shift.js server/services/shift.helpers.js server/__tests__/shift.helpers.test.js
```

Then commit:

```bash
git commit -m "feat(scheduling): a shift template can describe a crew of positions"
```

---

## Task 2: Generation emits one row per position, and stays idempotent

This task carries the single largest regression risk in the plan.

**Files:**
- Modify: `server/services/shift.helpers.js:364-425` (`planShiftGeneration`)
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Consumes: `templatePositions` from Task 1.
- Produces: rows in `toCreate` now carry `templatePosition: string|null` and `altRoles: string[]` alongside the existing `template`/`date`/`employee`/`role`/`department`/`start`/`end`/`breakMinutes`/`status`. Entries in `skipped` may carry an extra `position: string|null`. Task 6 writes these rows straight to `Shift.insertMany`.

- [ ] **Step 1: Write the failing tests**

Add to `server/__tests__/shift.helpers.test.js`. Match the existing generation tests' fixture style — reuse the local helper they use to build a template if one exists, otherwise these literals are self-contained.

```js
describe('planShiftGeneration with positions', () => {
  const crew = {
    _id: 't1',
    name: 'Friday night',
    role: 'bartender',
    startTime: '18:00',
    endTime: '22:00',
    recurrence: 'weekly',
    daysOfWeek: [5], // Friday
    positions: [
      { _id: 'p1', roles: ['bartender', 'barback'], count: 1 },
      { _id: 'p2', roles: ['server', 'runner'], count: 2 },
    ],
  };
  const oneFriday = { from: '2026-08-14', to: '2026-08-14', offsetMinutes: 60 };

  it('emits one row per required position per worked day', () => {
    const { toCreate } = planShiftGeneration([crew], oneFriday);
    assert.equal(toCreate.length, 3);
    assert.deepEqual(
      toCreate.map((r) => r.role),
      ['bartender', 'server', 'server']
    );
    assert.deepEqual(toCreate[0].altRoles, ['barback']);
    assert.deepEqual(toCreate[1].altRoles, ['runner']);
    assert.deepEqual(
      toCreate.map((r) => r.templatePosition),
      ['p1', 'p2', 'p2']
    );
  });

  it('leaves every generated row open and draft', () => {
    const { toCreate } = planShiftGeneration([crew], oneFriday);
    assert.ok(toCreate.every((r) => r.employee === null));
    assert.ok(toCreate.every((r) => r.status === 'draft'));
  });

  // The idempotency guarantee, four ways.
  const generated = () =>
    planShiftGeneration([crew], oneFriday).toCreate.map((r) => ({
      template: 't1',
      templatePosition: r.templatePosition,
      start: r.start,
      status: 'draft',
    }));

  it('creates nothing on a re-run and reports every skip', () => {
    const { toCreate, skipped } = planShiftGeneration([crew], {
      ...oneFriday,
      existing: generated(),
    });
    assert.equal(toCreate.length, 0);
    assert.equal(skipped.length, 2); // one per position, not one per row
  });

  it('creates nothing after the positions are REORDERED', () => {
    const reordered = { ...crew, positions: [crew.positions[1], crew.positions[0]] };
    const { toCreate } = planShiftGeneration([reordered], {
      ...oneFriday,
      existing: generated(),
    });
    assert.equal(toCreate.length, 0);
  });

  it("creates nothing after a position's ROLES are edited", () => {
    // The regression templatePosition exists for. A key derived from the role
    // SET rekeys here and duplicates the whole already-generated range.
    const widened = {
      ...crew,
      positions: [
        { _id: 'p1', roles: ['bartender', 'barback', 'manager'], count: 1 },
        { _id: 'p2', roles: ['server', 'runner'], count: 2 },
      ],
    };
    const { toCreate } = planShiftGeneration([widened], {
      ...oneFriday,
      existing: generated(),
    });
    assert.equal(toCreate.length, 0);
  });

  it('tops up by exactly the difference when a count is raised', () => {
    const bigger = {
      ...crew,
      positions: [crew.positions[0], { _id: 'p2', roles: ['server', 'runner'], count: 3 }],
    };
    const { toCreate } = planShiftGeneration([bigger], {
      ...oneFriday,
      existing: generated(),
    });
    assert.equal(toCreate.length, 1);
    assert.equal(toCreate[0].templatePosition, 'p2');
  });

  it('ignores cancelled rows when counting what already exists', () => {
    const existing = generated().map((r) => ({ ...r, status: 'cancelled' }));
    const { toCreate } = planShiftGeneration([crew], { ...oneFriday, existing });
    assert.equal(toCreate.length, 3);
  });

  it('generates a legacy single-role template exactly as before', () => {
    const legacy = { ...crew, positions: [] };
    const { toCreate } = planShiftGeneration([legacy], oneFriday);
    assert.equal(toCreate.length, 1);
    assert.equal(toCreate[0].role, 'bartender');
    assert.deepEqual(toCreate[0].altRoles, []);
    assert.equal(toCreate[0].templatePosition, null);
  });

  it('suppresses a legacy template from a row written before positions existed', () => {
    const legacy = { ...crew, positions: [] };
    const before = planShiftGeneration([legacy], oneFriday).toCreate;
    const { toCreate } = planShiftGeneration([legacy], {
      ...oneFriday,
      existing: [{ template: 't1', start: before[0].start, status: 'draft' }], // no templatePosition
    });
    assert.equal(toCreate.length, 0);
  });

  it('skips a template with neither positions nor a role', () => {
    const roleless = { ...crew, role: null, positions: [] };
    const { toCreate, skipped } = planShiftGeneration([roleless], oneFriday);
    assert.equal(toCreate.length, 0);
    assert.match(skipped[0].reason, /role/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.helpers.test.js
```

Expected: FAIL — the first assertion reports `toCreate.length` is 1, not 3.

- [ ] **Step 3: Rewrite `planShiftGeneration`**

Replace the body of `planShiftGeneration` (`server/services/shift.helpers.js:364-425`) with:

```js
function planShiftGeneration(templates = [], opts = {}) {
  const { from, to, offsetMinutes = 60, existing = [] } = opts;
  const dates = eachDateInRange(from, to);

  // Key on template + exact start instant + POSITION, and COUNT rather than
  // flag. One template now emits a row per position per day, so
  // `template@start` alone is no longer unique and a boolean "taken" can no
  // longer express "2 of the 3 servers this slot wants already exist".
  //
  // The position's _id is the handle because it survives BOTH reordering and
  // edits to its roles. A key derived from the role SET survives reordering
  // only: widening "Server" to "Server OR Runner" would rekey every day
  // already generated, and the next run would duplicate the lot.
  //
  // A legacy template has no positions, so templatePositions hands back
  // _id: null, the key is `template@start@`, and both an old row (no
  // templatePosition field at all) and a new one land on it — which is what
  // makes generation of an untouched template byte-identical to before.
  const keyOf = (templateId, startMs, positionId) =>
    `${templateId}@${startMs}@${positionId || ''}`;

  const counts = new Map();
  for (const s of existing) {
    if (s.status === 'cancelled') continue;
    const key = keyOf(
      idOf(s.template),
      new Date(s.start).getTime(),
      s.templatePosition ? idOf(s.templatePosition) : ''
    );
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const toCreate = [];
  const skipped = [];

  for (const tpl of templates) {
    const plan = patternDates(tpl, dates);
    if (!plan.ok) {
      skipped.push({ template: plan.template, reason: plan.reason });
      continue;
    }
    const name = plan.template;

    const positions = templatePositions(tpl);
    if (!positions.length) {
      skipped.push({ template: name, reason: 'Template has no role to fill' });
      continue;
    }

    for (const date of plan.dates) {
      const endDayOffset = tpl.endDayOffset ?? 0;
      const window = shiftWindow(
        date,
        tpl.startTime,
        tpl.endTime,
        offsetMinutes,
        endDayOffset
      );
      if (!window) {
        skipped.push({ template: name, date, reason: 'Could not build a time window' });
        continue;
      }

      for (const pos of positions) {
        const key = keyOf(idOf(tpl._id), window.start.getTime(), pos._id);
        const have = counts.get(key) || 0;
        if (have >= pos.count) {
          skipped.push({
            template: name,
            date,
            position: pos._id,
            reason: 'A shift already exists for this slot',
          });
          continue;
        }

        for (let i = have; i < pos.count; i += 1) {
          toCreate.push({
            template: idOf(tpl._id),
            templatePosition: pos._id,
            date,
            employee: null, // open by design
            role: pos.roles[0], // the primary: colours and labels the row
            altRoles: pos.roles.slice(1),
            department: tpl.department ? idOf(tpl.department) : null,
            start: window.start,
            end: window.end,
            breakMinutes: Number(tpl.breakMinutes) || 0,
            status: 'draft',
          });
        }
        counts.set(key, pos.count);
      }
    }
  }

  return { toCreate, skipped };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.helpers.test.js
```

Expected: PASS. **Every pre-existing generation test in this file must still pass** — they are the proof a legacy template is unaffected. If one fails, the legacy fallback is wrong; fix it rather than editing the old test.

- [ ] **Step 5: Run the whole server suite**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add server/services/shift.helpers.js server/__tests__/shift.helpers.test.js
```

Then commit:

```bash
git commit -m "feat(scheduling): generate one open shift per crew position, idempotently"
```

---

## Task 3: `checkAssignment` accepts any of a shift's roles

**Files:**
- Modify: `server/services/shift.helpers.js:677-691`
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Consumes: `shift.altRoles` from Task 2's rows.
- Produces: no signature change. `checkAssignment(shift, employee, {shifts, timeOff, force})` still returns `{ok: true, warnings}` or `{ok: false, code, message, conflicts?}`.

- [ ] **Step 1: Write the failing tests**

```js
describe('checkAssignment with several acceptable roles', () => {
  const worker = (roles) => ({
    _id: 'e1',
    status: 'active',
    employeeProfile: { planning: { roles } },
  });
  const slot = {
    role: 'bartender',
    altRoles: ['barback'],
    start: new Date('2026-08-14T17:00:00Z'),
    end: new Date('2026-08-14T21:00:00Z'),
  };

  it('accepts someone who holds only the alternative role', () => {
    const v = checkAssignment(slot, worker(['barback']), { shifts: [], timeOff: [] });
    assert.equal(v.ok, true);
    assert.deepEqual(v.warnings, []);
  });

  it('accepts someone who holds the primary role', () => {
    assert.equal(
      checkAssignment(slot, worker(['bartender']), { shifts: [], timeOff: [] }).ok,
      true
    );
  });

  it('refuses someone who holds neither, and the refusal stays forceable', () => {
    const v = checkAssignment(slot, worker(['chef']), { shifts: [], timeOff: [] });
    assert.equal(v.ok, false);
    assert.equal(v.code, 'role_mismatch');
    assert.equal(FORCEABLE_CODES.has(v.code), true);
  });

  it('lets an admin force past it, with a warning', () => {
    const v = checkAssignment(slot, worker(['chef']), {
      shifts: [],
      timeOff: [],
      force: true,
    });
    assert.equal(v.ok, true);
    assert.equal(v.warnings[0].code, 'role_mismatch');
  });

  it('behaves exactly as before when altRoles is absent', () => {
    const single = { ...slot, altRoles: undefined };
    assert.equal(checkAssignment(single, worker(['bartender']), { shifts: [], timeOff: [] }).ok, true);
    assert.equal(checkAssignment(single, worker(['barback']), { shifts: [], timeOff: [] }).code, 'role_mismatch');
  });

  it('still reports an overlap ahead of the role check', () => {
    const v = checkAssignment(slot, worker(['chef']), {
      shifts: [
        {
          _id: 's9',
          employee: 'e1',
          status: 'draft',
          start: new Date('2026-08-14T16:00:00Z'),
          end: new Date('2026-08-14T20:00:00Z'),
        },
      ],
      timeOff: [],
    });
    assert.equal(v.code, 'overlap');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.helpers.test.js
```

Expected: FAIL — the first test reports `role_mismatch` for a barback.

- [ ] **Step 3: Replace the role check**

At `server/services/shift.helpers.js:677`, replace:

```js
  const held = (employee.employeeProfile?.planning?.roles || []).map(idOf);
  const required = idOf(shift.role);
  if (required && !held.includes(required)) {
    if (!force) {
      return {
        ok: false,
        code: 'role_mismatch',
        message: 'This employee is not marked as able to work that role',
      };
    }
    warnings.push({
      code: 'role_mismatch',
      message: 'Assigned to a role this employee is not marked for',
    });
  }
```

with:

```js
  // A shift generated from a crew position accepts several roles — "bartender
  // OR barback" — so the test is whether the sets INTERSECT, not whether one
  // id matches. With altRoles empty this is the old `held.includes(required)`
  // exactly, which is what keeps every shift written before crews existed
  // judged the way it has always been judged.
  const held = new Set((employee.employeeProfile?.planning?.roles || []).map(idOf));
  const accepted = [idOf(shift.role), ...(shift.altRoles || []).map(idOf)].filter(Boolean);
  if (accepted.length && !accepted.some((r) => held.has(r))) {
    const what = accepted.length > 1 ? 'any of the roles this shift accepts' : 'that role';
    if (!force) {
      return {
        ok: false,
        code: 'role_mismatch',
        message: `This employee is not marked as able to work ${what}`,
      };
    }
    warnings.push({
      code: 'role_mismatch',
      message: 'Assigned to a role this employee is not marked for',
    });
  }
```

`role_mismatch` stays the only forceable code — `FORCEABLE_CODES` is not touched.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.helpers.test.js
```

Expected: PASS.

- [ ] **Step 5: Run the whole server suite**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**. If an existing test asserted the old message string verbatim, update that assertion — the single-role message is unchanged (`"…able to work that role"`), so this should not happen.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add server/services/shift.helpers.js server/__tests__/shift.helpers.test.js
```

Then commit:

```bash
git commit -m "feat(scheduling): a shift may accept any of several roles"
```

---

## Task 4: Pattern fill takes explicit seats

**Files:**
- Modify: `server/services/shift.helpers.js:450-575` (`planPatternFill`)
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Consumes: `templatePositions` (Task 1), `checkAssignment` (Task 3).
- Produces: `planPatternFill(template, seats, opts)` where each `seats` entry is either a **User doc** (legacy, mapped to the template's sole position) or `{employee: <User doc>, position: <positionId|null>}`. Return shape is unchanged: `{toCreate, skipped}`. Rows gain `templatePosition` and `altRoles`. A new skip `code: 'position_full'` with `forceable: false`.

- [ ] **Step 1: Write the failing tests**

```js
describe('planPatternFill with crew positions', () => {
  const crew = {
    _id: 't1',
    name: 'Friday night',
    role: 'bartender',
    startTime: '18:00',
    endTime: '22:00',
    recurrence: 'weekly',
    daysOfWeek: [5],
    positions: [
      { _id: 'p1', roles: ['bartender', 'barback'], count: 1 },
      { _id: 'p2', roles: ['server', 'runner'], count: 2 },
    ],
  };
  const oneFriday = { from: '2026-08-14', to: '2026-08-14', offsetMinutes: 60 };
  const person = (id, roles) => ({
    _id: id,
    firstName: id,
    lastName: 'Test',
    status: 'active',
    employeeProfile: { planning: { roles } },
  });

  it('seats each person on the position they were given', () => {
    const seats = [
      { employee: person('ada', ['bartender']), position: 'p1' },
      { employee: person('ben', ['server']), position: 'p2' },
      { employee: person('cid', ['runner']), position: 'p2' },
    ];
    const { toCreate, skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(skipped.length, 0);
    assert.equal(toCreate.length, 3);
    assert.deepEqual(
      toCreate.map((r) => [r.employee, r.templatePosition, r.role]),
      [
        ['ada', 'p1', 'bartender'],
        ['ben', 'p2', 'server'],
        ['cid', 'p2', 'server'],
      ]
    );
    assert.deepEqual(toCreate[2].altRoles, ['runner']);
  });

  it('accepts someone who holds only the position alternative role', () => {
    const seats = [{ employee: person('cid', ['runner']), position: 'p2' }];
    const { toCreate, skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(skipped.length, 0);
    assert.equal(toCreate.length, 1);
  });

  it('refuses a seat on a position that is already full', () => {
    const seats = [
      { employee: person('ada', ['bartender']), position: 'p1' },
      { employee: person('ben', ['barback']), position: 'p1' },
    ];
    const { toCreate, skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(toCreate.length, 1);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].code, 'position_full');
    assert.equal(skipped[0].forceable, false);
    assert.equal(skipped[0].employee, 'ben');
  });

  it('counts rows already on the position toward the cap', () => {
    const seats = [{ employee: person('ada', ['bartender']), position: 'p1' }];
    const start = planPatternFill(crew, seats, oneFriday).toCreate[0].start;
    const { toCreate, skipped } = planPatternFill(crew, seats, {
      ...oneFriday,
      existing: [
        { template: 't1', templatePosition: 'p1', employee: 'zoe', start, status: 'draft' },
      ],
    });
    assert.equal(toCreate.length, 0);
    assert.equal(skipped[0].code, 'position_full');
  });

  it('still refuses someone qualified for no role on the position', () => {
    const seats = [{ employee: person('dee', ['chef']), position: 'p2' }];
    const { skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(skipped[0].code, 'role_mismatch');
    assert.equal(skipped[0].forceable, true);
  });

  it('accepts a bare employee doc against a legacy single-position template', () => {
    const legacy = { ...crew, positions: [] };
    const { toCreate, skipped } = planPatternFill(
      legacy,
      [person('ada', ['bartender'])],
      oneFriday
    );
    assert.equal(skipped.length, 0);
    assert.equal(toCreate.length, 1);
    assert.equal(toCreate[0].templatePosition, null);
    assert.deepEqual(toCreate[0].altRoles, []);
  });

  it('skips a seat naming a position the template does not have', () => {
    const seats = [{ employee: person('ada', ['bartender']), position: 'nope' }];
    const { toCreate, skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(toCreate.length, 0);
    assert.match(skipped[0].reason, /position/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.helpers.test.js
```

Expected: FAIL — seats are read as User docs, so `employee._id` is `undefined`.

- [ ] **Step 3: Normalise seats at the top of `planPatternFill`**

Immediately **above** `planPatternFill`, add:

```js
/**
 * Seats for a fill: who is going on the pattern, and in which position.
 *
 * Accepts a bare User doc as well as {employee, position}, because
 * POST /api/shifts/fill shipped in f91201bb taking a flat list of employee ids
 * and that contract must keep working. A bare entry takes the template's sole
 * position, or null when the template is a legacy single-role one.
 *
 * @param {object[]} entries
 * @param {{_id: string|null}[]} positions - from templatePositions
 * @returns {{employee: object, position: string|null}[]}
 */
function normaliseSeats(entries = [], positions = []) {
  const sole = positions.length === 1 ? positions[0]._id : null;
  return entries.filter(Boolean).map((entry) => {
    const isSeat = entry.employee !== undefined;
    return {
      employee: isSeat ? entry.employee : entry,
      position: isSeat ? (entry.position ? idOf(entry.position) : sole) : sole,
    };
  });
}
```

Add `normaliseSeats,` to `module.exports`.

- [ ] **Step 4: Rewrite the body of `planPatternFill`**

Keep the existing doc comment and its "SKIPS RATHER THAN REFUSING … THIS DIVERGENCE IS DELIBERATE" paragraph verbatim — it is load-bearing. Change the parameter name from `employees` to `seatEntries`, and replace the body from the `taken` set down to the return with:

```js
  const positions = templatePositions(template);
  if (!positions.length) {
    return {
      toCreate: [],
      skipped: [{ template: plan.template, reason: 'Template has no role to fill' }],
    };
  }
  const byPosition = new Map(positions.map((p) => [p._id, p]));
  const seats = normaliseSeats(seatEntries, positions);

  // Three-part key, unchanged. Two people's shifts from one template on one day
  // are two different rows, which `template@start` alone cannot express. An
  // open row from /generate keys as `template@start@` and so never collides
  // with a person's row.
  const taken = new Set(
    existing
      .filter((s) => s.status !== 'cancelled')
      .map(
        (s) =>
          `${idOf(s.template)}@${new Date(s.start).getTime()}@${idOf(s.employee)}`
      )
  );

  // How full each position already is, per instant. ONE cap in ONE place: the
  // same want-vs-have arithmetic planShiftGeneration does, so a night cannot be
  // staffed past its count from either entry point.
  const filled = new Map();
  const fillKey = (startMs, positionId) =>
    `${idOf(template._id)}@${startMs}@${positionId || ''}`;
  for (const s of existing) {
    if (s.status === 'cancelled') continue;
    const key = fillKey(
      new Date(s.start).getTime(),
      s.templatePosition ? idOf(s.templatePosition) : ''
    );
    filled.set(key, (filled.get(key) || 0) + 1);
  }

  // A MUTABLE copy of each person's shifts, so a row planned earlier in this
  // batch is a conflict for the rows planned after it. Without this a template
  // with endDayOffset >= 1 would write overlapping shifts for one person on
  // consecutive worked days — neither exists in the database yet when the other
  // is judged, and checkAssignment only sees the context it is handed.
  const batchShifts = new Map();
  for (const seat of seats) {
    const id = idOf(seat.employee?._id);
    batchShifts.set(id, [...contextFor(ctxById, id).shifts]);
  }

  const toCreate = [];
  const skipped = [];
  const endDayOffset = template.endDayOffset ?? 0;

  for (const date of plan.dates) {
    const window = shiftWindow(
      date,
      template.startTime,
      template.endTime,
      offsetMinutes,
      endDayOffset
    );
    if (!window) {
      skipped.push({ template: plan.template, date, reason: 'Could not build a time window' });
      continue;
    }

    for (const seat of seats) {
      const employee = seat.employee;
      const id = idOf(employee?._id);
      const name = employeeLabel(employee);

      const pos = byPosition.get(seat.position);
      if (!pos) {
        skipped.push({
          employee: id,
          name,
          date,
          code: 'no_position',
          reason: 'That position is not on this shift pattern',
          forceable: false,
        });
        continue;
      }

      const key = `${idOf(template._id)}@${window.start.getTime()}@${id}`;
      if (taken.has(key)) {
        skipped.push({
          employee: id,
          name,
          date,
          code: 'exists',
          reason: 'A shift already exists for this slot',
          forceable: false,
        });
        continue;
      }

      const capKey = fillKey(window.start.getTime(), pos._id);
      if ((filled.get(capKey) || 0) >= pos.count) {
        skipped.push({
          employee: id,
          name,
          date,
          code: 'position_full',
          reason: `That position is already filled ${pos.count} time${pos.count === 1 ? '' : 's'} — raise its count to add another`,
          forceable: false,
        });
        continue;
      }

      const candidate = {
        role: pos.roles[0],
        altRoles: pos.roles.slice(1),
        start: window.start,
        end: window.end,
      };

      const verdict = checkAssignment(candidate, employee, {
        shifts: batchShifts.get(id) || [],
        timeOff: contextFor(ctxById, id).timeOff,
        force,
      });

      if (!verdict.ok) {
        skipped.push({
          employee: id,
          name,
          date,
          code: verdict.code,
          reason: verdict.message,
          forceable: FORCEABLE_CODES.has(verdict.code),
        });
        continue;
      }

      taken.add(key);
      filled.set(capKey, (filled.get(capKey) || 0) + 1);
      toCreate.push({
        template: idOf(template._id),
        templatePosition: pos._id,
        date,
        employee: id,
        role: pos.roles[0],
        altRoles: pos.roles.slice(1),
        department: template.department ? idOf(template.department) : null,
        start: window.start,
        end: window.end,
        breakMinutes: Number(template.breakMinutes) || 0,
        status: 'draft',
      });

      // Feed this date's slot back so the NEXT date is judged against it —
      // only rows actually planned become conflicts, because a skipped day
      // leaves no shift behind. A template with endDayOffset >= 1 chains its
      // worked days end-to-start; the day after must be judged against the
      // day before's WRITTEN row, not a phantom slot that was never created.
      batchShifts.get(id).push({
        _id: null,
        employee: id,
        status: 'draft',
        start: window.start,
        end: window.end,
      });
    }
  }

  return { toCreate, skipped };
```

Update the JSDoc `@param` from `employees` to `seatEntries` and describe the two accepted shapes.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.helpers.test.js
```

Expected: PASS. **All of `f91201bb`'s existing fill tests must still pass** — the cross-midnight chain, the batch-conflict set, and the skipped-day-leaves-no-phantom behaviour are exactly what the legacy bare-doc path protects.

- [ ] **Step 6: Run the whole server suite**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add server/services/shift.helpers.js server/__tests__/shift.helpers.test.js
```

Then commit:

```bash
git commit -m "feat(scheduling): fill a pattern by seating people into crew positions"
```

---

## Task 5: Payload builders validate positions

**Files:**
- Modify: `server/services/shift.helpers.js:924-950` (`buildShiftTemplatePayload`)
- Modify: `server/services/shift.helpers.js:1041-1060` (`buildShiftPayload`)
- Test: `server/__tests__/shift.payloads.test.js`

**Interfaces:**
- Produces: `buildShiftTemplatePayload` may now set `value.positions` and always mirrors `value.role` from `positions[0].roles[0]` when positions are supplied. `buildShiftPayload` may now set `value.altRoles` and `value.templatePosition`.

- [ ] **Step 1: Write the failing tests**

Add to `server/__tests__/shift.payloads.test.js`, matching its existing style:

```js
describe('buildShiftTemplatePayload with positions', () => {
  const base = {
    name: 'Friday night',
    startTime: '18:00',
    endTime: '22:00',
    daysOfWeek: [5],
  };
  const oid = (n) => `5f${'0'.repeat(20)}${String(n).padStart(2, '0')}`;

  it('accepts positions and mirrors role from the first one', () => {
    const out = buildShiftTemplatePayload({
      ...base,
      positions: [
        { roles: [oid(1), oid(2)], count: 1 },
        { roles: [oid(3)], count: 2 },
      ],
    });
    assert.equal(out.ok, true);
    assert.equal(out.value.role, oid(1));
    assert.equal(out.value.positions.length, 2);
    assert.equal(out.value.positions[1].count, 2);
  });

  it('rejects a position with no roles', () => {
    const out = buildShiftTemplatePayload({ ...base, positions: [{ roles: [], count: 1 }] });
    assert.equal(out.ok, false);
    assert.match(out.message, /at least one role/i);
  });

  it('rejects a position role that is not an id', () => {
    const out = buildShiftTemplatePayload({ ...base, positions: [{ roles: ['nope'], count: 1 }] });
    assert.equal(out.ok, false);
    assert.match(out.message, /valid id/i);
  });

  it('rejects a count outside 1..20', () => {
    const out = buildShiftTemplatePayload({ ...base, positions: [{ roles: [oid(1)], count: 0 }] });
    assert.equal(out.ok, false);
    assert.match(out.message, /count/i);
  });

  it('still refuses a template with neither positions nor a role', () => {
    const out = buildShiftTemplatePayload(base);
    assert.equal(out.ok, false);
    assert.equal(out.message, 'A template must require a role');
  });

  it('still accepts a legacy single-role body', () => {
    const out = buildShiftTemplatePayload({ ...base, role: oid(1) });
    assert.equal(out.ok, true);
    assert.equal(out.value.role, oid(1));
  });
});

describe('buildShiftPayload with altRoles', () => {
  const oid = (n) => `5f${'0'.repeat(20)}${String(n).padStart(2, '0')}`;
  const base = {
    role: oid(1),
    start: '2026-08-14T17:00:00.000Z',
    end: '2026-08-14T21:00:00.000Z',
  };

  it('accepts altRoles', () => {
    const out = buildShiftPayload({ ...base, altRoles: [oid(2)] });
    assert.equal(out.ok, true);
    assert.deepEqual(out.value.altRoles, [oid(2)]);
  });

  it('rejects an altRole that is not an id', () => {
    const out = buildShiftPayload({ ...base, altRoles: ['nope'] });
    assert.equal(out.ok, false);
    assert.match(out.message, /valid id/i);
  });

  it('still refuses a shift with no role', () => {
    const out = buildShiftPayload({ start: base.start, end: base.end });
    assert.equal(out.ok, false);
    assert.equal(out.message, 'A shift must require a role');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.payloads.test.js
```

Expected: FAIL — `out.value.positions` is `undefined`.

- [ ] **Step 3: Add positions handling to `buildShiftTemplatePayload`**

In `server/services/shift.helpers.js`, replace the role block at line 937 with:

```js
  // Positions first: when a body supplies them they are the source of truth,
  // and `role` is MIRRORED from the first so TEMPLATE_POPULATE, the ?role=
  // filter and the roster colour fallback keep working untouched.
  let mirroredRole = null;
  if (body.positions !== undefined) {
    if (!Array.isArray(body.positions)) {
      return { ok: false, message: 'positions must be a list' };
    }
    const positions = [];
    for (const raw of body.positions) {
      const roles = [];
      for (const r of Array.isArray(raw?.roles) ? raw.roles : []) {
        const ref = refField(r);
        if (ref.bad || !ref.value) return { ok: false, message: 'role must be a valid id' };
        if (!roles.includes(ref.value)) roles.push(ref.value);
      }
      if (!roles.length) {
        return { ok: false, message: 'Each position must accept at least one role' };
      }
      const count = Number(raw?.count ?? 1);
      if (!Number.isFinite(count) || count < 1 || count > 20 || Math.floor(count) !== count) {
        return { ok: false, message: 'A position count must be a whole number from 1 to 20' };
      }
      positions.push({ roles, count });
    }
    value.positions = positions;
    mirroredRole = positions.length ? positions[0].roles[0] : null;
  }

  // A shift exists to be filled by someone qualified, so the role it needs is
  // the one ref that is never optional.
  const role = refField(body.role);
  if (role.bad) return { ok: false, message: 'role must be a valid id' };
  if (mirroredRole) {
    value.role = mirroredRole;
  } else if (!role.skip) {
    if (!role.value) return { ok: false, message: 'A template must require a role' };
    value.role = role.value;
  } else if (!isUpdate) {
    return { ok: false, message: 'A template must require a role' };
  }
```

Note: preserving an existing `_id` on update is handled by the controller in Task 6 — this builder only validates the shape.

- [ ] **Step 4: Add `altRoles` and `templatePosition` to `buildShiftPayload`**

At `server/services/shift.helpers.js:1051`, after the existing `role` block, add:

```js
  if (body.altRoles !== undefined) {
    if (!Array.isArray(body.altRoles)) {
      return { ok: false, message: 'altRoles must be a list' };
    }
    const alt = [];
    for (const r of body.altRoles) {
      const ref = refField(r);
      if (ref.bad || !ref.value) return { ok: false, message: 'role must be a valid id' };
      if (!alt.includes(ref.value)) alt.push(ref.value);
    }
    value.altRoles = alt;
  }

  const position = refField(body.templatePosition);
  if (position.bad) return { ok: false, message: 'templatePosition must be a valid id' };
  if (!position.skip) value.templatePosition = position.value;
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test __tests__/shift.payloads.test.js
```

Expected: PASS.

- [ ] **Step 6: Run the whole server suite**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add server/services/shift.helpers.js server/__tests__/shift.payloads.test.js
```

Then commit:

```bash
git commit -m "feat(scheduling): validate crew positions on the template payload"
```

---

## Task 6: Controller wiring

No new rules here — the controller only moves data. Everything it does is already covered by Tasks 1–5's unit tests.

**Files:**
- Modify: `server/controllers/shift.controller.js:57-62` (`SHIFT_POPULATE`)
- Modify: `server/controllers/shift.controller.js:361` (`?role=` shift filter)
- Modify: `server/controllers/shift.controller.js:852-900` (`fillPattern` seat parsing)

- [ ] **Step 1: Populate the alternative roles**

At `server/controllers/shift.controller.js:57`:

```js
const SHIFT_POPULATE = [
  { path: 'employee', select: 'firstName lastName email avatar' },
  { path: 'role', select: 'name color' },
  { path: 'altRoles', select: 'name color' },
  { path: 'department', select: 'name color' },
  { path: 'template', select: 'name color' },
];
```

Add `{ path: 'positions.roles', select: 'name color' }` to `TEMPLATE_POPULATE` at line 52.

- [ ] **Step 2: Make the `?role=` shift filter match an alternative too**

At `server/controllers/shift.controller.js:361`, replace:

```js
  if (isObjectIdLike(req.query.role)) filter.role = req.query.role;
```

with:

```js
  // "Show me the server shifts" must find a shift that accepts server as an
  // alternative, not only one where server is the primary.
  if (isObjectIdLike(req.query.role)) {
    filter.$or = [{ role: req.query.role }, { altRoles: req.query.role }];
  }
```

Leave line 184 (the **template** filter) alone — a template's `role` is mirrored from its first position, and templates are listed by their primary.

- [ ] **Step 3: Accept seats in `fillPattern`**

At `server/controllers/shift.controller.js:862`, replace the employee id parsing:

```js
  const employeeIds = Array.isArray(req.body.employees)
    ? [...new Set(req.body.employees.filter(isObjectIdLike).map(String))]
    : [];
  if (!employeeIds.length) {
    return badRequest(res, 'Choose at least one employee to put on this pattern');
  }
```

with:

```js
  // Seats: {employee, position}. A bare id is still accepted — f91201bb shipped
  // this endpoint taking a flat list and planPatternFill.normaliseSeats maps a
  // bare entry onto the template's sole position.
  const rawSeats = Array.isArray(req.body.employees) ? req.body.employees : [];
  const seatSpecs = [];
  const seen = new Set();
  for (const raw of rawSeats) {
    const employeeId = isObjectIdLike(raw) ? String(raw) : String(raw?.employee ?? '');
    if (!isObjectIdLike(employeeId) || seen.has(employeeId)) continue;
    seen.add(employeeId);
    const position = isObjectIdLike(raw?.position) ? String(raw.position) : null;
    seatSpecs.push({ employeeId, position });
  }
  const employeeIds = seatSpecs.map((s) => s.employeeId);
  if (!employeeIds.length) {
    return badRequest(res, 'Choose at least one employee to put on this pattern');
  }
```

Then where the loaded employee docs are handed to `planPatternFill`, build seats instead of passing the docs directly:

```js
  const employeeById = new Map(employees.map((e) => [String(e._id), e]));
  const seats = seatSpecs
    .filter((s) => employeeById.has(s.employeeId))
    .map((s) => ({ employee: employeeById.get(s.employeeId), position: s.position }));

  const { toCreate, skipped } = planPatternFill(template, seats, { …existing opts… });
```

Leave the `MAX_FILL_ROWS` guard exactly as it is — it counts `employeeIds.length * workedDays`, which is still the right bound.

- [ ] **Step 4: Preserve position `_id`s on template update**

In the template update handler, a `$set` of `positions` replaces the array and **Mongoose mints new subdocument `_id`s**, which would orphan every generated row and duplicate the roster on the next generate. Carry existing ids across by index-independent match on the role set, falling back to a new id:

```js
  // Positions carry the generation idempotency handle, so an edit must KEEP
  // the _id of a position that is still recognisably the same one. Losing it
  // silently re-generates the whole range as duplicates.
  if (built.value.positions) {
    const current = await ShiftTemplate.findOne({ tenant: tenantId, _id: req.params.id })
      .select('positions')
      .lean();
    const byIndex = current?.positions || [];
    built.value.positions = built.value.positions.map((p, i) =>
      byIndex[i]?._id ? { ...p, _id: byIndex[i]._id } : p
    );
  }
```

Positions are matched **by index**: the editor in Task 9 keeps rows stable and never reorders them behind the user's back, and an admin who deliberately reorders accepts that the rows follow the slot, not the label.

- [ ] **Step 5: Run the whole server suite**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**. (Controller code is not unit tested here by design — the suite is proving Tasks 1–5 still hold.)

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add server/controllers/shift.controller.js
```

Then commit:

```bash
git commit -m "feat(scheduling): carry crew positions through the shift endpoints"
```

---

## Task 7: `shift-position-utils.ts` — all the arithmetic the UI needs

Admin tests run `environment: 'node'` with no jsdom, so **components cannot be rendered**. Every decision worth testing lives here and the components stay dumb.

**Files:**
- Create: `client/apps/admin/src/app/shared/employees/shift-position-utils.ts`
- Create: `client/apps/admin/src/app/shared/employees/shift-position-utils.test.ts`

**Interfaces:**
- Produces: `templatePositions(t)`, `positionLabel(p, roleNames)`, `remainingForPosition(p, seats)`, `seatOptions(t, seats, roleNames)`. Task 9 and Task 10 consume all four.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  templatePositions,
  positionLabel,
  remainingForPosition,
  seatOptions,
} from './shift-position-utils';

const roleNames = new Map([
  ['r1', 'Bartender'],
  ['r2', 'Barback'],
  ['r3', 'Server'],
]);

const crew = {
  role: 'r1',
  positions: [
    { _id: 'p1', roles: ['r1', 'r2'], count: 1 },
    { _id: 'p2', roles: ['r3'], count: 2 },
  ],
} as never;

describe('templatePositions', () => {
  it('normalises a legacy single-role template', () => {
    expect(templatePositions({ role: 'r1', positions: [] } as never)).toEqual([
      { _id: null, roles: ['r1'], count: 1 },
    ]);
  });

  it('passes real positions through', () => {
    expect(templatePositions(crew)).toHaveLength(2);
  });
});

describe('positionLabel', () => {
  it('names a single role with its count', () => {
    expect(positionLabel({ _id: 'p2', roles: ['r3'], count: 2 }, roleNames)).toBe('Server ×2');
  });

  it('joins alternatives with "or" and omits a count of one', () => {
    expect(positionLabel({ _id: 'p1', roles: ['r1', 'r2'], count: 1 }, roleNames)).toBe(
      'Bartender or Barback'
    );
  });

  it('falls back for a role that has been deleted', () => {
    expect(positionLabel({ _id: 'p9', roles: ['gone'], count: 1 }, roleNames)).toBe('Role removed');
  });
});

describe('remainingForPosition', () => {
  const positions = templatePositions(crew);

  it('is the full count when nobody is seated', () => {
    expect(remainingForPosition(positions[1], [])).toBe(2);
  });

  it('drops by one per seat already taken', () => {
    expect(remainingForPosition(positions[1], [{ employee: 'a', position: 'p2' }])).toBe(1);
  });

  it('never goes below zero', () => {
    const seats = [
      { employee: 'a', position: 'p1' },
      { employee: 'b', position: 'p1' },
    ];
    expect(remainingForPosition(positions[0], seats)).toBe(0);
  });
});

describe('seatOptions', () => {
  it('shows what is left against each position', () => {
    const out = seatOptions(crew, [{ employee: 'a', position: 'p2' }], roleNames);
    expect(out).toEqual([
      { value: 'p1', label: 'Bartender or Barback', remaining: 1, full: false },
      { value: 'p2', label: 'Server ×2 (1 left)', remaining: 1, full: false },
    ]);
  });

  it('marks a position full rather than hiding it', () => {
    const out = seatOptions(crew, [{ employee: 'a', position: 'p1' }], roleNames);
    expect(out[0]).toEqual({
      value: 'p1',
      label: 'Bartender or Barback (full)',
      remaining: 0,
      full: true,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && ./node_modules/.bin/vitest run src/app/shared/employees/shift-position-utils.test.ts
```

Expected: FAIL — cannot resolve `./shift-position-utils`.

- [ ] **Step 3: Write the module**

```ts
// shift-position-utils.ts — the arithmetic behind a shift template's crew.
//
// A template says "1 bartender-or-barback, 2 servers". Generating a range emits
// one open shift per required position per worked day. Everything the template
// editor and the fill drawer need to know about that lives here, because admin
// tests run environment: 'node' with no jsdom and cannot render a component —
// a decision inside a component is a decision nobody can test.
import type { ShiftTemplate } from '@/services/shift.service';
import { refId } from './shift-roster-utils';

export interface ShiftPosition {
  _id: string | null;
  roles: string[];
  count: number;
}

export interface Seat {
  employee: string;
  position: string | null;
}

export interface SeatOption {
  value: string;
  label: string;
  remaining: number;
  full: boolean;
}

/**
 * A template's positions, with a legacy single-role template normalised to one
 * position of count 1. Mirrors shift.helpers.templatePositions on the server —
 * the two must agree, so change them together.
 */
export function templatePositions(template: ShiftTemplate): ShiftPosition[] {
  const raw = Array.isArray(template?.positions) ? template.positions : [];
  const positions = raw
    .map((p) => ({
      _id: p?._id ? String(p._id) : null,
      roles: (Array.isArray(p?.roles) ? p.roles : []).map(refId).filter(Boolean),
      count: Math.max(1, Math.floor(Number(p?.count)) || 1),
    }))
    .filter((p) => p.roles.length);

  if (positions.length) return positions;

  const role = template?.role ? refId(template.role) : '';
  return role ? [{ _id: null, roles: [role], count: 1 }] : [];
}

/** "Bartender or Barback", "Server ×2". */
export function positionLabel(
  position: ShiftPosition,
  roleNames: Map<string, string>
): string {
  const names = position.roles.map((r) => roleNames.get(r) ?? 'Role removed');
  const joined = names.join(' or ');
  return position.count > 1 ? `${joined} ×${position.count}` : joined;
}

/** How many of this position are still unseated. Never negative. */
export function remainingForPosition(position: ShiftPosition, seats: Seat[]): number {
  const taken = seats.filter((s) => s.position === position._id).length;
  return Math.max(0, position.count - taken);
}

/**
 * The fill drawer's per-person dropdown. A full position is LABELLED full and
 * kept in the list rather than removed: an option that silently disappears
 * reads as a bug, and the server refuses it as `position_full` anyway.
 */
export function seatOptions(
  template: ShiftTemplate,
  seats: Seat[],
  roleNames: Map<string, string>
): SeatOption[] {
  return templatePositions(template).map((p) => {
    const remaining = remainingForPosition(p, seats);
    const base = positionLabel(p, roleNames);
    const suffix = remaining === 0 ? ' (full)' : p.count > 1 ? ` (${remaining} left)` : '';
    return {
      value: p._id ?? '',
      label: `${base}${suffix}`,
      remaining,
      full: remaining === 0,
    };
  });
}
```

If `refId` is not exported from `shift-roster-utils.ts`, export it there rather than writing a second copy — the id-or-doc-or-null ref shape has exactly one definition in this codebase.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && ./node_modules/.bin/vitest run src/app/shared/employees/shift-position-utils.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Run the full admin suite**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && ./node_modules/.bin/vitest run 2>&1 | tail -10
```

Expected: **695/695** (684 baseline + 11).

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add client/apps/admin/src/app/shared/employees/shift-position-utils.ts client/apps/admin/src/app/shared/employees/shift-position-utils.test.ts client/apps/admin/src/app/shared/employees/shift-roster-utils.ts
```

Then commit:

```bash
git commit -m "feat(scheduling): crew position arithmetic for the admin client"
```

---

## Task 8: Client types

**Files:**
- Modify: `client/apps/admin/src/services/shift.service.ts:40-100` (types), `:470-491` (`fill`)

- [ ] **Step 1: Add the position types**

Above `interface ShiftTemplate`:

```ts
/** One line of a template's crew: "2 servers-or-runners". */
export interface ShiftPositionRef {
  _id: string;
  roles: Ref<RoleRef>[];
  count: number;
}

/** A seat on a fill: who, and in which position. */
export interface FillSeat {
  employee: string;
  position: string | null;
}
```

Add to `ShiftTemplate`:

```ts
  /** The crew this shift needs. Empty means the legacy single-role shape. */
  positions: ShiftPositionRef[];
```

Add to `ShiftTemplateInput`:

```ts
  positions?: { _id?: string; roles: string[]; count: number }[];
```

**`_id` is load-bearing on an update, not decoration.** A position's `_id` is the
generation idempotency handle — `planShiftGeneration` counts existing rows per
`template@startInstant@templatePosition`. The server matches an updated
template's positions **by identity**, keeping an `_id` it recognises and minting
a fresh one otherwise. If the editor drops the `_id`s, every save re-mints them,
every already-generated day is orphaned, and the next generate duplicates the
lot. An earlier revision of this plan recovered the ids by array *index*
instead; that silently corrupted the roster whenever an admin removed a
non-trailing position, and was replaced on 2026-08-13.

Add to the `Shift` interface (find it in the same file):

```ts
  /** Other roles this shift accepts beyond `role`. Empty = single-role. */
  altRoles?: Ref<RoleRef>[];
  /** Which template position this row fills. Null for a hand-made shift. */
  templatePosition?: string | null;
```

- [ ] **Step 2: Widen the `fill` input**

At `client/apps/admin/src/services/shift.service.ts:470`:

```ts
  async fill(
    input: {
      templateId: string;
      /** Seats. Bare ids are still accepted by the server for compatibility. */
      employees: FillSeat[];
      from: string;
      to: string;
      force?: boolean;
    },
    token: string
  ): Promise<{ created: number; items: Shift[]; skipped: FillSkip[] }> {
```

Add `position_full` and `no_position` to the `FillSkip` `code` union if it is a literal union rather than `string`.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
```

Expected: **456 errors** — the pre-existing count, unchanged. **Never `npx tsc`.** Callers of `fill` will error until Task 10; if the count rises, note which errors are the expected `fill` call sites and fix them in Task 10.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add client/apps/admin/src/services/shift.service.ts
```

Then commit:

```bash
git commit -m "feat(scheduling): client types for crew positions"
```

---

## Task 9: The template editor's positions list

**Files:**
- Modify: `client/apps/admin/src/app/(hydrogen)/employees/shifts/templates/page.tsx` (draft at `:41`, load at `:124`, column at `:182`, role select at `:224-230`, validation at `:505`)

- [ ] **Step 1: Replace the single role in the draft shape**

At line 41, the draft's `role: ''` becomes:

```ts
  positions: [{ roles: [] as string[], count: 1 }],
```

At line 124, load positions off the fetched template rather than the flat role, using the normaliser so a legacy template opens correctly:

```ts
        positions: templatePositions(t).map((p) => ({
          _id: p._id ?? undefined,
          roles: p.roles,
          count: p.count,
        })),
```

**Carry `_id` through the draft and send it back on save.** It is the generation
idempotency handle: the server matches an updated template's positions by
identity, keeping an `_id` it recognises and minting a fresh one otherwise. An
editor that drops the ids re-mints them on every save, orphaning every
already-generated day so the next generate duplicates the lot. A row the admin
adds with "Add a position" has no `_id` — that is correct, and the server mints
one. A row the admin removes takes its `_id` out of the array, which is what
tells the server that position is gone.

Import `templatePositions` from `@/app/shared/employees/shift-position-utils`.

- [ ] **Step 2: Replace the role `<select>` with a positions editor**

Replace the block at lines 224-230 with a repeating row. Follow the surrounding form's existing class names and `patch()` helper — do not introduce a new styling idiom:

```tsx
<div className="space-y-2">
  <label className="block text-sm font-medium">Positions this shift needs</label>
  {draft.positions.map((pos, i) => (
    <div key={i} className="flex items-start gap-2">
      <select
        multiple
        className="min-h-[5rem] flex-1 rounded border px-2 py-1"
        value={pos.roles}
        onChange={(e) =>
          patch({
            positions: draft.positions.map((p, j) =>
              j === i
                ? { ...p, roles: Array.from(e.target.selectedOptions, (o) => o.value) }
                : p
            ),
          })
        }
      >
        {roles.map((r) => (
          <option key={r._id} value={r._id}>
            {r.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={20}
        className="w-20 rounded border px-2 py-1"
        value={pos.count}
        onChange={(e) =>
          patch({
            positions: draft.positions.map((p, j) =>
              j === i ? { ...p, count: Number(e.target.value) || 1 } : p
            ),
          })
        }
      />
      <button
        type="button"
        className="px-2 py-1 text-sm text-red-600 disabled:opacity-40"
        disabled={draft.positions.length === 1}
        onClick={() =>
          patch({ positions: draft.positions.filter((_, j) => j !== i) })
        }
      >
        Remove
      </button>
    </div>
  ))}
  <button
    type="button"
    className="text-sm font-medium text-blue-600"
    onClick={() => patch({ positions: [...draft.positions, { roles: [], count: 1 }] })}
  >
    Add a position
  </button>
  <p className="text-xs text-gray-500">
    Pick every role that can cover a position — someone holding any of them
    qualifies. The first is the one shown on the roster.
  </p>
</div>
```

- [ ] **Step 3: Update the validation message**

At line 505, replace:

```ts
        if (!d.role) return 'Choose the role this shift requires';
```

with:

```ts
        if (!d.positions.length) return 'Add at least one position this shift needs';
        if (d.positions.some((p) => !p.roles.length)) {
          return 'Every position needs at least one role that can cover it';
        }
```

- [ ] **Step 4: Update the list column**

At line 182, show the crew rather than a single role:

```ts
      {
        header: 'Positions',
        render: (t) =>
          templatePositions(t)
            .map((p) => positionLabel(p, roleNames))
            .join(', '),
      },
```

`roleNames` at line 81 is already a label map; if `buildLabelMap` returns a plain object rather than a `Map`, adapt `positionLabel`'s signature in Task 7 to match it and update that task's tests — do not keep two shapes.

- [ ] **Step 5: Typecheck and run the admin suite**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5 && ./node_modules/.bin/vitest run 2>&1 | tail -5
```

Expected: **456** type errors, **695/695** tests.

- [ ] **Step 6: Prove the page still compiles and server-renders**

The admin's auth is middleware with an explicit **path-list** matcher (`src/middleware.ts`), so a temporary route placed **outside** that list renders a gated component with no login — the only browser-free way to prove a page compiles and SSRs.

Create `client/apps/admin/src/app/smoke-x/page.tsx` rendering the templates page component, run `npm run dev`, fetch `http://localhost:3000/smoke-x`, confirm HTML comes back, then **delete the file**.

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add "client/apps/admin/src/app/(hydrogen)/employees/shifts/templates/page.tsx"
```

Then commit:

```bash
git commit -m "feat(scheduling): edit a shift template's crew of positions"
```

---

## Task 10: The fill drawer's position dropdown

**Files:**
- Modify: `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx` (fill state at `:725`, ticking at `:879` and `:1252`, submit at `:484`)

- [ ] **Step 1: Carry a position per ticked person**

The fill state currently holds `employees: string[]`. Change it to `seats: Seat[]` (from `shift-position-utils`). Where a person is ticked (lines 879 and 1252 use `toggleTicked`), a tick now appends `{employee: id, position: <first position with room, else first>}` and an untick removes that entry:

```ts
const toggleSeat = (seats: Seat[], employee: string, template: ShiftTemplate): Seat[] => {
  if (seats.some((s) => s.employee === employee)) {
    return seats.filter((s) => s.employee !== employee);
  }
  const options = seatOptions(template, seats, roleNames);
  const open = options.find((o) => !o.full) ?? options[0];
  return [...seats, { employee, position: open?.value || null }];
};
```

- [ ] **Step 2: Render the dropdown beside each ticked person**

```tsx
{seats.map((seat) => (
  <div key={seat.employee} className="flex items-center gap-2">
    <span className="flex-1 text-sm">{employeeName(seat.employee)}</span>
    <select
      className="rounded border px-2 py-1 text-sm"
      value={seat.position ?? ''}
      onChange={(e) =>
        setSeats(
          seats.map((s) =>
            s.employee === seat.employee ? { ...s, position: e.target.value || null } : s
          )
        )
      }
    >
      {seatOptions(template, seats.filter((s) => s.employee !== seat.employee), roleNames).map(
        (o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        )
      )}
    </select>
  </div>
))}
```

The `filter` matters: the options shown to a person must not count that person's own seat against the remaining total, or every dropdown reads one short.

- [ ] **Step 3: Send seats**

At line 484, `employees: fill.employees` becomes `employees: fill.seats`.

- [ ] **Step 4: Handle the new skip codes in the report modal**

`fill-report-modal.tsx` groups skips by `code`. Add friendly text for the two new ones, beside the existing `role_mismatch: 'Not marked as able to work this role'` map at `shift-roster-utils.ts:349`:

```ts
  position_full: 'That position is already fully staffed',
  no_position: 'That position is not on this shift pattern',
```

- [ ] **Step 5: Typecheck and run the admin suite**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5 && ./node_modules/.bin/vitest run 2>&1 | tail -5
```

Expected: **456** type errors — back to baseline, including the `fill` call sites from Task 8. **695/695** tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/drinksharbour && git add client/apps/admin/src/app/shared/employees/shift-roster-page.tsx client/apps/admin/src/app/shared/employees/shift-roster-utils.ts client/apps/admin/src/app/shared/employees/fill-report-modal.tsx
```

Then commit:

```bash
git commit -m "feat(scheduling): seat people into crew positions when filling a pattern"
```

---

## Task 11: End-to-end verification

**Files:** none.

- [ ] **Step 1: Full server suite**

```bash
cd /Users/mac/Documents/drinksharbour/server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`** — the same 3 pre-existing failures, no more. Report the exact pass/total.

- [ ] **Step 2: Full admin suite and typecheck**

```bash
cd /Users/mac/Documents/drinksharbour/client/apps/admin && ./node_modules/.bin/vitest run 2>&1 | tail -5 && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -3
```

Expected: **695/695**, **456** type errors.

- [ ] **Step 3: Manual browser pass**

With both dev servers running:

1. Open a template, add a second position — 1× bartender-or-barback, 2× server. Save.
2. Generate a week. Confirm **three** open rows appear on each worked day, one bartender and two servers.
3. Generate the **same** week again. Confirm **nothing** duplicates and the skip report names each position.
4. Edit the bartender position to also accept a manager. Generate again — confirm **still nothing duplicates**. This is the regression `templatePosition` exists for.
5. Raise the server count 2 → 3, generate again, confirm exactly **one** new row.
6. Assign someone who holds only *barback* to the bartender-or-barback row — confirm it is accepted with **no** override prompt.
7. Assign someone who holds neither — confirm `role_mismatch` and that the **force** override is still offered.
8. Open the fill drawer, tick three people, confirm each gets a position dropdown showing remaining capacity, and that seating a fourth on a full position is refused as `position_full`.

- [ ] **Step 4: Re-run Task 0's seven checks**

Confirm every check that passed in Task 0 still passes. Any that failed in Task 0 should fail identically — if one changed behaviour, this work caused it.

- [ ] **Step 5: Report**

State plainly: the two suite counts, the typecheck count, each manual check as PASS/FAIL with what you saw, and anything left undone. Do not report completion while any of the three baselines has moved.

---

## Self-review notes

**Spec coverage:** §2.1 → Task 1; §2.2 → Task 1; §3 → Task 1; §4.1 row shape → Task 2 Step 3; §4.2/4.3 key and reconciliation → Task 2; §5 → Task 3; §6 seats and `position_full` → Tasks 4, 6, 10; §7 → Tasks 7–10; §8 tests → distributed across every task; §9 sequencing → task order, with the manual baseline as Task 0.

**Known gap deliberately left:** the spec's §6 fallback ("count only filled rows toward the fill cap") is not implemented — it is the documented retreat if the shared cap proves wrong in use, not a requirement.

**Type consistency:** `templatePositions` returns `{_id, roles, count}` on both server and client; `Seat` is `{employee, position}` everywhere including the wire format; `positionLabel(position, roleNames)` takes a `Map` — Task 9 Step 4 flags the one place that must be reconciled if `buildLabelMap` returns a plain object.
