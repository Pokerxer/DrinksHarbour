# Shift Pattern Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin put several employees onto a repeating shift pattern across a date range in one action, from either the roster or an employee's page.

**Architecture:** Extract the "which dates does this template work?" decision out of `planShiftGeneration` into a shared pure `patternDates`, so there is exactly one reader of `recurrence`/`cycleDays`/`anchorDate` on the server. Add a second pure planner, `planPatternFill`, beside it that walks those dates × the chosen employees and judges each person-day with the existing `checkAssignment`. A new `POST /api/shifts/fill` loads context once for the whole range and inserts the result. The browser gets one drawer in "fill mode", reachable from the roster template palette and from an employee page.

**Tech Stack:** Node/Express + Mongoose (server), `node:test` (server tests), Next.js + React + TypeScript (admin), Vitest (admin tests).

**Spec:** `docs/superpowers/specs/2026-08-12-shift-pattern-fill-design.md`

## Global Constraints

- **DO NOT COMMIT.** The user's standing instruction is "don't commit unless I ask". Every task ends with a verification step, not a `git commit`. Leave all work uncommitted in the tree.
- **NEVER run `git checkout .`, `git stash`, `git reset --hard`, or `git clean`.** The working tree holds uncommitted work.
- **Server tests:** `cd server && node --test '__tests__/*.test.js'`. **`npm test` is BROKEN — do not use it.**
- **Server baseline, measured 2026-08-12:** 1957 tests, `# pass 1954`, **`# fail 3`**. The 3 are pre-existing (1 pricelist tenant-scope, 2 SO-number). Any task that ends with `# fail 4` or more has broken something.
- **Admin tests:** `cd client/apps/admin && ./node_modules/.bin/vitest run`. **Baseline, measured 2026-08-12: 669/669 passing, 37 files.**
- **Admin types:** `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` → **456 pre-existing errors**. **NEVER run `npx tsc`** — it installs a decoy `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and exits 0, so a typecheck that checked nothing looks like a pass.
- **Admin Vitest runs `environment: 'node'` — there is NO jsdom and components CANNOT be rendered.** Every decision worth testing goes in `shift-roster-utils.ts`; `.tsx` files only wire it up.
- **Rules live in `server/services/*.helpers.js`, never a controller.** The server suite is unit-only with no database, so anything in a controller is untested.
- **`Shift.employee === null` means OPEN SHIFT.** It stays a single nullable ref. One row per person per day. Do NOT add `employees[]` to the model.
- **`checkAssignment` is the ONE judge of an assignment.** Add no rules beside it. Do not create a client-side copy of `FORCEABLE_CODES`.
- **Creation never publishes.** Every row this feature writes is `status: 'draft'`.

---

## File Structure

**Server**

| File | Responsibility |
|---|---|
| `server/services/shift.helpers.js` | `patternDates` (new), `planPatternFill` (new), `planShiftGeneration` (refactored to call `patternDates`) |
| `server/controllers/shift.controller.js` | `fillPattern` (new) — loads data, calls the planner, inserts. No rules. |
| `server/routes/shift.routes.js` | `POST /fill`, declared before `/:id` |
| `server/__tests__/shift.helpers.test.js` | New cases for both new helpers |

**Client**

| File | Responsibility |
|---|---|
| `client/apps/admin/src/app/shared/employees/shift-roster-utils.ts` | `fillPreview`, `fillSummaryLabel`, `summariseFillResult` — every fill decision worth testing |
| `client/apps/admin/src/app/shared/employees/shift-roster-utils.test.ts` | Their tests |
| `client/apps/admin/src/app/shared/employees/fill-report-modal.tsx` | The created/skipped report — shared by the roster and the employee page |
| `client/apps/admin/src/services/shift.service.ts` | `fill()` — the HTTP call |
| `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx` | Fill mode in the drawer; palette click enters it |
| `client/apps/admin/src/app/shared/employees/employee-detail.tsx` | "Add to a shift pattern" entry point |

---

### Task 1: Extract `patternDates` from `planShiftGeneration`

This is a **refactor of shipping code**. The whole point is that behaviour does not change. `planShiftGeneration`'s existing tests must stay green **without being edited** — if you find yourself editing one, the extraction is wrong.

**Files:**
- Modify: `server/services/shift.helpers.js` (insert `patternDates` before `planShiftGeneration` at line 310; rewrite `planShiftGeneration`'s body; add to `module.exports`)
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Consumes: existing module-locals `idOf`, `parseTimeOfDay`, `normaliseCycle`, `isCycleWorkDay`, `dayOfWeek`
- Produces: `patternDates(template, dates) → {ok: true, template: string, dates: string[]} | {ok: false, template: string, reason: string}`

- [ ] **Step 1: Write the failing tests**

Add to `server/__tests__/shift.helpers.test.js`. Add `patternDates` to the `require` destructuring at the top of the file. These go after the existing cycle tests (around line 400):

```js
test('patternDates returns the worked weekdays in a range', () => {
  const got = patternDates(template({ daysOfWeek: [1, 3] }), [
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
  ]);
  assert.strictEqual(got.ok, true);
  assert.deepStrictEqual(got.dates, ['2026-08-10', '2026-08-12']);
});

test('patternDates returns one-on/one-off offsets for a cycle template', () => {
  const got = patternDates(cycleTemplate(), [
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
  ]);
  assert.strictEqual(got.ok, true);
  assert.deepStrictEqual(got.dates, ['2026-08-10', '2026-08-12', '2026-08-14']);
});

test('patternDates works for dates before the anchor', () => {
  const got = patternDates(cycleTemplate({ anchorDate: '2026-08-14' }), [
    '2026-08-10', '2026-08-11', '2026-08-12',
  ]);
  assert.strictEqual(got.ok, true);
  // floorMod, not %: 10th and 12th are both an even number of days from the 14th.
  assert.deepStrictEqual(got.dates, ['2026-08-10', '2026-08-12']);
});

test('patternDates refuses an inactive template', () => {
  const got = patternDates(template({ isActive: false }), ['2026-08-10']);
  assert.strictEqual(got.ok, false);
  assert.strictEqual(got.reason, 'Template is inactive');
});

test('patternDates refuses a template with an unusable time', () => {
  const got = patternDates(template({ startTime: '99:99' }), ['2026-08-10']);
  assert.strictEqual(got.ok, false);
  assert.strictEqual(got.reason, 'Template has an invalid start or end time');
});

test('patternDates refuses a weekly template with no days set', () => {
  const got = patternDates(template({ daysOfWeek: [] }), ['2026-08-10']);
  assert.strictEqual(got.ok, false);
  assert.strictEqual(got.reason, 'Template has no days of the week set');
});

test('patternDates refuses a cycle with no worked offsets — empty is not "every day"', () => {
  const got = patternDates(cycleTemplate({ cycleDays: [] }), ['2026-08-10']);
  assert.strictEqual(got.ok, false);
  assert.strictEqual(got.reason, 'Template has no worked days in its cycle');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test --test-name-pattern='patternDates' '__tests__/shift.helpers.test.js'`
Expected: FAIL — `TypeError: patternDates is not a function`

- [ ] **Step 3: Add `patternDates` to `shift.helpers.js`**

Insert immediately **before** `function planShiftGeneration` (line 310):

```js
/**
 * Which dates in a range does this template actually work?
 *
 * The ONE reader of `recurrence` / `daysOfWeek` / `cycleDays` / `anchorDate` on
 * the server. Both planners call it, so a cycle bug fixed in one path cannot
 * silently survive in the other.
 *
 * Refusal reasons are the strings `planShiftGeneration` has always reported in
 * its `skipped` list — they are user-visible and must not drift.
 *
 * @param {object} template
 * @param {string[]} dates - 'YYYY-MM-DD', from eachDateInRange
 * @returns {{ok: true, template: string, dates: string[]}
 *          |{ok: false, template: string, reason: string}}
 */
function patternDates(template, dates = []) {
  const name = template?.name || idOf(template?._id);
  const no = (reason) => ({ ok: false, template: name, reason });

  if (template?.isActive === false) return no('Template is inactive');
  if (
    parseTimeOfDay(template?.startTime) === null ||
    parseTimeOfDay(template?.endTime) === null
  ) {
    return no('Template has an invalid start or end time');
  }

  // Two kinds of recurrence, decided once. Anything not explicitly a cycle is
  // weekly, so every template written before cycles existed keeps generating
  // exactly the roster it already generated.
  let isWorkDay;
  if (template?.recurrence === 'cycle') {
    const cycle = normaliseCycle(template);
    if (!cycle.ok) return no(cycle.message);
    if (!cycle.value.cycleDays.length) {
      return no('Template has no worked days in its cycle');
    }
    isWorkDay = (date) => isCycleWorkDay(date, cycle.value);
  } else {
    const days = Array.isArray(template.daysOfWeek)
      ? template.daysOfWeek.map(Number)
      : [];
    if (!days.length) return no('Template has no days of the week set');
    isWorkDay = (date) => days.includes(dayOfWeek(date));
  }

  return { ok: true, template: name, dates: dates.filter(isWorkDay) };
}
```

- [ ] **Step 4: Rewrite `planShiftGeneration` to call it**

Replace the whole body of `function planShiftGeneration` (line 310 to its closing brace) with this. The JSDoc block above it stays exactly as it is.

```js
function planShiftGeneration(templates = [], opts = {}) {
  const { from, to, offsetMinutes = 60, existing = [] } = opts;
  const dates = eachDateInRange(from, to);

  // Key on template + exact start instant: the same template on the same day is
  // one shift, however many times generation is re-run.
  const taken = new Set(
    existing
      .filter((s) => s.status !== 'cancelled')
      .map((s) => `${idOf(s.template)}@${new Date(s.start).getTime()}`)
  );

  const toCreate = [];
  const skipped = [];

  for (const tpl of templates) {
    const plan = patternDates(tpl, dates);
    if (!plan.ok) {
      skipped.push({ template: plan.template, reason: plan.reason });
      continue;
    }
    const name = plan.template;

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

      const key = `${idOf(tpl._id)}@${window.start.getTime()}`;
      if (taken.has(key)) {
        skipped.push({ template: name, date, reason: 'A shift already exists for this slot' });
        continue;
      }
      taken.add(key);

      toCreate.push({
        template: idOf(tpl._id),
        date,
        employee: null, // open by design
        role: idOf(tpl.role),
        department: tpl.department ? idOf(tpl.department) : null,
        start: window.start,
        end: window.end,
        breakMinutes: Number(tpl.breakMinutes) || 0,
        status: 'draft',
      });
    }
  }

  return { toCreate, skipped };
}
```

- [ ] **Step 5: Export `patternDates`**

In the `module.exports` block at the bottom of `shift.helpers.js`, add `patternDates,` immediately after the `isCycleWorkDay,` line.

- [ ] **Step 6: Run the new tests**

Run: `cd server && node --test --test-name-pattern='patternDates' '__tests__/shift.helpers.test.js'`
Expected: PASS — 7 passing.

- [ ] **Step 7: Prove the refactor changed nothing**

Run: `cd server && node --test --test-name-pattern='planShiftGeneration' '__tests__/shift.helpers.test.js'`
Expected: PASS, **with no edits made to any existing test.** If any existing `planShiftGeneration` test fails or needed changing, the extraction changed behaviour — revert Step 4 and redo it.

- [ ] **Step 8: Full suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# fail 3` (the pre-existing three), total tests risen by 7.

---

### Task 2: `planPatternFill` — the N×M planner

**Files:**
- Modify: `server/services/shift.helpers.js` (add after `planShiftGeneration`; add to `module.exports`)
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Consumes: `patternDates` (Task 1), and module-locals `idOf`, `eachDateInRange`, `shiftWindow`, `contextFor`, `checkAssignment`, `FORCEABLE_CODES`, `DEFAULT_OFFSET_MINUTES`
- Produces:
  ```
  planPatternFill(template, employees, opts) → { toCreate: Row[], skipped: Skip[] }
  opts  = { from, to, offsetMinutes?, existing?, ctxById?, force? }
  Row   = { template, date, employee, role, department, start, end, breakMinutes, status }
  Skip  = { employee, name, date, code, reason, forceable }   // per person-day
        | { template, reason }                                 // whole template refused
  ```

**Design notes the implementer must not "simplify" away:**

1. **Idempotency key is `template@startInstant@employee`** — three parts, not two. Open rows written by `/generate` key as `template@start@` with an empty trailing segment, which is how they stay matchable.
2. **The batch accumulates into its own conflict set.** A row planned for Ada must be appended to Ada's shift list *before* the next date is judged. Otherwise a template with `endDayOffset: 1` writes two overlapping shifts for the same person on consecutive worked days, because neither is in the database yet when the other is judged. `checkAssignment` only sees the context it is handed.
3. **Skip, never refuse the batch.** Unlike the multi-select's all-or-nothing 409, one blocked person-day skips that row only. This divergence is deliberate — comment it.
4. **`reason` (not `message`) on every skip entry**, so the array has one shape whether the refusal came from `checkAssignment` or from the template.

- [ ] **Step 1: Write the failing tests**

Add `planPatternFill` to the `require` destructuring at the top of `server/__tests__/shift.helpers.test.js`, then add these tests. Note `ROLE` already exists in the file; these fixtures are new:

```js
const ada = { _id: 'emp-ada', firstName: 'Ada', lastName: 'Obi', status: 'active',
  employeeProfile: { planning: { roles: [ROLE] } } };
const bola = { _id: 'emp-bola', firstName: 'Bola', lastName: 'Eze', status: 'active',
  employeeProfile: { planning: { roles: [ROLE] } } };

test('planPatternFill writes one row per person per worked day', () => {
  const plan = planPatternFill(cycleTemplate(), [ada, bola], {
    from: '2026-08-10',
    to: '2026-08-14',
    offsetMinutes: LAGOS,
  });
  // 3 worked days (10th, 12th, 14th) x 2 people
  assert.strictEqual(plan.toCreate.length, 6);
  assert.strictEqual(plan.skipped.length, 0);
  assert.deepStrictEqual(
    [...new Set(plan.toCreate.map((r) => r.employee))].sort(),
    ['emp-ada', 'emp-bola']
  );
  assert.ok(plan.toCreate.every((r) => r.status === 'draft'));
});

test('planPatternFill skips a blocked person-day and still writes everyone else', () => {
  // Ada already has a shift on the 12th; nothing blocks Bola.
  const ctx = new Map([
    ['emp-ada', { employee: ada, timeOff: [], shifts: [
      { _id: 'other', employee: 'emp-ada', status: 'draft',
        start: new Date('2026-08-12T08:00:00.000Z'),
        end: new Date('2026-08-12T16:00:00.000Z') },
    ] }],
    ['emp-bola', { employee: bola, timeOff: [], shifts: [] }],
  ]);

  const plan = planPatternFill(cycleTemplate(), [ada, bola], {
    from: '2026-08-10',
    to: '2026-08-14',
    offsetMinutes: LAGOS,
    ctxById: ctx,
  });

  assert.strictEqual(plan.toCreate.length, 5);
  assert.strictEqual(plan.skipped.length, 1);
  assert.strictEqual(plan.skipped[0].employee, 'emp-ada');
  assert.strictEqual(plan.skipped[0].name, 'Ada Obi');
  assert.strictEqual(plan.skipped[0].date, '2026-08-12');
  assert.strictEqual(plan.skipped[0].code, 'overlap');
  assert.strictEqual(plan.skipped[0].forceable, false);
});

test('planPatternFill judges a row against others planned in the SAME batch', () => {
  // A 24h20m shift: each day's shift runs into the next worked day.
  const tpl = cycleTemplate({
    startTime: '08:40', endTime: '09:00', endDayOffset: 1,
    cycleLength: 1, cycleDays: [0], // every day
  });
  const plan = planPatternFill(tpl, [ada], {
    from: '2026-08-10',
    to: '2026-08-12',
    offsetMinutes: LAGOS,
  });
  // The 10th is written: 10th 08:40 → 11th 09:00.
  // The 11th is SKIPPED: it starts 08:40, inside the row just planned for the
  // 10th — this is the in-batch property under test.
  // The 12th is WRITTEN: the only row that exists is the 10th's, which ended on
  // the 11th at 09:00. A day that was skipped left no shift behind, so it must
  // NOT block anything — only rows actually planned become conflicts.
  assert.strictEqual(plan.toCreate.length, 2);
  assert.deepStrictEqual(
    plan.toCreate.map((r) => r.date),
    ['2026-08-10', '2026-08-12']
  );
  assert.strictEqual(plan.skipped.length, 1);
  assert.strictEqual(plan.skipped[0].date, '2026-08-11');
  assert.strictEqual(plan.skipped[0].code, 'overlap');
});

test('planPatternFill is idempotent per employee — a re-run creates nothing', () => {
  const opts = { from: '2026-08-10', to: '2026-08-14', offsetMinutes: LAGOS };
  const first = planPatternFill(cycleTemplate(), [ada, bola], opts);

  const second = planPatternFill(cycleTemplate(), [ada, bola], {
    ...opts,
    existing: first.toCreate.map((r) => ({
      template: r.template, start: r.start, employee: r.employee, status: 'draft',
    })),
  });

  assert.strictEqual(second.toCreate.length, 0);
  assert.strictEqual(second.skipped.length, 6);
  assert.ok(second.skipped.every((s) => s.code === 'exists'));
});

test('planPatternFill does not treat an OPEN generated row as this person\'s shift', () => {
  // /generate wrote an open row for the same template+instant. It keys as
  // `template@start@` and must not block Ada's row.
  const open = planShiftGeneration([cycleTemplate()], {
    from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS, existing: [],
  }).toCreate.map((r) => ({
    template: r.template, start: r.start, employee: null, status: 'draft',
  }));

  const plan = planPatternFill(cycleTemplate(), [ada], {
    from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS, existing: open,
  });
  assert.strictEqual(plan.toCreate.length, 1);
});

test('planPatternFill reports role_mismatch as forceable, overlap as not', () => {
  const chidi = { _id: 'emp-chidi', firstName: 'Chidi', lastName: 'Nwosu',
    status: 'active', employeeProfile: { planning: { roles: [] } } };

  const plan = planPatternFill(cycleTemplate(), [chidi], {
    from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS,
  });
  assert.strictEqual(plan.toCreate.length, 0);
  assert.strictEqual(plan.skipped[0].code, 'role_mismatch');
  assert.strictEqual(plan.skipped[0].forceable, true);
});

test('planPatternFill writes a role_mismatch row when forced', () => {
  const chidi = { _id: 'emp-chidi', firstName: 'Chidi', lastName: 'Nwosu',
    status: 'active', employeeProfile: { planning: { roles: [] } } };

  const plan = planPatternFill(cycleTemplate(), [chidi], {
    from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS, force: true,
  });
  assert.strictEqual(plan.toCreate.length, 1);
});

test('planPatternFill refuses the whole template when it has no worked days', () => {
  const plan = planPatternFill(cycleTemplate({ cycleDays: [] }), [ada], {
    from: '2026-08-10', to: '2026-08-14', offsetMinutes: LAGOS,
  });
  assert.strictEqual(plan.toCreate.length, 0);
  assert.strictEqual(plan.skipped.length, 1);
  assert.strictEqual(plan.skipped[0].reason, 'Template has no worked days in its cycle');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && node --test --test-name-pattern='planPatternFill' '__tests__/shift.helpers.test.js'`
Expected: FAIL — `TypeError: planPatternFill is not a function`

- [ ] **Step 3: Implement `planPatternFill`**

Insert immediately **after** `planShiftGeneration`'s closing brace in `shift.helpers.js`:

```js
/** "Ada Obi", or the id when a name is missing — skips must always name someone. */
const employeeLabel = (e) =>
  [e?.firstName, e?.lastName].filter(Boolean).join(' ') || idOf(e?._id);

/**
 * Plan the shifts to create when several people are put on one pattern.
 *
 * Where planShiftGeneration builds an OPEN roster, this fills a pattern with
 * named people: one row per person per worked day.
 *
 * SKIPS RATHER THAN REFUSING. The multi-select create is all-or-nothing — if
 * anyone is blocked it writes nothing and answers 409 — which is right for 3
 * people on 1 day. Here it would be 3 x 30 = 90 judgements, and one overlap on
 * day 17 would refuse all 90 rows. So a blocked person-day is skipped and
 * reported, and everything else is still written. THIS DIVERGENCE IS
 * DELIBERATE — do not "fix" it back into all-or-nothing.
 *
 * Every verdict is checkAssignment's; this adds no rules of its own.
 *
 * @param {object} template
 * @param {object[]} employees - User docs (need status + employeeProfile.planning.roles)
 * @param {{from: string, to: string, offsetMinutes?: number, existing?: object[],
 *          ctxById?: Map, force?: boolean}} opts
 * @returns {{toCreate: object[], skipped: object[]}}
 */
function planPatternFill(template, employees = [], opts = {}) {
  const {
    from,
    to,
    offsetMinutes = DEFAULT_OFFSET_MINUTES,
    existing = [],
    ctxById = new Map(),
    force = false,
  } = opts;

  const plan = patternDates(template, eachDateInRange(from, to));
  if (!plan.ok) {
    return { toCreate: [], skipped: [{ template: plan.template, reason: plan.reason }] };
  }

  // Three-part key. Two people's shifts from one template on one day are two
  // different rows, which `template@start` alone cannot express. An open row
  // from /generate keys as `template@start@` and so never collides with a
  // person's row.
  const taken = new Set(
    existing
      .filter((s) => s.status !== 'cancelled')
      .map(
        (s) =>
          `${idOf(s.template)}@${new Date(s.start).getTime()}@${idOf(s.employee)}`
      )
  );

  // A MUTABLE copy of each person's shifts, so a row planned earlier in this
  // batch is a conflict for the rows planned after it. Without this a template
  // with endDayOffset >= 1 would write overlapping shifts for one person on
  // consecutive worked days — neither exists in the database yet when the other
  // is judged, and checkAssignment only sees the context it is handed.
  const batchShifts = new Map();
  for (const e of employees) {
    const id = idOf(e?._id);
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

    const candidate = {
      role: idOf(template.role),
      start: window.start,
      end: window.end,
    };

    for (const employee of employees) {
      const id = idOf(employee?._id);
      const name = employeeLabel(employee);

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
      toCreate.push({
        template: idOf(template._id),
        date,
        employee: id,
        role: idOf(template.role),
        department: template.department ? idOf(template.department) : null,
        start: window.start,
        end: window.end,
        breakMinutes: Number(template.breakMinutes) || 0,
        status: 'draft',
      });

      // Feed it back so the next date is judged against it.
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
}
```

- [ ] **Step 4: Export it**

In `module.exports`, add `planPatternFill,` immediately after `planShiftGeneration,`.

- [ ] **Step 5: Run the new tests**

Run: `cd server && node --test --test-name-pattern='planPatternFill' '__tests__/shift.helpers.test.js'`
Expected: PASS — 8 passing.

- [ ] **Step 6: Full suite**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# fail 3`.

---

### Task 3: `POST /api/shifts/fill`

**Files:**
- Modify: `server/controllers/shift.controller.js` (add `fillPattern` after `generateShifts`, which ends at line 835; add to the exported `shifts` object at ~line 911)
- Modify: `server/routes/shift.routes.js` (line ~40)

**Interfaces:**
- Consumes: `planPatternFill` (Task 2), and the controller's existing `assignmentContexts`, `parseRosterRange`, `tenantOffsetMinutes`, `badRequest`, `isObjectIdLike`
- Produces: `POST /api/shifts/fill` → `201 { success: true, data: { created, items, skipped } }`

**The one performance rule:** load context with **ONE** `assignmentContexts` call spanning the whole range. Not one per day — at `MAX_GENERATION_DAYS` that would be 92 round trips.

- [ ] **Step 1: Add `fillPattern` to the controller**

Insert immediately after `generateShifts`'s closing `});` (line 835):

```js
/**
 * POST /api/shifts/fill — put several people on one repeating pattern.
 *
 * Where /generate builds an open roster from many templates, this fills ONE
 * template with named people across a range: N people x M worked days.
 *
 * Blocked person-days are SKIPPED, not refused — see planPatternFill. `skipped`
 * is returned in full and never swallowed: "created 0 shifts" with no reason is
 * indistinguishable from a broken feature.
 */
const fillPattern = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const offsetMinutes = tenantOffsetMinutes(req);
  const range = parseRosterRange(req.body, offsetMinutes);
  if (!range.ok) return badRequest(res, range.message);

  if (!isObjectIdLike(req.body.templateId)) {
    return badRequest(res, 'Choose a shift pattern to fill from');
  }

  const employeeIds = Array.isArray(req.body.employees)
    ? [...new Set(req.body.employees.filter(isObjectIdLike).map(String))]
    : [];
  if (!employeeIds.length) {
    return badRequest(res, 'Choose at least one employee to put on this pattern');
  }

  const template = await ShiftTemplate.findOne({
    tenant: tenantId,
    _id: req.body.templateId,
  }).lean();
  if (!template) {
    return badRequest(res, 'That shift pattern does not exist in your organisation');
  }

  // ONE context load for the WHOLE range. A per-day load would be up to
  // MAX_GENERATION_DAYS round trips; the planner judges day by day in memory.
  const ctxById = await assignmentContexts(
    tenantId,
    employeeIds,
    { start: range.start, end: range.end },
    null
  );

  // Only rows from THIS template matter for idempotency — an unrelated hand-made
  // shift at the same time is a legitimate second slot, and any genuine clash
  // with one is caught by checkAssignment as an overlap instead.
  const existing = await Shift.find({
    tenant: tenantId,
    template: template._id,
    start: { $gte: range.start, $lt: range.end },
  })
    .select('_id template employee start status')
    .lean();

  // Only the employees who actually resolved — assignmentContexts drops deleted
  // and cross-tenant ids, and a missing person must not become a silent no-op.
  const employees = employeeIds
    .map((id) => ctxById.get(id)?.employee)
    .filter(Boolean);
  const missing = employeeIds.filter((id) => !ctxById.get(id)?.employee);

  const { toCreate, skipped } = planPatternFill(template, employees, {
    from: range.from,
    to: range.to,
    offsetMinutes,
    existing,
    ctxById,
    force: req.body.force === true,
  });

  // `date` is the planner's own bookkeeping — the instant is already in start.
  const docs = toCreate.map(({ date, ...s }) => ({
    ...s,
    tenant: tenantId,
    createdBy: req.user?._id,
  }));

  const created = docs.length ? await Shift.insertMany(docs) : [];

  res.status(201).json({
    success: true,
    data: {
      created: created.length,
      items: created.map((d) => d.toObject()),
      skipped: [
        ...missing.map((id) => ({
          employee: id,
          name: 'Unknown employee',
          code: 'no_employee',
          reason: 'That employee is no longer in your organisation',
          forceable: false,
        })),
        ...skipped,
      ],
    },
  });
});
```

- [ ] **Step 2: Wire the import and the export**

At the top of `shift.controller.js`, add `planPatternFill` to the existing destructured `require` of `../services/shift.helpers`.

In the exported object at the bottom (~line 911), add `fill: fillPattern,` immediately after `generate: generateShifts,`.

- [ ] **Step 3: Add the route**

In `server/routes/shift.routes.js`, add the `fill` line to the group declared before `/:id`:

```js
// Declared before '/:id' so 'generate', 'fill', 'publish' and 'availability'
// are never read as ids.
shiftRouter.post('/generate', c.shifts.generate);
shiftRouter.post('/fill', c.shifts.fill);
shiftRouter.post('/publish', c.shifts.publish);
shiftRouter.post('/availability', c.shifts.availability);
```

- [ ] **Step 4: Verify the server still boots and the suite holds**

Run: `cd server && node -e "require('./routes/shift.routes.js'); console.log('routes ok')"`
Expected: `routes ok` — this catches a typo'd `c.shifts.fill` that would otherwise only fail at request time.

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# fail 3`.

---

### Task 4: Client fill utilities

**Files:**
- Modify: `client/apps/admin/src/app/shared/employees/shift-roster-utils.ts`
- Test: `client/apps/admin/src/app/shared/employees/shift-roster-utils.test.ts`

**Interfaces:**
- Consumes: existing `isCycleWorkDay`, `conflictLabel` in the same file
- Produces:
  ```ts
  fillPreview(template, from, to): { dates: string[]; count: number }
  fillSummaryLabel(days: number, people: number): string
  summariseFillResult(r: { created: number; skipped: FillSkip[] }):
    { heading: string; groups: { name: string; lines: string[] }[] }
  ```

**Accepted duplication:** `fillPreview` re-reads recurrence on the client. `isCycleWorkDay` already lives in this file for the template editor's preview, so this is pre-existing duplication, not new. **The server stays authoritative — the preview is a label, never an input to what gets written.** If the two disagree, the server is right and the preview is the bug.

- [ ] **Step 1: Write the failing tests**

Add to `shift-roster-utils.test.ts`, importing the three new functions from `./shift-roster-utils`:

```ts
const tpl = {
  recurrence: 'cycle' as const,
  cycleLength: 2,
  cycleDays: [0],
  anchorDate: '2026-08-10',
  daysOfWeek: [],
};

describe('fillPreview', () => {
  it('lists the worked days of a 1-on/1-off cycle across a week', () => {
    const got = fillPreview(tpl, '2026-08-10', '2026-08-16');
    expect(got.dates).toEqual(['2026-08-10', '2026-08-12', '2026-08-14', '2026-08-16']);
    expect(got.count).toBe(4);
  });

  it('lists the worked weekdays of a weekly template', () => {
    const got = fillPreview(
      { recurrence: 'weekly', daysOfWeek: [1, 3], cycleLength: null, cycleDays: [], anchorDate: null },
      '2026-08-10',
      '2026-08-16'
    );
    expect(got.dates).toEqual(['2026-08-10', '2026-08-12']);
  });

  it('is empty for a cycle with no worked offsets — empty is not every day', () => {
    expect(fillPreview({ ...tpl, cycleDays: [] }, '2026-08-10', '2026-08-16').count).toBe(0);
  });

  it('is empty when the range is backwards', () => {
    expect(fillPreview(tpl, '2026-08-16', '2026-08-10').count).toBe(0);
  });
});

describe('fillSummaryLabel', () => {
  it('multiplies days by people', () => {
    expect(fillSummaryLabel(4, 2)).toBe('4 days × 2 people = 8 shifts');
  });

  it('uses singulars', () => {
    expect(fillSummaryLabel(1, 1)).toBe('1 day × 1 person = 1 shift');
  });

  it('says nothing will be created when either side is zero', () => {
    expect(fillSummaryLabel(0, 3)).toBe('No days in this range — nothing to create');
    expect(fillSummaryLabel(4, 0)).toBe('Nobody selected — nothing to create');
  });
});

describe('summariseFillResult', () => {
  it('groups skips by person', () => {
    const got = summariseFillResult({
      created: 5,
      skipped: [
        { employee: 'b', name: 'Bola Eze', date: '2026-09-17', code: 'time_off',
          reason: 'Approved time off', forceable: false },
        { employee: 'b', name: 'Bola Eze', date: '2026-09-23', code: 'overlap',
          reason: 'Already scheduled', forceable: false },
      ],
    });
    expect(got.heading).toBe('5 shifts created · all draft, unpublished');
    expect(got.groups).toHaveLength(1);
    expect(got.groups[0].name).toBe('Bola Eze');
    expect(got.groups[0].lines).toHaveLength(2);
  });

  it('reports a clean fill with no groups', () => {
    expect(summariseFillResult({ created: 8, skipped: [] }).groups).toEqual([]);
  });

  it('does not claim success when nothing was created', () => {
    const got = summariseFillResult({
      created: 0,
      skipped: [{ employee: 'a', name: 'Ada Obi', date: '2026-09-01', code: 'overlap',
        reason: 'Already scheduled', forceable: false }],
    });
    expect(got.heading).toBe('No shifts created');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd client/apps/admin && ./node_modules/.bin/vitest run shift-roster-utils`
Expected: FAIL — `fillPreview is not a function` (or an import error).

- [ ] **Step 3: Implement the three functions**

Append to `shift-roster-utils.ts`:

```ts
/** The shape of a skip as the /fill endpoint reports it. */
export type FillSkip = {
  employee?: string;
  name?: string;
  date?: string;
  code?: string;
  reason: string;
  forceable?: boolean;
};

/** Every date from `from` to `to` inclusive, as 'YYYY-MM-DD'. */
function eachDate(from: string, to: string): string[] {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return [];
  const out: string[] = [];
  for (let ms = a; ms <= b && out.length < 92; ms += 86_400_000) {
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Which days a pattern would fill between two dates.
 *
 * A LABEL, not an instruction: the server re-derives this from the same
 * template and its answer is the one that gets written. If the two ever
 * disagree the server is right and this is the bug.
 */
export function fillPreview(
  template: {
    recurrence?: string | null;
    daysOfWeek?: number[] | null;
    cycleLength?: number | null;
    cycleDays?: number[] | null;
    anchorDate?: string | null;
  },
  from: string,
  to: string
): { dates: string[]; count: number } {
  const all = eachDate(from, to);

  let dates: string[];
  if (template.recurrence === 'cycle') {
    const cycleLength = Number(template.cycleLength) || 0;
    const cycleDays = template.cycleDays ?? [];
    const anchorDate = template.anchorDate ?? '';
    dates =
      cycleLength >= 1 && cycleDays.length && anchorDate
        ? all.filter((d) =>
            isCycleWorkDay(d, { cycleLength, cycleDays, anchorDate })
          )
        : [];
  } else {
    const days = template.daysOfWeek ?? [];
    dates = days.length
      ? all.filter((d) => days.includes(new Date(`${d}T00:00:00Z`).getUTCDay()))
      : [];
  }

  return { dates, count: dates.length };
}

/** "4 days × 2 people = 8 shifts", or why nothing would be created. */
export function fillSummaryLabel(days: number, people: number): string {
  if (days <= 0) return 'No days in this range — nothing to create';
  if (people <= 0) return 'Nobody selected — nothing to create';
  const total = days * people;
  const d = `${days} day${days === 1 ? '' : 's'}`;
  const p = `${people} ${people === 1 ? 'person' : 'people'}`;
  const t = `${total} shift${total === 1 ? '' : 's'}`;
  return `${d} × ${p} = ${t}`;
}

/**
 * The created/skipped report, grouped by person.
 *
 * Never claims success when nothing was written: a fill that created 0 rows and
 * said "0 shifts created" cheerfully is indistinguishable from a broken button.
 */
export function summariseFillResult(result: {
  created: number;
  skipped: FillSkip[];
}): { heading: string; groups: { name: string; lines: string[] }[] } {
  const created = Number(result.created) || 0;
  const heading =
    created > 0
      ? `${created} shift${created === 1 ? '' : 's'} created · all draft, unpublished`
      : 'No shifts created';

  const byPerson = new Map<string, string[]>();
  for (const s of result.skipped ?? []) {
    const name = s.name || 'This employee';
    const when = s.date ? `${s.date} — ` : '';
    if (!byPerson.has(name)) byPerson.set(name, []);
    byPerson.get(name)!.push(`${when}${s.reason}`);
  }

  return {
    heading,
    groups: [...byPerson.entries()].map(([name, lines]) => ({ name, lines })),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd client/apps/admin && ./node_modules/.bin/vitest run shift-roster-utils`
Expected: PASS.

- [ ] **Step 5: Full admin suite and typecheck**

Run: `cd client/apps/admin && ./node_modules/.bin/vitest run 2>&1 | tail -6`
Expected: 669 + 10 = **679 passing** (4 `fillPreview` + 3 `fillSummaryLabel` + 3 `summariseFillResult`).

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: **456** (unchanged). **Do NOT use `npx tsc`.**

---

### Task 5: Fill mode in the roster drawer

**Files:**
- Modify: `client/apps/admin/src/services/shift.service.ts` (add `fill` after `generate`, which ends at line 459)
- Modify: `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx`

**Interfaces:**
- Consumes: `fillPreview`, `fillSummaryLabel`, `summariseFillResult`, `FillSkip` (Task 4); `POST /api/shifts/fill` (Task 3)
- Produces: `shiftService.fill(input, token)` for Task 6 to reuse

- [ ] **Step 1: Add the service method**

In `shift.service.ts`, add after `generate` (line 459):

```ts
  /**
   * Put several people on one repeating pattern across a range.
   *
   * `skipped` is person-days the server REFUSED — approved leave, an overlap, a
   * role the person is not marked for. Unlike the single-shift create, which
   * refuses the whole write, a fill writes everything it can and reports the
   * rest: one clash on day 17 must not refuse a month.
   */
  async fill(
    input: {
      templateId: string;
      employees: string[];
      from: string;
      to: string;
      force?: boolean;
    },
    token: string
  ): Promise<{ created: number; items: Shift[]; skipped: FillSkip[] }> {
    const json = await handle<{ created: number; items: Shift[]; skipped: FillSkip[] }>(
      await fetch(`${SHIFTS}/fill`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to fill the pattern'
    );
    return json.data;
  },
```

Import `FillSkip` from `../app/shared/employees/shift-roster-utils` at the top of the file (match the existing relative-import style in that file).

- [ ] **Step 2: Add fill state to the roster page**

In `shift-roster-page.tsx`, beside the existing `draft` state, add:

```tsx
  const [fill, setFill] = useState<{
    template: ShiftTemplate;
    from: string;
    to: string;
    employees: string[];
  } | null>(null);
  const [fillReport, setFillReport] = useState<ReturnType<
    typeof summariseFillResult
  > | null>(null);
```

Import `fillPreview`, `fillSummaryLabel`, `summariseFillResult` from `./shift-roster-utils`.

- [ ] **Step 3: Make the palette click enter fill mode**

Replace the palette button's `onClick` (line ~678) — it currently calls `fromTemplate(t, …)` with a single date:

```tsx
              onClick={() =>
                setFill({
                  template: t,
                  from,
                  to,
                  employees: [],
                })
              }
              title={`Put people on ${t.name} across ${weekRangeLabel(days)}`}
```

`from` and `to` are the existing week bounds (`days[0].date` / `days[6].date`, lines 122–123). **Leave `fromTemplate` in place** — it is still the right behaviour for any single-day use and removing it is out of scope.

- [ ] **Step 4: Render the fill drawer**

Add a drawer beside the existing Generate modal (~line 1054). It reuses the picker rows the drawer already builds:

```tsx
      {fill && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !busy && setFill(null)}
          />
          <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="text-base font-bold text-gray-900">
              Fill {fill.template.name}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {templateRepeatLabel(fill.template)} · from the pattern
            </p>

            <div className="mt-3 flex gap-2">
              <label className="flex-1 text-xs font-semibold text-gray-600">
                From
                <input
                  type="date"
                  value={fill.from}
                  onChange={(e) => setFill({ ...fill, from: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex-1 text-xs font-semibold text-gray-600">
                To
                <input
                  type="date"
                  value={fill.to}
                  onChange={(e) => setFill({ ...fill, to: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              {fillSummaryLabel(
                fillPreview(fill.template, fill.from, fill.to).count,
                fill.employees.length
              )}
            </p>

            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-gray-200">
              {pickerRows.map((row) => (
                <label
                  key={row.id}
                  className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={fill.employees.includes(row.id)}
                    onChange={() =>
                      setFill({
                        ...fill,
                        employees: toggleTicked(fill.employees, row.id),
                      })
                    }
                  />
                  <span className="text-sm text-gray-900">{row.name}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFill(null)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runFill}
                disabled={busy || !fill.employees.length}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Filling…' : 'Fill'}
              </button>
            </div>
          </div>
        </div>
      )}
```

**Note:** `pickerRows` is built from `availability`, which the drawer fetches for a single slot. In fill mode there is no single slot, so the per-person badges are not meaningful here — the checkbox list shows names only, and the server's `skipped` report is what tells the admin who could not be placed. Do not wire the availability fetch into fill mode.

- [ ] **Step 5: Add the `runFill` handler**

Beside the existing `generate()` function (~line 431):

```tsx
  async function runFill() {
    if (!fill) return;
    setBusy(true);
    try {
      const result = await shiftService.fill(
        {
          templateId: fill.template._id,
          employees: fill.employees,
          from: fill.from,
          to: fill.to,
        },
        token
      );
      setFill(null);
      setFillReport(summariseFillResult(result));
      toast.success(`${result.created} shift${result.created === 1 ? '' : 's'} created`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fill the pattern');
    } finally {
      setBusy(false);
    }
  }
```

Match `load()` to whatever the existing `generate()` calls to refresh the roster — reuse the same call, do not invent a new one.

- [ ] **Step 6: Create the shared report modal and render it**

**Both this task and Task 6 show this report**, so it is a shared component from the start rather than two copies that drift.

Create `client/apps/admin/src/app/shared/employees/fill-report-modal.tsx`:

```tsx
'use client';

import type { summariseFillResult } from './shift-roster-utils';

/**
 * The outcome of a pattern fill: what was created, and who could not be placed.
 *
 * Shared by the roster and the employee page — the same fill runs from both, so
 * the same report renders in both. Takes the ALREADY-summarised result rather
 * than the raw response, so the grouping rule lives in one tested place
 * (`summariseFillResult`) instead of in this component.
 */
export default function FillReportModal({
  report,
  onClose,
}: {
  report: ReturnType<typeof summariseFillResult>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5">
        <h2 className="text-sm font-bold text-gray-900">{report.heading}</h2>
        {report.groups.map((g) => (
          <div key={g.name} className="mt-3">
            <p className="text-xs font-semibold text-gray-700">{g.name}</p>
            {g.lines.map((l) => (
              <p key={l} className="text-xs text-gray-500">
                ⚠ {l}
              </p>
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
```

Then in `shift-roster-page.tsx`, import it and render after the fill drawer:

```tsx
      {fillReport && (
        <FillReportModal report={fillReport} onClose={() => setFillReport(null)} />
      )}
```

- [ ] **Step 7: Typecheck and test**

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: **456**. **Not `npx tsc`.**

Run: `cd client/apps/admin && ./node_modules/.bin/vitest run 2>&1 | tail -6`
Expected: **679 passing**.

---

### Task 6: "Add to a shift pattern" on the employee page

**Files:**
- Modify: `client/apps/admin/src/app/shared/employees/employee-detail.tsx`

**Interfaces:**
- Consumes: `shiftService.fill` (Task 5); `shiftTemplateService.list(token)` — **note the name: it is a separate top-level export in `shift.service.ts:283`, NOT `shiftService.templates.list`**; `fillPreview`, `fillSummaryLabel`, `summariseFillResult` (Task 4)

This is an **entry point, not a feature.** It posts to the same `/fill` with the same rules. Do not add any judgement here.

- [ ] **Step 1: Add the state and the template load**

In `employee-detail.tsx`, import `shiftService`, `shiftTemplateService` and the `ShiftTemplate` type from `@/services/shift.service` (match the file's existing import style), plus `fillPreview`, `fillSummaryLabel`, `summariseFillResult` from `./shift-roster-utils`. Then add:

```tsx
  const [patternOpen, setPatternOpen] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [patternBusy, setPatternBusy] = useState(false);
  const [patternReport, setPatternReport] = useState<ReturnType<
    typeof summariseFillResult
  > | null>(null);
  const [pattern, setPattern] = useState({ templateId: '', from: '', to: '' });

  useEffect(() => {
    if (!patternOpen || templates.length) return;
    shiftTemplateService
      .list(token)
      .then((rows) => setTemplates(rows.filter((t) => t.isActive)))
      .catch(() => toast.error('Could not load shift patterns'));
  }, [patternOpen, templates.length, token]);

  const chosenTemplate = templates.find((t) => t._id === pattern.templateId) ?? null;
```

- [ ] **Step 2: Add the trigger button**

In the profile actions area, beside the page's existing action buttons:

```tsx
<button
  type="button"
  onClick={() => setPatternOpen(true)}
  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
>
  Add to a shift pattern
</button>
```

- [ ] **Step 3: Add the submit handler**

```tsx
  async function addToPattern() {
    if (!pattern.templateId) {
      toast.error('Choose a shift pattern');
      return;
    }
    setPatternBusy(true);
    try {
      const result = await shiftService.fill(
        {
          templateId: pattern.templateId,
          employees: [employeeId], // this page's employee, pre-selected
          from: pattern.from,
          to: pattern.to,
        },
        token
      );
      setPatternOpen(false);
      setPatternReport(summariseFillResult(result));
      toast.success(
        `${result.created} shift${result.created === 1 ? '' : 's'} created`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fill the pattern');
    } finally {
      setPatternBusy(false);
    }
  }
```

Replace `employeeId` with whatever this page already calls the current employee's id — do not introduce a second name for it.

- [ ] **Step 4: Add the modal**

```tsx
      {patternOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !patternBusy && setPatternOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5">
            <h2 className="text-base font-bold text-gray-900">
              Add to a shift pattern
            </h2>

            <label className="mt-3 block text-xs font-semibold text-gray-600">
              Pattern
              <select
                value={pattern.templateId}
                onChange={(e) =>
                  setPattern({ ...pattern, templateId: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Choose a pattern…</option>
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 flex gap-2">
              <label className="flex-1 text-xs font-semibold text-gray-600">
                From
                <input
                  type="date"
                  value={pattern.from}
                  onChange={(e) => setPattern({ ...pattern, from: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex-1 text-xs font-semibold text-gray-600">
                To
                <input
                  type="date"
                  value={pattern.to}
                  onChange={(e) => setPattern({ ...pattern, to: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              {chosenTemplate
                ? fillSummaryLabel(
                    fillPreview(chosenTemplate, pattern.from, pattern.to).count,
                    1
                  )
                : 'Choose a pattern to preview the days'}
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPatternOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addToPattern}
                disabled={patternBusy || !pattern.templateId}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {patternBusy ? 'Filling…' : 'Fill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {patternReport && (
        <FillReportModal
          report={patternReport}
          onClose={() => setPatternReport(null)}
        />
      )}
```

**Import `FillReportModal` from `./fill-report-modal`** — the shared component Task 5 created. Do NOT copy its markup into this file, and do NOT import anything from the roster page.

Match the surrounding file's existing modal and toast conventions where they differ from the above.

- [ ] **Step 5: Typecheck and test**

Run: `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: **456**.

Run: `cd client/apps/admin && ./node_modules/.bin/vitest run 2>&1 | tail -6`
Expected: **679 passing**.

- [ ] **Step 6: Final full verification**

Run: `cd server && node --test '__tests__/*.test.js' 2>&1 | tail -8`
Expected: `# fail 3`, total tests = 1957 + 15 = **1972**.

Run: `cd client/apps/admin && ./node_modules/.bin/vitest run 2>&1 | tail -6`
Expected: **679 passing**.

- [ ] **Step 7: Report, do not commit**

Leave everything uncommitted. Report: files touched, the three test/type numbers above, and anything that could not be verified without a browser.

---

## Manual verification (needs a running app)

Automated tests cannot cover these, and **the multi-select picker this builds on has never been opened in a browser** (see the spec's Risks §1). The `session.withTransaction` path used by roster edits **needs a replica set**.

1. Click a 1-on/1-off template in the roster palette → the fill drawer opens with From/To set to the visible week and the preview showing alternating days.
2. Tick two people → the summary reads `4 days × 2 people = 8 shifts`.
3. Fill → 8 draft shifts appear on the roster on the right days, for both people.
4. Fill the same range again → 0 created, 8 skipped as "already exists".
5. Give someone approved leave inside the range, fill again → their day is skipped and named in the report; everyone else is still written.
6. From an employee page → "Add to a shift pattern" → the same fill lands on that one person.
7. Confirm every created row is **draft** and invisible to staff until published.
