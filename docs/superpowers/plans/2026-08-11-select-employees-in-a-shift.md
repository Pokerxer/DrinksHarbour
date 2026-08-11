# Select Employees In A Shift — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin tick several people in the roster drawer and get one shift row per person, with per-person availability shown before ticking and an all-or-nothing refusal that names who blocked it.

**Architecture:** No schema change — `Shift.employee` stays a single nullable ref and `null` still means OPEN SHIFT, so N ticked people become N rows and attendance matching, swaps, early-leave and the roster lanes are untouched. Three new pure helpers in `shift.helpers.js` (`judgeAssignments`, `bindEditedAssignment`, `groupAssignmentContexts`) wrap the existing `checkAssignment` without adding a single rule of their own; the controller batches the context queries and turns N verdicts into one 409. A new `POST /shifts/availability` runs that same judge over the whole active roster so the picker's ⚠ badges and the save's refusals cannot drift apart.

**Tech Stack:** Node/Express + Mongoose (server), `node:test` for server tests. Next.js + React + TypeScript (admin), Vitest for admin tests.

**Spec:** `docs/superpowers/specs/2026-08-11-select-employees-in-a-shift-design.md`

## Global Constraints

- **Do NOT commit.** The user's standing instruction this session is "don't commit unless I ask". Every task ends with a green test run, not a `git commit`. Leave the work in the tree.
- **The working tree is already dirty with finished, verified, undeployed kiosk work** (`server/config/cors.js`, `server/__tests__/cors.test.js`, `attendance.helpers.js`, `attendance.controller.js`, `kiosk-early-leave.tsx`, `attendance-kiosk-page.tsx`, `attendance-utils.ts`, `kiosk-confirmation.tsx`, `attendance.service.ts`, `server.js`). **Do not clean it up, revert it, or re-do it.** This plan touches none of those files.
- **Server tests:** run from `server/` with `node --test '__tests__/*.test.js'`. **`npm test` is broken** — never use it. Baseline **1935 pass / 3 fail**; the 3 failures are pre-existing (1 pricelist tenant-scope, 2 SO-number) and must stay at exactly 3.
- **Admin tests:** run from `client/apps/admin/` with `./node_modules/.bin/vitest run`. Baseline **647/647**. The Vitest environment is `node` with **no jsdom — components cannot be rendered**. Any logic worth testing must live in a `*-utils.ts`.
- **Admin typecheck:** `./node_modules/.bin/tsc --noEmit` from `client/apps/admin/`. Baseline **456 errors**, all pre-existing — the count must not rise. **NEVER run `npx tsc`**: it installs a decoy `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and exits 0, so a typecheck that checked nothing looks like a pass.
- **Scheduling rules live in `server/services/shift.helpers.js`, never in a controller.** The suite is unit-only with no database, so anything left in a controller is untested.
- **`checkAssignment` is the ONE judge** of an assignment (overlap, time off, role eligibility, inactive). No new rule may be written in a controller or in the browser. The new helpers call it; they do not re-implement it.
- **`Shift.employee === null` means OPEN SHIFT**, not missing data. Every path must keep expressing "this slot needs covering".
- **Creating a shift never publishes it.** New rows are always `status: 'draft'`, including rows created while editing a `published` shift.
- **Back-compat:** a request that does NOT carry an `employees` field must behave exactly as it does today, 409 body shape included.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `server/services/shift.helpers.js` | **Modify.** + `FORCEABLE_CODES`, `judgeAssignments`, `bindEditedAssignment`, `groupAssignmentContexts`. Pure, no DB, no Express. |
| `server/__tests__/shift.helpers.test.js` | **Modify.** Unit tests for the four additions. |
| `server/controllers/shift.controller.js` | **Modify.** `assignmentContexts` (batched IO), `readFanOut`, `personRef`, `assignmentConflict`; fan-out in `createShift` and `updateShift`; new `shiftAvailability` handler. |
| `server/routes/shift.routes.js` | **Modify.** `POST /availability`, declared before `/:id`. |
| `client/apps/admin/src/services/shift.service.ts` | **Modify.** `employees` / `skipBlocked` on the inputs, `availability()`, richer `ShiftConflictError`. |
| `client/apps/admin/src/app/shared/employees/shift-roster-utils.ts` | **Modify.** + `mergeAvailability`, `summariseAssignmentResult`; − `canForce`. |
| `client/apps/admin/src/app/shared/employees/shift-roster-utils.test.ts` | **Modify.** Unit tests for the two additions; drop the `canForce` test. |
| `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx` | **Modify.** `employees: string[]` on the draft, checkbox picker, conflict list. |

Unchanged and deliberately so: `server/models/Shift.js`, `attendance.controller.js`, `attendance.helpers.js`, `buildRosterLanes`, every swap path.

---

### Task 1: `judgeAssignments` — judge N candidates at once

**Files:**
- Modify: `server/services/shift.helpers.js` (add after `checkAssignment`, which ends at :512; add to `module.exports`)
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Consumes: the existing `checkAssignment(shift, employee, ctx)` and the module-private `idOf` (`shift.helpers.js:294`).
- Produces:
  - `FORCEABLE_CODES: Set<string>` — exported.
  - `judgeAssignments(shift, employees, ctxById, opts) -> { allowed: [{employee, warnings}], blocked: [{employee, code, message, conflicts, forceable}] }`
    - `shift`: `{ role, start, end, _id? }`
    - `employees`: array of User docs (entries may be `null` — a candidate id with no matching user)
    - `ctxById`: `Map<employeeIdString, { shifts: [], timeOff: [] }>` (a plain object also works)
    - `opts`: `{ force?: boolean }`

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/shift.helpers.test.js`. The file already defines `ROLE`, `OTHER_ROLE`, `EMP`, `EMP2`, `win(from, to)` (:484) and `employee(over)` (:524) — reuse them; do not redefine them.

```js
// ── judgeAssignments ─────────────────────────────────────────────────────────

const EMP3 = '507f1f77bcf86cd799439023';
const other = (id, over = {}) => employee({ _id: id, ...over });
const ctxOf = (entries) => new Map(Object.entries(entries));

test('judgeAssignments allows everyone who is clear', () => {
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  const r = judgeAssignments(shift, [employee(), other(EMP2)], ctxOf({}), {});
  assert.strictEqual(r.allowed.length, 2);
  assert.deepStrictEqual(r.blocked, []);
});

test('judgeAssignments blocks only the double-booked person, and that block is not forceable', () => {
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  const ctx = ctxOf({
    [EMP2]: { shifts: [{ _id: 'a', employee: EMP2, ...win('08:00', '12:00') }], timeOff: [] },
  });
  const r = judgeAssignments(shift, [employee(), other(EMP2)], ctx, {});
  assert.strictEqual(r.allowed.length, 1);
  assert.strictEqual(r.allowed[0].employee._id, EMP);
  assert.strictEqual(r.blocked.length, 1);
  assert.strictEqual(r.blocked[0].employee._id, EMP2);
  assert.strictEqual(r.blocked[0].code, 'overlap');
  assert.strictEqual(r.blocked[0].forceable, false);
});

test('judgeAssignments marks a role mismatch forceable', () => {
  const shift = { role: OTHER_ROLE, ...win('09:00', '17:00') };
  const r = judgeAssignments(shift, [employee()], ctxOf({}), {});
  assert.strictEqual(r.blocked.length, 1);
  assert.strictEqual(r.blocked[0].code, 'role_mismatch');
  assert.strictEqual(r.blocked[0].forceable, true);
});

test('judgeAssignments reports overlap and role_mismatch side by side with different flags', () => {
  const shift = { role: OTHER_ROLE, ...win('09:00', '17:00') };
  const ctx = ctxOf({
    [EMP2]: { shifts: [{ _id: 'a', employee: EMP2, ...win('08:00', '12:00') }], timeOff: [] },
  });
  const r = judgeAssignments(shift, [employee(), other(EMP2)], ctx, {});
  assert.deepStrictEqual(
    r.blocked.map((b) => [b.code, b.forceable]),
    [
      ['role_mismatch', true],
      ['overlap', false],
    ]
  );
});

test('force moves a role mismatch into allowed WITH a warning, and leaves an overlap blocked', () => {
  const shift = { role: OTHER_ROLE, ...win('09:00', '17:00') };
  const ctx = ctxOf({
    [EMP2]: { shifts: [{ _id: 'a', employee: EMP2, ...win('08:00', '12:00') }], timeOff: [] },
  });
  const r = judgeAssignments(shift, [employee(), other(EMP2)], ctx, { force: true });
  assert.strictEqual(r.allowed.length, 1);
  assert.strictEqual(r.allowed[0].employee._id, EMP);
  assert.strictEqual(r.allowed[0].warnings[0].code, 'role_mismatch');
  assert.strictEqual(r.blocked.length, 1);
  assert.strictEqual(r.blocked[0].code, 'overlap');
});

test('judgeAssignments blocks a candidate id that matched no user', () => {
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  const r = judgeAssignments(shift, [null], ctxOf({}), {});
  assert.strictEqual(r.blocked[0].code, 'no_employee');
  assert.strictEqual(r.blocked[0].forceable, false);
});

test('judgeAssignments on an empty list is empty, not a throw', () => {
  const r = judgeAssignments({ role: ROLE, ...win('09:00', '17:00') }, [], ctxOf({}), {});
  assert.deepStrictEqual(r, { allowed: [], blocked: [] });
});

test('a missing context entry means nothing booked, not missing data', () => {
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  const r = judgeAssignments(shift, [other(EMP3)], ctxOf({}), {});
  assert.strictEqual(r.allowed.length, 1);
});
```

Add `judgeAssignments` and `FORCEABLE_CODES` to the `require` block at the top of the test file (:4–23).

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && node --test '__tests__/shift.helpers.test.js'
```

Expected: FAIL — `TypeError: judgeAssignments is not a function`.

- [ ] **Step 3: Write the implementation**

In `server/services/shift.helpers.js`, immediately after `checkAssignment` (which closes at :512):

```js
/**
 * Which refusals an admin may push through with `force`.
 *
 * Only `role_mismatch` — a judgement call about who can cover what. An overlap
 * is physics and time off is a commitment already made to the person; neither
 * is the admin's to wave away, and offering a button that will be refused again
 * is worse than offering none.
 *
 * Exported so the browser stops keeping a second copy of this list: the picker
 * reads the `forceable` flag off the server's own verdict.
 */
const FORCEABLE_CODES = new Set(['role_mismatch']);

/** One employee's slice of a batched context, with empty lists rather than holes. */
function contextFor(ctxById, employeeId) {
  const entry = ctxById instanceof Map ? ctxById.get(employeeId) : ctxById?.[employeeId];
  return { shifts: entry?.shifts || [], timeOff: entry?.timeOff || [] };
}

/**
 * Judge one shift against several candidates at once.
 *
 * Adds NO rules of its own — every verdict is `checkAssignment`'s. That is the
 * point: the pre-flight badges in the picker and the refusal on save come from
 * the same judge, so they cannot drift apart. Pure; the caller loads the
 * context and passes it in.
 *
 * A `null` entry in `employees` is a candidate id that matched no user in the
 * tenant, and `checkAssignment` already answers `no_employee` for it.
 *
 * @param {object} shift    - { role, start, end, _id? }
 * @param {object[]} employees
 * @param {Map<string, {shifts: object[], timeOff: object[]}>|object} ctxById
 * @param {{force?: boolean}} opts
 * @returns {{allowed: object[], blocked: object[]}}
 */
function judgeAssignments(shift, employees = [], ctxById = new Map(), opts = {}) {
  const { force = false } = opts;
  const allowed = [];
  const blocked = [];

  for (const employee of employees) {
    const ctx = contextFor(ctxById, idOf(employee?._id));
    const verdict = checkAssignment(shift, employee, {
      shifts: ctx.shifts,
      timeOff: ctx.timeOff,
      force,
    });

    if (verdict.ok) {
      allowed.push({ employee, warnings: verdict.warnings });
    } else {
      blocked.push({
        employee,
        code: verdict.code,
        message: verdict.message,
        conflicts: verdict.conflicts || [],
        forceable: FORCEABLE_CODES.has(verdict.code),
      });
    }
  }

  return { allowed, blocked };
}
```

Add `FORCEABLE_CODES` and `judgeAssignments` to `module.exports`, next to `checkAssignment`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd server && node --test '__tests__/shift.helpers.test.js'
```

Expected: PASS, 0 failures in this file.

- [ ] **Step 5: Run the full server suite**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: `# pass 1943`-ish, **`# fail 3`** — the same 3 pre-existing failures. Do not commit.

---

### Task 2: `bindEditedAssignment` — the edit fan-out rule

**Files:**
- Modify: `server/services/shift.helpers.js` (after `judgeAssignments`; add to `module.exports`)
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Consumes: the module-private `idOf`. The tests below reuse `EMP3`, `other()` and `ctxOf()`, which **Task 1 added** to the test file — Task 1 must land first.
- Produces: `bindEditedAssignment(currentEmployeeId, ticked) -> { keep: string | null, create: string[] }`. `currentEmployeeId` may be an id string, an ObjectId, a populated doc, or `null`.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/shift.helpers.test.js`:

```js
// ── bindEditedAssignment ─────────────────────────────────────────────────────

test('the edited row keeps its person when they are still ticked; the rest fan out', () => {
  assert.deepStrictEqual(bindEditedAssignment(EMP, [EMP, EMP2, EMP3]), {
    keep: EMP,
    create: [EMP2, EMP3],
  });
});

test('unticking the original and ticking others reassigns the row to the first of them', () => {
  assert.deepStrictEqual(bindEditedAssignment(EMP, [EMP2, EMP3]), {
    keep: EMP2,
    create: [EMP3],
  });
});

test('ticking nobody unassigns the row — an open shift, not a deletion', () => {
  assert.deepStrictEqual(bindEditedAssignment(EMP, []), { keep: null, create: [] });
});

test('ticking exactly the person already on the shift creates nothing', () => {
  assert.deepStrictEqual(bindEditedAssignment(EMP, [EMP]), { keep: EMP, create: [] });
});

test('an open shift being filled binds the first ticked person to the existing row', () => {
  assert.deepStrictEqual(bindEditedAssignment(null, [EMP2, EMP3]), {
    keep: EMP2,
    create: [EMP3],
  });
});

test('bindEditedAssignment reads a populated employee ref, not just an id', () => {
  assert.deepStrictEqual(bindEditedAssignment({ _id: EMP }, [EMP, EMP2]), {
    keep: EMP,
    create: [EMP2],
  });
});

test('a duplicated tick does not produce two rows for one person', () => {
  assert.deepStrictEqual(bindEditedAssignment(null, [EMP2, EMP2, EMP3]), {
    keep: EMP2,
    create: [EMP3],
  });
});
```

Add `bindEditedAssignment` to the test file's `require` block.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && node --test '__tests__/shift.helpers.test.js'
```

Expected: FAIL — `TypeError: bindEditedAssignment is not a function`.

- [ ] **Step 3: Write the implementation**

In `server/services/shift.helpers.js`, after `judgeAssignments`:

```js
/**
 * Split a ticked employee set across the shift being edited and the new rows it
 * fans out into.
 *
 * The edited row keeps its identity: it holds the original person if they are
 * still ticked, otherwise the first newcomer — an ordinary reassignment — and
 * everybody left over gets a row of their own. Unticking everybody UNASSIGNS
 * the row: `employee: null` is an open shift waiting to be filled, not a
 * deletion. Cancelling has its own action and this is not it.
 *
 * `ticked` is taken in the order it arrives (the picker sends display order),
 * so which person lands on the existing row never depends on click order.
 *
 * @param {string|object|null} currentEmployeeId
 * @param {Array<string|object>} ticked
 * @returns {{keep: string|null, create: string[]}}
 */
function bindEditedAssignment(currentEmployeeId, ticked = []) {
  const current = idOf(currentEmployeeId);

  const ids = [];
  for (const t of ticked) {
    const id = idOf(t);
    if (id && !ids.includes(id)) ids.push(id);
  }

  if (!ids.length) return { keep: null, create: [] };

  const keep = current && ids.includes(current) ? current : ids[0];
  return { keep, create: ids.filter((id) => id !== keep) };
}
```

Add `bindEditedAssignment` to `module.exports`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd server && node --test '__tests__/shift.helpers.test.js'
```

Expected: PASS.

- [ ] **Step 5: Run the full server suite**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**, the pre-existing three. Do not commit.

---

### Task 3: `groupAssignmentContexts` — fan flat `$in` results back out

**Files:**
- Modify: `server/services/shift.helpers.js` (after `bindEditedAssignment`; add to `module.exports`)
- Test: `server/__tests__/shift.helpers.test.js`

**Interfaces:**
- Produces: `groupAssignmentContexts(employees, shifts, timeOff) -> Map<employeeIdString, { employee, shifts, timeOff }>`. This is the pure half of the batched context loader Task 4 builds.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/shift.helpers.test.js`:

```js
// ── groupAssignmentContexts ──────────────────────────────────────────────────

test('groupAssignmentContexts files each row under its own employee', () => {
  const emps = [employee(), other(EMP2)];
  const shifts = [
    { _id: 'a', employee: EMP, ...win('09:00', '17:00') },
    { _id: 'b', employee: EMP2, ...win('09:00', '17:00') },
    { _id: 'c', employee: EMP, ...win('18:00', '22:00') },
  ];
  const off = [{ _id: 'x', employee: EMP2, status: 'approved' }];

  const byId = groupAssignmentContexts(emps, shifts, off);
  assert.deepStrictEqual(byId.get(EMP).shifts.map((s) => s._id), ['a', 'c']);
  assert.deepStrictEqual(byId.get(EMP).timeOff, []);
  assert.deepStrictEqual(byId.get(EMP2).shifts.map((s) => s._id), ['b']);
  assert.deepStrictEqual(byId.get(EMP2).timeOff.map((t) => t._id), ['x']);
});

test('an employee with nothing booked gets EMPTY ARRAYS, not undefined', () => {
  const byId = groupAssignmentContexts([employee()], [], []);
  const entry = byId.get(EMP);
  assert.deepStrictEqual(entry.shifts, []);
  assert.deepStrictEqual(entry.timeOff, []);
  assert.strictEqual(entry.employee._id, EMP);
});

test('groupAssignmentContexts drops rows belonging to nobody it was asked about', () => {
  const byId = groupAssignmentContexts(
    [employee()],
    [{ _id: 'a', employee: EMP2, ...win('09:00', '17:00') }],
    []
  );
  assert.deepStrictEqual(byId.get(EMP).shifts, []);
  assert.strictEqual(byId.has(EMP2), false);
});

test('groupAssignmentContexts reads a populated employee ref on a row', () => {
  const byId = groupAssignmentContexts(
    [employee()],
    [{ _id: 'a', employee: { _id: EMP }, ...win('09:00', '17:00') }],
    []
  );
  assert.deepStrictEqual(byId.get(EMP).shifts.map((s) => s._id), ['a']);
});
```

Add `groupAssignmentContexts` to the test file's `require` block.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && node --test '__tests__/shift.helpers.test.js'
```

Expected: FAIL — `TypeError: groupAssignmentContexts is not a function`.

- [ ] **Step 3: Write the implementation**

In `server/services/shift.helpers.js`, after `bindEditedAssignment`:

```js
/**
 * Fan flat `$in` query results back out, one context per candidate.
 *
 * Split from the controller so the grouping is testable without a database —
 * the queries themselves stay in the controller, where the IO belongs.
 *
 * Every candidate gets an entry, and an employee with nothing scheduled gets
 * EMPTY ARRAYS rather than `undefined`: `checkAssignment` iterates both lists,
 * and a missing one would read as "no context was loaded" instead of the true
 * "nothing is booked".
 *
 * @param {object[]} employees - the User docs that were found
 * @param {object[]} shifts    - every nearby shift for any of them
 * @param {object[]} timeOff   - every nearby approved request for any of them
 * @returns {Map<string, {employee: object, shifts: object[], timeOff: object[]}>}
 */
function groupAssignmentContexts(employees = [], shifts = [], timeOff = []) {
  const byId = new Map();

  for (const employee of employees) {
    const id = idOf(employee?._id);
    if (id) byId.set(id, { employee, shifts: [], timeOff: [] });
  }
  for (const s of shifts) {
    const entry = byId.get(idOf(s?.employee));
    if (entry) entry.shifts.push(s);
  }
  for (const t of timeOff) {
    const entry = byId.get(idOf(t?.employee));
    if (entry) entry.timeOff.push(t);
  }

  return byId;
}
```

Add `groupAssignmentContexts` to `module.exports`.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd server && node --test '__tests__/shift.helpers.test.js'
```

Expected: PASS.

- [ ] **Step 5: Run the full server suite**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**. Do not commit.

---

### Task 4: Batched context + create fan-out

**Files:**
- Modify: `server/controllers/shift.controller.js` — the `require` block (:27–39), `assignmentContext` (:216–242), `createShift` (:270–301)

**Interfaces:**
- Consumes: `judgeAssignments`, `groupAssignmentContexts`, `FORCEABLE_CODES` from Tasks 1 & 3.
- Produces (module-private, used by Tasks 5 & 6):
  - `assignmentContexts(tenantId, employeeIds, window, excludeId) -> Promise<Map<string, {employee, shifts, timeOff}>>`
  - `readFanOut(body, opts) -> { ok: true, ids: string[] | null } | { ok: false, message }` — `ids: null` means the `employees` field was absent.
  - `personRef(employee) -> { _id, firstName, lastName } | null`
  - `assignmentConflict(res, { allowed, blocked })` — sends the 409.

There is no database in the test suite, so this task is verified by the suite staying green plus the manual round-trip in Step 5.

- [ ] **Step 1: Import the new helpers**

In `server/controllers/shift.controller.js`, add to the destructured `require('../services/shift.helpers')` at :27–39:

```js
  judgeAssignments,
  bindEditedAssignment,
  groupAssignmentContexts,
```

(`bindEditedAssignment` is unused until Task 5; import it now so the block is touched once.)

- [ ] **Step 2: Replace `assignmentContext` with a batched loader**

Replace the whole function at `:216–242` (keep the long doc comment above it, which still applies) with:

```js
async function assignmentContexts(tenantId, employeeIds = [], window, excludeId) {
  const ids = employeeIds.map(String).filter(isObjectIdLike);
  if (!ids.length) return new Map();

  const [employees, shifts, timeOff] = await Promise.all([
    User.find({ _id: { $in: ids }, tenant: tenantId, status: { $ne: 'deleted' } })
      .select('firstName lastName status employeeProfile.planning.roles')
      .lean(),
    Shift.find({
      tenant: tenantId,
      employee: { $in: ids },
      status: { $ne: 'cancelled' },
      start: { $lt: window.end },
      end: { $gt: window.start },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id employee start end status')
      .lean(),
    TimeOffRequest.find({
      tenant: tenantId,
      employee: { $in: ids },
      status: 'approved',
      startDate: { $lt: window.end },
      endDate: { $gt: window.start },
    })
      .select('_id employee type status startDate endDate halfDay days')
      .lean(),
  ]);

  return groupAssignmentContexts(employees, shifts, timeOff);
}

/**
 * One employee's context, in the shape `checkAssignment` takes.
 *
 * A thin call into the plural version so there is ONE set of queries. Shift-swap
 * approval imports this, and a second loader would become a second set of rules
 * the moment one of them learned something.
 */
async function assignmentContext(tenantId, employeeId, window, excludeId) {
  const byId = await assignmentContexts(tenantId, [employeeId], window, excludeId);
  const entry = byId.get(String(employeeId));
  return {
    employee: entry?.employee ?? null,
    shifts: entry?.shifts ?? [],
    timeOff: entry?.timeOff ?? [],
  };
}
```

`assignmentContext` keeps its exact signature and return shape, so the swap path is untouched.

- [ ] **Step 3: Add the fan-out request helpers**

In `server/controllers/shift.controller.js`, directly below the existing `conflict(res, refusal)` helper (:75):

```js
/** An employee doc trimmed to what a conflict line needs to name a person. */
function personRef(employee) {
  if (!employee) return null;
  return {
    _id: employee._id,
    firstName: employee.firstName,
    lastName: employee.lastName,
  };
}

/**
 * Several refusals at once, as the 409 the multi-select picker expects.
 *
 * Deliberately a DIFFERENT body from `conflict()`: this shape is only ever sent
 * for a request that carried `employees`, so a client that still posts a single
 * `employee` sees exactly the 409 it always saw.
 */
function assignmentConflict(res, { allowed, blocked }) {
  const total = allowed.length + blocked.length;
  return res.status(409).json({
    success: false,
    code: 'assignment_conflicts',
    message:
      blocked.length === total
        ? 'Nobody selected can be scheduled for that slot'
        : `${blocked.length} of ${total} people cannot be scheduled`,
    blocked: blocked.map((b) => ({
      employee: personRef(b.employee),
      code: b.code,
      message: b.message,
      conflicts: b.conflicts,
      forceable: b.forceable,
    })),
    allowed: allowed.map((a) => ({
      employee: personRef(a.employee),
      warnings: a.warnings,
    })),
  });
}

/**
 * The `employees` fan-out list off a request body.
 *
 * `{ ok: true, ids: null }` means the field was ABSENT — the caller keeps the
 * original single-or-open path untouched, 409 shape included.
 *
 * On create an empty list is a 400: an open shift is expressed by omitting
 * `employees` and sending `employee: null`, so a null never has to survive a
 * round trip inside a list. On update an empty list is legal and means "unassign
 * this row", which is `allowEmpty`.
 */
function readFanOut(body = {}, { allowEmpty = false } = {}) {
  if (body.employees === undefined) return { ok: true, ids: null };
  if (!Array.isArray(body.employees)) {
    return { ok: false, message: 'employees must be a list of employee ids' };
  }
  if (!body.employees.length) {
    return allowEmpty
      ? { ok: true, ids: [] }
      : { ok: false, message: 'Choose at least one person, or leave the shift open' };
  }
  if (!body.employees.every(isObjectIdLike)) {
    return { ok: false, message: 'employees must be a list of employee ids' };
  }

  const ids = [];
  for (const id of body.employees) {
    const s = String(id);
    if (!ids.includes(s)) ids.push(s);
  }
  return { ok: true, ids };
}
```

- [ ] **Step 4: Rewrite `createShift`**

Replace `createShift` (`:270–301`) in full:

```js
const createShift = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const built = buildShiftPayload(req.body, { isUpdate: false });
  if (!built.ok) return badRequest(res, built.message);

  const times = validateShiftTimes(built.value.start, built.value.end);
  if (!times.ok) return badRequest(res, times.message);

  const fan = readFanOut(req.body);
  if (!fan.ok) return badRequest(res, fan.message);

  // No `employees` field: the original single-or-open path, byte for byte.
  if (fan.ids === null) {
    let warnings = [];
    if (built.value.employee) {
      const ctx = await assignmentContext(tenantId, built.value.employee, built.value, null);
      const verdict = checkAssignment(built.value, ctx.employee, {
        shifts: ctx.shifts,
        timeOff: ctx.timeOff,
        force: Boolean(req.body.force),
      });
      if (!verdict.ok) return conflict(res, verdict);
      warnings = verdict.warnings;
    }

    const row = await Shift.create({
      ...built.value,
      tenant: tenantId,
      // Never published on creation: a roster becomes visible to staff through
      // the publish action alone, so adding a shift cannot leak a draft week.
      status: 'draft',
      createdBy: req.user?._id,
    });

    const item = await Shift.findById(row._id).populate(SHIFT_POPULATE).lean();
    return res.status(201).json({ success: true, data: { item, warnings } });
  }

  // The fan-out: N ticked people become N rows, one each, so every downstream
  // reader — attendance's punch→shift match, swaps, the roster lanes — still
  // sees exactly one person per shift.
  const byId = await assignmentContexts(tenantId, fan.ids, built.value, null);
  const candidates = fan.ids.map((id) => byId.get(id)?.employee ?? null);
  const { allowed, blocked } = judgeAssignments(built.value, candidates, byId, {
    force: Boolean(req.body.force),
  });

  // All-or-nothing unless the admin explicitly chose to skip. Nothing is written
  // until they do, so a save never half-happens behind their back.
  if (blocked.length && (!req.body.skipBlocked || !allowed.length)) {
    return assignmentConflict(res, { allowed, blocked });
  }

  const rows = await Shift.insertMany(
    allowed.map((a) => ({
      ...built.value,
      employee: a.employee._id,
      tenant: tenantId,
      status: 'draft',
      createdBy: req.user?._id,
    }))
  );

  const items = await Shift.find({ _id: { $in: rows.map((r) => r._id) } })
    .populate(SHIFT_POPULATE)
    .sort({ start: 1 })
    .lean();

  res.status(201).json({
    success: true,
    data: {
      items,
      // Named per person: a forced assignment has to say WHO it was forced for,
      // or three warnings for five people mean nothing.
      warnings: allowed.flatMap((a) =>
        a.warnings.map((w) => ({ ...w, employee: personRef(a.employee) }))
      ),
      skipped: blocked.map((b) => ({
        employee: personRef(b.employee),
        code: b.code,
        message: b.message,
      })),
    },
  });
});
```

- [ ] **Step 5: Verify — suite green, then a live round trip**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`** (the pre-existing three). The controller has no unit coverage, so also exercise it against the local backend on :5001 with a real tenant-admin token, three calls:

1. `POST /api/shifts` **without** `employees` → 201, body has `data.item` (back-compat holds).
2. `POST /api/shifts` with `employees: [idA, idB]` and a role neither holds → **409**, `code: 'assignment_conflicts'`, two `blocked` entries, each `forceable: true`. Confirm with `GET /api/shifts?from=&to=` that **no rows were written**.
3. Repeat 2 with `force: true` → 201, `data.items` has 2 rows, `data.warnings` has 2 entries each naming its person.

Do not commit.

---

### Task 5: Update fan-out

**Files:**
- Modify: `server/controllers/shift.controller.js` — `updateShift` (:303–364)

**Interfaces:**
- Consumes: `bindEditedAssignment` (Task 2), `assignmentContexts` / `readFanOut` / `assignmentConflict` / `personRef` (Task 4).

- [ ] **Step 1: Rewrite `updateShift`**

Replace `updateShift` in full. Everything down to and including the `rechecked` computation is unchanged from today; the fan-out branch is new.

```js
const updateShift = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Shift');

  const row = await Shift.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Shift');

  const built = buildShiftPayload(req.body, { isUpdate: true });
  if (!built.ok) return badRequest(res, built.message);

  const fan = readFanOut(req.body, { allowEmpty: true });
  if (!fan.ok) return badRequest(res, fan.message);

  // Status is not an ordinary field: every move goes through the transition
  // table, so an edit can never quietly un-cancel or re-draft a published shift.
  let nextStatus = null;
  if (req.body.status !== undefined && req.body.status !== row.status) {
    if (!SHIFT_STATUSES.includes(req.body.status)) {
      return badRequest(res, `Status must be one of: ${SHIFT_STATUSES.join(', ')}`);
    }
    if (!canTransitionShift(row.status, req.body.status)) {
      return badRequest(res, `A ${row.status} shift cannot become ${req.body.status}`);
    }
    nextStatus = req.body.status;
  }

  const start = built.value.start ?? row.start;
  const end = built.value.end ?? row.end;
  const times = validateShiftTimes(start, end);
  if (!times.ok) return badRequest(res, times.message);

  // A cancelled shift is exempt from every assignment check: it occupies
  // nobody's time, so holding an edit to it against an overlap would block the
  // one action that clears the clash.
  const live = (nextStatus ?? row.status) !== 'cancelled';
  const rechecked =
    built.value.employee !== undefined ||
    built.value.start !== undefined ||
    built.value.end !== undefined;

  if (fan.ids !== null) {
    // ── The fan-out edit ─────────────────────────────────────────────────────
    // The edited row keeps its identity and the newcomers get rows of their own.
    const bind = bindEditedAssignment(row.employee, fan.ids);
    const candidate = { role: built.value.role ?? row.role, start, end };

    // `excludeId` drops the row being edited from EVERY candidate's overlap
    // query. Only the person who currently holds it could ever match it, and for
    // them the exclusion is exactly right — a shift never conflicts with itself.
    const wanted = (bind.keep ? [bind.keep] : []).concat(bind.create);
    const byId = await assignmentContexts(tenantId, wanted, { start, end }, row._id);

    // The kept person is only re-judged when something that matters moved,
    // matching today's behaviour: editing a note on a forced assignment must not
    // re-raise the refusal that was already waved through.
    const keepChanged = String(bind.keep ?? '') !== String(row.employee ?? '');
    const judgeKeep = Boolean(bind.keep) && live && (keepChanged || rechecked);

    const keepVerdict = judgeKeep
      ? judgeAssignments(
          { ...candidate, _id: row._id },
          [byId.get(bind.keep)?.employee ?? null],
          byId,
          { force: Boolean(req.body.force) }
        )
      : { allowed: [], blocked: [] };

    const newVerdict = live
      ? judgeAssignments(
          candidate,
          bind.create.map((id) => byId.get(id)?.employee ?? null),
          byId,
          { force: Boolean(req.body.force) }
        )
      : { allowed: [], blocked: [] };

    const allowed = keepVerdict.allowed.concat(newVerdict.allowed);
    const blocked = keepVerdict.blocked.concat(newVerdict.blocked);

    // `skipBlocked` only ever skips NEW rows. If the person going ON the edited
    // row is refused, that IS the edit that was asked for — silently leaving the
    // row as it was would be a different action from the one requested.
    if (keepVerdict.blocked.length) return assignmentConflict(res, { allowed, blocked });
    if (newVerdict.blocked.length && !req.body.skipBlocked) {
      return assignmentConflict(res, { allowed, blocked });
    }

    Object.assign(row, built.value);
    // null = back to an open shift, waiting to be filled.
    row.employee = bind.keep;
    if (nextStatus) {
      row.status = nextStatus;
      if (nextStatus === 'published' && !row.publishedAt) row.publishedAt = new Date();
    }
    await row.save();

    // The new rows are always drafts, even when the row being edited is already
    // published: creation never publishes, so an edit cannot leak a shift to
    // staff who have not been told about it.
    const rows = newVerdict.allowed.length
      ? await Shift.insertMany(
          newVerdict.allowed.map((a) => ({
            employee: a.employee._id,
            role: built.value.role ?? row.role,
            department: row.department,
            start,
            end,
            breakMinutes: built.value.breakMinutes ?? row.breakMinutes,
            note: built.value.note ?? row.note,
            tenant: tenantId,
            status: 'draft',
            createdBy: req.user?._id,
          }))
        )
      : [];

    const [item, created] = await Promise.all([
      Shift.findById(row._id).populate(SHIFT_POPULATE).lean(),
      Shift.find({ _id: { $in: rows.map((r) => r._id) } })
        .populate(SHIFT_POPULATE)
        .sort({ start: 1 })
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        item,
        created,
        warnings: allowed.flatMap((a) =>
          a.warnings.map((w) => ({ ...w, employee: personRef(a.employee) }))
        ),
        skipped: newVerdict.blocked.map((b) => ({
          employee: personRef(b.employee),
          code: b.code,
          message: b.message,
        })),
      },
    });
  }

  // ── The original single-or-open edit, unchanged ────────────────────────────
  const employee =
    built.value.employee !== undefined ? built.value.employee : row.employee && String(row.employee);

  let warnings = [];
  if (employee && rechecked && live) {
    const candidate = { role: built.value.role ?? row.role, start, end, _id: row._id };
    const ctx = await assignmentContext(tenantId, employee, { start, end }, row._id);
    const verdict = checkAssignment(candidate, ctx.employee, {
      shifts: ctx.shifts,
      timeOff: ctx.timeOff,
      force: Boolean(req.body.force),
    });
    if (!verdict.ok) return conflict(res, verdict);
    warnings = verdict.warnings;
  }

  Object.assign(row, built.value);
  if (nextStatus) {
    row.status = nextStatus;
    if (nextStatus === 'published' && !row.publishedAt) row.publishedAt = new Date();
  }
  await row.save();

  const item = await Shift.findById(row._id).populate(SHIFT_POPULATE).lean();
  res.json({ success: true, data: { item, warnings } });
});
```

- [ ] **Step 2: Verify — suite green, then a live round trip**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**. Then against the local backend, on a draft shift currently assigned to A:

1. `PATCH` with `employees: [A, B]` → 200, `data.item.employee` is still A, `data.created` has one row for B, `status: 'draft'`.
2. `PATCH` with `employees: []` → 200, `data.item.employee` is `null` (an open shift), `data.created` empty.
3. `PATCH` with `employees: [B]` on a row held by A → 200, the row is now B's, nothing created.
4. `PATCH` with `employees: [A, C]` where C is already booked at that time → **409**, `blocked` names C, and a re-`GET` shows the row unchanged.
5. Repeat 4 with `skipBlocked: true` → 200, the row stays A's, `data.skipped` names C.
6. `PATCH` on a **published** shift with `employees: [A, B]` → the new row for B is `status: 'draft'`.

Do not commit.

---

### Task 6: `POST /shifts/availability` — the pre-flight

**Files:**
- Modify: `server/controllers/shift.controller.js` — new handler, and the `module.exports` block at the bottom
- Modify: `server/routes/shift.routes.js:38–41`

**Interfaces:**
- Consumes: `assignmentContexts`, `judgeAssignments`, `personRef`, and `buildEmployeeFilter` from `server/services/employee.helpers.js` (the one definition of "who counts as an employee").
- Produces: `POST /api/shifts/availability` → `{ success, data: { items: [{ employee, ok, code, message, forceable }] } }`.

- [ ] **Step 1: Import the employee filter**

At the top of `server/controllers/shift.controller.js`, beside the existing `orgStructure.helpers` require:

```js
const { buildEmployeeFilter } = require('../services/employee.helpers');
```

- [ ] **Step 2: Write the handler**

In `server/controllers/shift.controller.js`, after `updateShift`:

```js
/**
 * Who can work this slot — every active employee, judged before anybody is
 * ticked.
 *
 * The point is that this and the refusal on save run the SAME `checkAssignment`
 * over the same context, so a badge in the picker and the 409 from the write
 * can never disagree. It is a POST because it carries a window and a role, not
 * because it changes anything.
 */
const shiftAvailability = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  if (!isObjectIdLike(req.body.role)) {
    return badRequest(res, 'Choose the role this shift needs');
  }
  const times = validateShiftTimes(req.body.start, req.body.end);
  if (!times.ok) return badRequest(res, times.message);

  const window = { start: new Date(req.body.start), end: new Date(req.body.end) };
  const excludeId = isObjectIdLike(req.body.excludeId) ? req.body.excludeId : null;

  const staff = await User.find(buildEmployeeFilter(tenantId, { status: 'active' }))
    .select('_id')
    .lean();
  const ids = staff.map((s) => String(s._id));

  const byId = await assignmentContexts(tenantId, ids, window, excludeId);
  const candidates = ids.map((id) => byId.get(id)?.employee ?? null).filter(Boolean);

  // force:false always — this answers "is anything in the way?", and forcing is
  // a decision the admin makes afterwards, from the `forceable` flag.
  const { allowed, blocked } = judgeAssignments(
    { role: req.body.role, ...window, ...(excludeId ? { _id: excludeId } : {}) },
    candidates,
    byId,
    { force: false }
  );

  const items = allowed
    .map((a) => ({
      employee: personRef(a.employee),
      ok: true,
      code: null,
      message: null,
      forceable: false,
    }))
    .concat(
      blocked.map((b) => ({
        employee: personRef(b.employee),
        ok: false,
        code: b.code,
        message: b.message,
        forceable: b.forceable,
      }))
    )
    .sort((a, b) =>
      `${a.employee?.firstName ?? ''} ${a.employee?.lastName ?? ''}`.localeCompare(
        `${b.employee?.firstName ?? ''} ${b.employee?.lastName ?? ''}`
      )
    );

  res.json({ success: true, data: { items } });
});
```

Add `availability: shiftAvailability` to the exported `shifts` object at the bottom of the file, beside `create`, `update`, `generate` and `publish`.

- [ ] **Step 3: Mount the route**

In `server/routes/shift.routes.js`, add to the block at :38–41, **above** `shiftRouter.route('/')`:

```js
// Declared before '/:id' so 'generate', 'publish' and 'availability' are never
// read as ids.
shiftRouter.post('/generate', c.shifts.generate);
shiftRouter.post('/publish', c.shifts.publish);
shiftRouter.post('/availability', c.shifts.availability);
shiftRouter.route('/').get(c.shifts.list).post(c.shifts.create);
shiftRouter.route('/:id').patch(c.shifts.update).delete(c.shifts.remove);
```

It inherits the router's existing guards (`protect`, `attachTenant`, `requireOwnTenant`, `tenantAdminOrSuperAdmin`) from the `for` loop at :24–29 — a draft roster stays invisible to the people on it.

- [ ] **Step 4: Verify**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: **`# fail 3`**. Then live, with a tenant-admin token:

```bash
curl -s -X POST http://localhost:5001/api/shifts/availability \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"<roleId>","start":"2026-08-17T17:00:00.000Z","end":"2026-08-18T01:00:00.000Z"}' | jq
```

Expected: `data.items` lists every active employee, name-sorted, each with `ok` plus a `code`/`message`/`forceable` when refused. A person with approved time off over that window must come back `code: 'time_off'`, `forceable: false`.

Do not commit.

---

### Task 7: Client service layer

**Files:**
- Modify: `client/apps/admin/src/services/shift.service.ts` — the `ShiftConflictError` class (:161–171), `handle` (:180–200), `ShiftInput`, `shiftService.create` (:303) and `.update` (:318); add `availability`

**Interfaces:**
- Produces, for Tasks 8 and 9:
  - `interface BlockedAssignment { employee: PersonRef | null; code: string; message: string; conflicts: Shift[]; forceable: boolean }`
  - `interface AllowedAssignment { employee: PersonRef | null; warnings: AssignmentWarning[] }`
  - `interface AvailabilityVerdict { employee: PersonRef | null; ok: boolean; code: string | null; message: string | null; forceable: boolean }`
  - `ShiftConflictError` gains `blocked: BlockedAssignment[]` and `allowed: AllowedAssignment[]`
  - `ShiftInput` gains `employees?: string[]` and `skipBlocked?: boolean`
  - `shiftService.create/update` return `{ item?, items?, created?, warnings, skipped? }`
  - `shiftService.availability(input, token) -> Promise<AvailabilityVerdict[]>`

- [ ] **Step 1: Add the result types**

In `client/apps/admin/src/services/shift.service.ts`, above `ShiftConflictError` (:157):

```ts
/** One person the server refused to schedule, and whether `force` can override it. */
export interface BlockedAssignment {
  employee: PersonRef | null;
  code: string;
  message: string;
  conflicts: Shift[];
  /**
   * Decided by the SERVER, from its own FORCEABLE_CODES. The browser used to
   * keep a second copy of this list; one judge means the badges in the picker
   * and the refusal on save cannot drift apart.
   */
  forceable: boolean;
}

/** One person the server would schedule, with any warning a `force` produced. */
export interface AllowedAssignment {
  employee: PersonRef | null;
  warnings: AssignmentWarning[];
}

/** A pre-flight verdict for one employee against a candidate slot. */
export interface AvailabilityVerdict {
  employee: PersonRef | null;
  ok: boolean;
  code: string | null;
  message: string | null;
  forceable: boolean;
}
```

- [ ] **Step 2: Widen `ShiftConflictError` and `handle`**

Replace the class at :161–171:

```ts
/**
 * A 409 from the roster.
 *
 * Two shapes arrive here. A single-employee save answers with the helper's own
 * `code` (overlap / role_mismatch / …) and `conflicts`. A multi-select save
 * answers `code: 'assignment_conflicts'` and fills `blocked` / `allowed`
 * instead, so the drawer can name every person that stood in the way rather
 * than reporting the first one.
 */
export class ShiftConflictError extends Error {
  code: string;
  conflicts: Shift[];
  blocked: BlockedAssignment[];
  allowed: AllowedAssignment[];

  constructor(
    message: string,
    code: string,
    conflicts: Shift[],
    blocked: BlockedAssignment[] = [],
    allowed: AllowedAssignment[] = []
  ) {
    super(message);
    this.name = 'ShiftConflictError';
    this.code = code;
    this.conflicts = conflicts;
    this.blocked = blocked;
    this.allowed = allowed;
  }
}
```

In `handle` (:184–197), widen the parsed error and the throw:

```ts
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      conflicts?: Shift[];
      blocked?: BlockedAssignment[];
      allowed?: AllowedAssignment[];
    };
    if (res.status === 409 && err.code) {
      throw new ShiftConflictError(
        err.message || fallback,
        err.code,
        err.conflicts ?? [],
        err.blocked ?? [],
        err.allowed ?? []
      );
    }
```

- [ ] **Step 3: Widen `ShiftInput` and the two writes**

Add to `ShiftInput` (find it above `shiftService`):

```ts
  /**
   * The multi-select fan-out: N ticked people become N shift rows, one each.
   * Absent means the original single-or-open behaviour. An OPEN shift is
   * `employee: null` with no `employees` — a null never rides inside this list.
   */
  employees?: string[];
  /** Create only the people who passed, and report the rest in `skipped`. */
  skipBlocked?: boolean;
```

Replace the return type of `create` and `update` (:303 and :318) with a shared shape declared just above `shiftService`:

```ts
/**
 * A roster write's answer. `item` is the single/edited row; `items` and
 * `created` are the fan-out's rows. Exactly one of `item` / `items` is present.
 */
export interface ShiftWriteResult {
  item?: Shift;
  items?: Shift[];
  created?: Shift[];
  warnings: AssignmentWarning[];
  skipped?: { employee: PersonRef | null; code: string; message: string }[];
}
```

Then change both method signatures to `Promise<ShiftWriteResult>` and both `handle<...>` type arguments to `handle<ShiftWriteResult>`. The bodies are otherwise unchanged.

Widen `AssignmentWarning` to carry its person:

```ts
export interface AssignmentWarning {
  code: string;
  message: string;
  /** Set on a fan-out save: a forced assignment must say WHO it was forced for. */
  employee?: PersonRef | null;
}
```

- [ ] **Step 4: Add `availability`**

In the `shiftService` object, after `update`:

```ts
  /**
   * Who can work this slot, before anybody is ticked.
   *
   * A POST because it carries a window and a role, not because it changes
   * anything. The verdicts come from the same `checkAssignment` the save uses.
   */
  async availability(
    input: { role: string; start: string; end: string; excludeId?: string | null },
    token: string
  ): Promise<AvailabilityVerdict[]> {
    const json = await handle<{ items: AvailabilityVerdict[] }>(
      await fetch(`${SHIFTS}/availability`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to check who is available'
    );
    return json.data.items;
  },
```

- [ ] **Step 5: Typecheck**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
```

Expected: the error count must not exceed the **456** baseline. It may report errors in `shift-roster-page.tsx` about `draft.employee` — those are expected and are fixed in Task 9. Note the count and move on. **Never `npx tsc`.**

Do not commit.

---

### Task 8: Client utils — `mergeAvailability` and `summariseAssignmentResult`

**Files:**
- Modify: `client/apps/admin/src/app/shared/employees/shift-roster-utils.ts` — add after `conflictLabel` (:352–357); **delete** `canForce` (:367–369)
- Test: `client/apps/admin/src/app/shared/employees/shift-roster-utils.test.ts`

**Interfaces:**
- Consumes: `AvailabilityVerdict`, `BlockedAssignment`, `AllowedAssignment`, `ShiftConflictError` from Task 7; the existing `employeeName` and `LaneEmployee` in this file.
- Produces:
  - `PickerRow { id: string; name: string; ok: boolean; code: string | null; reason: string | null; forceable: boolean }`
  - `mergeAvailability(employees: LaneEmployee[], verdicts: AvailabilityVerdict[]) -> PickerRow[]`
  - `AssignmentOutcome { lines: {name: string; reason: string}[]; canForceAll: boolean; canSkip: boolean; heading: string }`
  - `summariseAssignmentResult(err: ShiftConflictError) -> AssignmentOutcome`
  - `assignedLabel(count: number) -> string`

- [ ] **Step 1: Write the failing tests**

In `shift-roster-utils.test.ts`, **remove** `canForce` from the import list and delete its test (:314–318). Then append:

```ts
// ── Multi-select picker ──────────────────────────────────────────────────────

const EMP_A = { _id: 'a', firstName: 'Ada', lastName: 'Obi' };
const EMP_B = { _id: 'b', firstName: 'Chidi', lastName: 'Nwosu' };
const EMP_C = { _id: 'c', firstName: 'Ngozi', lastName: 'Eze' };

describe('mergeAvailability', () => {
  it('attaches each verdict to its employee by id', () => {
    const rows = mergeAvailability(
      [EMP_A, EMP_B],
      [
        { employee: EMP_A, ok: true, code: null, message: null, forceable: false },
        {
          employee: EMP_B,
          ok: false,
          code: 'time_off',
          message: 'This employee has approved time off covering that period',
          forceable: false,
        },
      ]
    );
    expect(rows.map((r) => [r.id, r.ok, r.code])).toEqual([
      ['a', true, null],
      ['b', false, 'time_off'],
    ]);
    expect(rows[1].reason).toBe('On approved time off');
    expect(rows[1].forceable).toBe(false);
  });

  it('leaves an employee with no verdict unbadged rather than hiding them', () => {
    const rows = mergeAvailability([EMP_A, EMP_C], [
      { employee: EMP_A, ok: true, code: null, message: null, forceable: false },
    ]);
    expect(rows).toHaveLength(2);
    const ngozi = rows.find((r) => r.id === 'c');
    expect(ngozi?.ok).toBe(true);
    expect(ngozi?.reason).toBeNull();
  });

  it('renders no badges at all before the verdicts arrive', () => {
    const rows = mergeAvailability([EMP_A, EMP_B], []);
    expect(rows.every((r) => r.ok && r.reason === null)).toBe(true);
  });

  it('names each row the same way the roster lanes do', () => {
    expect(mergeAvailability([EMP_A], [])[0].name).toBe('Ada Obi');
  });
});

describe('summariseAssignmentResult', () => {
  const conflictErr = (
    blocked: { employee: typeof EMP_A; code: string; message: string; forceable: boolean }[],
    allowedCount: number
  ) =>
    new ShiftConflictError(
      'x',
      'assignment_conflicts',
      [],
      blocked.map((b) => ({ ...b, conflicts: [] })),
      Array.from({ length: allowedCount }, () => ({ employee: EMP_A, warnings: [] }))
    );

  it('offers "assign anyway" only when every block is forceable', () => {
    const all = summariseAssignmentResult(
      conflictErr(
        [{ employee: EMP_B, code: 'role_mismatch', message: 'm', forceable: true }],
        2
      )
    );
    expect(all.canForceAll).toBe(true);

    const mixed = summariseAssignmentResult(
      conflictErr(
        [
          { employee: EMP_B, code: 'role_mismatch', message: 'm', forceable: true },
          { employee: EMP_C, code: 'overlap', message: 'm', forceable: false },
        ],
        2
      )
    );
    expect(mixed.canForceAll).toBe(false);
  });

  it('offers "skip these" only when somebody would still be scheduled', () => {
    const some = summariseAssignmentResult(
      conflictErr([{ employee: EMP_B, code: 'overlap', message: 'm', forceable: false }], 3)
    );
    expect(some.canSkip).toBe(true);
    expect(some.heading).toBe('1 of 4 people cannot be scheduled');

    const none = summariseAssignmentResult(
      conflictErr([{ employee: EMP_B, code: 'overlap', message: 'm', forceable: false }], 0)
    );
    expect(none.canSkip).toBe(false);
    expect(none.heading).toBe('Nobody selected can be scheduled');
  });

  it('names every blocked person and why', () => {
    const out = summariseAssignmentResult(
      conflictErr(
        [
          { employee: EMP_B, code: 'overlap', message: 'm', forceable: false },
          { employee: EMP_C, code: 'time_off', message: 'm', forceable: false },
        ],
        1
      )
    );
    expect(out.lines).toEqual([
      { name: 'Chidi Nwosu', reason: 'Already scheduled at that time' },
      { name: 'Ngozi Eze', reason: 'On approved time off' },
    ]);
  });

  it('falls back to the single-employee 409 shape', () => {
    const out = summariseAssignmentResult(
      new ShiftConflictError('Already scheduled', 'overlap', [])
    );
    expect(out.lines).toEqual([
      { name: 'This employee', reason: 'Already scheduled at that time' },
    ]);
    expect(out.canForceAll).toBe(false);
    expect(out.canSkip).toBe(false);
  });
});

describe('assignedLabel', () => {
  it('says an empty pick is an open shift', () => {
    expect(assignedLabel(0)).toBe('Open shift — nobody yet');
  });

  it('counts the pick', () => {
    expect(assignedLabel(1)).toBe('1 selected');
    expect(assignedLabel(3)).toBe('3 selected');
  });
});
```

Add `mergeAvailability`, `summariseAssignmentResult` and `assignedLabel` to the import list at the top of the test file, plus `import { ShiftConflictError } from '@/services/shift.service';`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd client/apps/admin && ./node_modules/.bin/vitest run shift-roster-utils
```

Expected: FAIL — `mergeAvailability is not a function` (and the `canForce` import is gone, so no stale reference).

- [ ] **Step 3: Write the implementation**

In `shift-roster-utils.ts`, add the verdict type to the existing service import at the top of the file:

```ts
import type {
  Shift,
  ShiftStatus,
  AvailabilityVerdict,
} from '@/services/shift.service';
```

Then **delete** `canForce` and its doc comment (:359–369), and add after `conflictLabel`:

```ts
/** One line in the assignment picker: a person, and what stands in their way. */
export interface PickerRow {
  id: string;
  name: string;
  ok: boolean;
  code: string | null;
  reason: string | null;
  forceable: boolean;
}

/**
 * Pair the employee list with the server's pre-flight verdicts.
 *
 * An employee with no verdict is left UNBADGED rather than hidden or blocked:
 * the verdicts arrive after the list does, and a picker that empties itself
 * while a request is in flight is worse than one that shows no warnings yet.
 * The server judges again on save regardless, so nothing here can let a bad
 * assignment through.
 */
export function mergeAvailability(
  employees: LaneEmployee[],
  // Typed as the service's own verdict, NOT a narrower structural shape: the
  // tests pass object literals, and an omitted field would trip TypeScript's
  // excess-property check on every one of them.
  verdicts: AvailabilityVerdict[]
): PickerRow[] {
  const byId = new Map(
    (verdicts ?? [])
      .filter((v) => v.employee?._id)
      .map((v) => [String(v.employee!._id), v] as const)
  );

  return (employees ?? []).map((e) => {
    const id = String(e._id);
    const v = byId.get(id);
    return {
      id,
      name: employeeName(e),
      ok: v ? v.ok : true,
      code: v && !v.ok ? v.code : null,
      reason: v && !v.ok && v.code ? conflictLabel(v.code) : null,
      forceable: v ? v.forceable : false,
    };
  });
}

/** What the conflict panel shows, and which of its two escapes are offered. */
export interface AssignmentOutcome {
  heading: string;
  lines: { name: string; reason: string }[];
  /** Every block is a judgement call, so "Assign anyway" will actually work. */
  canForceAll: boolean;
  /** Somebody would still be scheduled, so "skip these" means something. */
  canSkip: boolean;
}

/**
 * Turn a 409 into the panel.
 *
 * Both 409 shapes land here: the multi-select one carries `blocked`/`allowed`,
 * and a single-employee save carries only a `code`. The two escape hatches are
 * offered from the SERVER's `forceable` flag, never from a list kept here —
 * offering a button that will be refused again is worse than offering none.
 */
export function summariseAssignmentResult(err: {
  code: string;
  blocked?: { employee: LaneEmployee | null; code: string; forceable: boolean }[];
  allowed?: unknown[];
}): AssignmentOutcome {
  const blocked = err.blocked ?? [];
  const allowedCount = (err.allowed ?? []).length;

  if (!blocked.length) {
    return {
      heading: conflictLabel(err.code),
      lines: [{ name: 'This employee', reason: conflictLabel(err.code) }],
      canForceAll: false,
      canSkip: false,
    };
  }

  const total = blocked.length + allowedCount;
  return {
    heading: allowedCount
      ? `${blocked.length} of ${total} people cannot be scheduled`
      : 'Nobody selected can be scheduled',
    lines: blocked.map((b) => ({
      name: employeeName(b.employee),
      reason: conflictLabel(b.code),
    })),
    canForceAll: blocked.every((b) => b.forceable),
    canSkip: allowedCount > 0,
  };
}

/**
 * The picker's own summary. Zero ticked is not "none" — it is an OPEN SHIFT,
 * the state the whole roster is built in, and the label has to say so.
 */
export function assignedLabel(count: number): string {
  return count ? `${count} selected` : 'Open shift — nobody yet';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd client/apps/admin && ./node_modules/.bin/vitest run shift-roster-utils
```

Expected: PASS.

- [ ] **Step 5: Run the full admin suite**

```bash
cd client/apps/admin && ./node_modules/.bin/vitest run 2>&1 | tail -10
```

Expected: all green. The count moves from 647 to 647 − 1 (the deleted `canForce` test) + 12 new ≈ **658**. Zero failures is the bar. Do not commit.

---

### Task 9: The drawer — checkbox picker and conflict list

**Files:**
- Modify: `client/apps/admin/src/app/shared/employees/shift-roster-page.tsx` — the import block (:41), `ShiftDraft` (:77–87), `NEW_DRAFT` (:89–103), `openExisting` (:193–206), `fromTemplate` (:208–225), `save` (:227–272), the conflict state (:124–127), and the drawer's "Assigned to" field (:675–715)

**Interfaces:**
- Consumes: `mergeAvailability`, `summariseAssignmentResult`, `assignedLabel`, `conflictLabel` (Task 8); `shiftService.availability`, `ShiftConflictError`, `ShiftWriteResult` (Task 7).

No unit test — components cannot be rendered under this Vitest config. Verified by typecheck plus the browser check in Step 7.

- [ ] **Step 1: Fix the imports, then swap `employee` for `employees` on the draft**

In the import block at :41, **remove `canForce`** (it no longer exists) and add the new helpers:

```tsx
  assignedLabel,
  mergeAvailability,
  summariseAssignmentResult,
  type AssignmentOutcome,
```

and from the service:

```tsx
import {
  shiftService,
  ShiftConflictError,
  type AvailabilityVerdict,
  type ShiftWriteResult,
} from '@/services/shift.service';
```

(merge these into the file's existing `shift.service` import rather than adding a second one).

Then the draft type:

```tsx
interface ShiftDraft {
  id: string | null;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  role: string;
  /**
   * The ticked people, in display order. Empty is an OPEN SHIFT — the state the
   * roster is built in — not "nothing chosen yet".
   */
  employees: string[];
  note: string;
  status: Shift['status'];
}

const NEW_DRAFT = (
  date: string,
  employee: string,
  role: string
): ShiftDraft => ({
  id: null,
  date,
  startTime: '09:00',
  endTime: '17:00',
  breakMinutes: 0,
  role,
  employees: employee ? [employee] : [],
  note: '',
  status: 'draft',
});
```

In `openExisting` (:202) replace `employee: refId(shift.employee),` with:

```tsx
      employees: refId(shift.employee) ? [refId(shift.employee)] : [],
```

In `fromTemplate` (:221) replace `employee: employeeId ?? '',` with:

```tsx
      employees: employeeId ? [employeeId] : [],
```

- [ ] **Step 2: Replace the conflict state with the summary**

Replace the `conflict` state (:124–127):

```tsx
  const [conflict, setConflict] = useState<AssignmentOutcome | null>(null);
```

The panel no longer branches on a raw `code`, so nothing else reads that state.

- [ ] **Step 3: Fetch availability when the slot settles**

Add beside the other effects, after the picker-loading effect (:152–173):

```tsx
  const [availability, setAvailability] = useState<AvailabilityVerdict[]>([]);

  // Debounced: the badges follow the SLOT (role, day, times), so they must not
  // refire while somebody types in the filter box or drags a time field.
  useEffect(() => {
    if (!token || !draft?.role) {
      setAvailability([]);
      return;
    }
    const slot = localWindowToUtc(
      draft.date,
      draft.startTime,
      draft.endTime,
      OFFSET
    );
    let cancelled = false;
    const t = setTimeout(() => {
      shiftService
        .availability(
          { role: draft.role, start: slot.start, end: slot.end, excludeId: draft.id },
          token
        )
        .then((items) => {
          if (!cancelled) setAvailability(items);
        })
        // A failed pre-flight is not a failed save: the list stays unbadged and
        // the server still judges on save, so this must not shout at the admin.
        .catch(() => {
          if (!cancelled) setAvailability([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, draft?.role, draft?.date, draft?.startTime, draft?.endTime, draft?.id]);

  const [pickerFilter, setPickerFilter] = useState('');

  const pickerRows = useMemo(
    () => mergeAvailability(employees, availability),
    [employees, availability]
  );

  const visibleRows = useMemo(() => {
    const term = pickerFilter.trim().toLowerCase();
    return term
      ? pickerRows.filter((r) => r.name.toLowerCase().includes(term))
      : pickerRows;
  }, [pickerRows, pickerFilter]);
```

Reset `pickerFilter` to `''` wherever the drawer closes (`setDraft(null)`).

- [ ] **Step 4: Rewrite `save` for the fan-out**

```tsx
  async function save(opts: { force?: boolean; skipBlocked?: boolean } = {}) {
    if (!draft) return;
    if (!draft.role) {
      toast.error('Choose the role this shift needs');
      return;
    }
    const window = localWindowToUtc(
      draft.date,
      draft.startTime,
      draft.endTime,
      OFFSET
    );
    const payload = {
      // An open shift is `employee: null` with NO `employees` — a null never
      // rides inside the list, which is the whole reason the two fields coexist.
      ...(draft.employees.length
        ? { employees: draft.employees }
        : draft.id
          ? { employees: [] } // an edit may unassign; a create cannot send []
          : { employee: null }),
      role: draft.role,
      start: window.start,
      end: window.end,
      breakMinutes: draft.breakMinutes,
      note: draft.note,
      force: Boolean(opts.force),
      skipBlocked: Boolean(opts.skipBlocked),
    };

    setSaving(true);
    setConflict(null);
    try {
      const result: ShiftWriteResult = draft.id
        ? await shiftService.update(draft.id, payload, token)
        : await shiftService.create(payload, token);

      // A forced assignment is reported back, never silent — and now by name.
      for (const w of result.warnings ?? []) {
        const who = w.employee
          ? `${w.employee.firstName} ${w.employee.lastName}: `
          : '';
        toast(`${who}${w.message}`, { icon: '⚠️' });
      }
      for (const s of result.skipped ?? []) {
        const who = s.employee
          ? `${s.employee.firstName} ${s.employee.lastName}`
          : 'Someone';
        toast(`Skipped ${who} — ${conflictLabel(s.code)}`, { icon: '↷' });
      }

      const added = (result.items?.length ?? 0) + (result.created?.length ?? 0);
      toast.success(
        draft.id
          ? added
            ? `Shift updated, ${added} more added`
            : 'Shift updated'
          : `${added || 1} shift${added > 1 ? 's' : ''} added`
      );
      setDraft(null);
      setPickerFilter('');
      await loadRoster();
    } catch (err) {
      if (err instanceof ShiftConflictError) {
        setConflict(summariseAssignmentResult(err));
      } else {
        toast.error(err instanceof Error ? err.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }
```

Update the drawer's Save button, which currently calls `save()` — it still does, with no arguments.

- [ ] **Step 5: Replace the "Assigned to" field**

Replace the `<Field label="Assigned to" …>` block at :675–691:

```tsx
                <Field
                  label="Assigned to"
                  hint={assignedLabel(draft.employees.length)}
                >
                  <div className="rounded-xl border border-gray-200">
                    <input
                      type="search"
                      value={pickerFilter}
                      onChange={(e) => setPickerFilter(e.target.value)}
                      placeholder="Filter…"
                      aria-label="Filter employees"
                      className="w-full rounded-t-xl border-b border-gray-200 px-3 py-2 text-sm outline-none"
                    />
                    <div className="max-h-56 overflow-y-auto p-1">
                      {!visibleRows.length && (
                        <p className="px-2 py-3 text-center text-xs text-gray-400">
                          No matching employees
                        </p>
                      )}
                      {visibleRows.map((row) => (
                        <label
                          key={row.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={draft.employees.includes(row.id)}
                            onChange={(e) => {
                              setConflict(null);
                              setDraft({
                                ...draft,
                                // Rebuilt from the picker's own order, so the
                                // server's "first ticked keeps the row" rule
                                // never depends on click order.
                                employees: e.target.checked
                                  ? pickerRows
                                      .map((r) => r.id)
                                      .filter(
                                        (id) =>
                                          id === row.id ||
                                          draft.employees.includes(id)
                                      )
                                  : draft.employees.filter((id) => id !== row.id),
                              });
                            }}
                            className="h-4 w-4 shrink-0 accent-[#b20202]"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                            {row.name}
                          </span>
                          {/* Badged, never disabled: role_mismatch is forceable,
                              and a greyed-out row hides its own reason. */}
                          {row.reason && (
                            <span
                              className={`shrink-0 text-[11px] ${
                                row.forceable ? 'text-amber-600' : 'text-gray-400'
                              }`}
                            >
                              ⚠ {row.reason}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Tick nobody to leave this an open shift, waiting to be
                    filled.
                  </p>
                </Field>
```

- [ ] **Step 6: Replace the conflict panel**

Replace the `{conflict && (…)}` block at :693–715:

```tsx
                {conflict && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                      <PiWarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {conflict.heading}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {conflict.lines.map((line) => (
                        <li
                          key={line.name}
                          className="flex justify-between gap-3 text-xs text-amber-900"
                        >
                          <span className="font-medium">{line.name}</span>
                          <span className="text-amber-700">{line.reason}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {conflict.canForceAll && (
                        <button
                          type="button"
                          onClick={() => save({ force: true })}
                          disabled={saving}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          Assign anyway ({conflict.lines.length})
                        </button>
                      )}
                      {conflict.canSkip && (
                        <button
                          type="button"
                          onClick={() => save({ skipBlocked: true })}
                          disabled={saving}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                        >
                          Add the others, skip these
                        </button>
                      )}
                      {!conflict.canForceAll && !conflict.canSkip && (
                        <p className="text-xs text-amber-800">
                          This one cannot be overridden — pick someone else or
                          move the times.
                        </p>
                      )}
                    </div>
                  </div>
                )}
```

- [ ] **Step 7: Verify**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -5
cd client/apps/admin && ./node_modules/.bin/vitest run 2>&1 | tail -10
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

Expected: tsc at or below **456**; vitest all green; server **`# fail 3`**.

Then in a browser, on `/employees/shifts` with the backend on :5001:

1. Click `+` on a day → tick three people → Save → **three cards** appear, one in each person's lane.
2. Open a slot whose role nobody holds → all three are badged ⚠ amber → Save → the panel names all three → **"Assign anyway (3)"** works and produces three warning toasts, each naming its person.
3. Tick somebody with approved time off → their badge is grey (not forceable) → Save → the panel offers **"Add the others, skip these"** only.
4. Open an existing shift → its person is pre-ticked → tick one more → Save → the original card is unchanged and one new card appears.
5. Open an existing shift → untick everybody → Save → the card moves to the **"Unassigned / open shifts"** lane at the top.

Do not commit. Report the three counts and what the browser showed.

---

## Verification Summary

| Check | Command | Expected |
| --- | --- | --- |
| Server suite | `cd server && node --test '__tests__/*.test.js'` | `# fail 3` (pre-existing: 1 pricelist, 2 SO-number) |
| Admin suite | `cd client/apps/admin && ./node_modules/.bin/vitest run` | all green, ≈658 tests |
| Admin types | `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` | ≤ 456 errors — **never `npx tsc`** |
| Live API | Tasks 4.5, 5.2, 6.4 | as listed per task |
| Browser | Task 9.7 | the five flows |
