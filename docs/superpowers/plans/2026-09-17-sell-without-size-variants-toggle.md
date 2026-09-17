# Sell Without Size Variants — Confirmation Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safety confirmation gate to the "Sell Without Size Variants" toggle in the sub-product create/edit form, and make hidden size rows never block a save in single-item mode.

**Architecture:** Three independent fixes. (1) The form schema (`sub-product.schema.ts`) currently fails `handleSubmit` on any empty size row regardless of the toggle — relax the row-level `size` rule and gate the `superRefine` "size is required" loop on `!sellWithoutSizeVariants`. (2) The manual save guard in `index.tsx` `performSave` (which runs for auto-save / save-on-leave, bypassing zod) is extracted to a pure `validateSizeVariants()` helper that returns `[]` when the toggle is ON. (3) `sizes.tsx` intercepts the toggle turning ON while ≥1 size exists, opens a `rizzui/modal` confirmation, and shows an inline "single item" notice when ON. Rows stay hidden (never deleted) so toggling back restores them. Server already wipes to a Unit size — unchanged.

**Tech Stack:** Next.js App Router, react-hook-form + zod (`zodResolver`), rizzui (`Switch`, `Modal`), framer-motion, vitest (node env).

## Global Constraints

- Tests run from `client/apps/admin` via `npx vitest run <path>` (config: `environment: 'node'`, include `src/**/*.test.ts`).
- `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/index.tsx` and `sizes.tsx` are `@ts-nocheck` — tsc will NOT typecheck them; correctness comes from the pure-helper tests + review. `validators/sub-product.schema.ts`, `validation.ts`, and all `.test.ts` files ARE typechecked.
- Typecheck command (from `client/apps/admin`): `set -a; source .env; set +a; pnpm exec tsc --noEmit` — only pre-existing unrelated errors are acceptable.
- Lint (`next lint`) is unusable in this repo (ESLint 9 vs `.eslintrc.json` mismatch at workspace root) — do not run it.
- All sizes files are `@ts-nocheck` by existing convention — do not add or remove that comment.
- When SINGLE-ITEM mode is ON (`sellWithoutSizeVariants === true`), hidden size rows must never block a save at any layer (schema, manual guard, server). When it is OFF, all existing validation must behave exactly as before (message text unchanged).
- Commit style: conventional commits (`fix(subproduct):`, `feat(subproduct):`, `docs(subproduct):`). Design spec: `docs/superpowers/specs/2026-09-17-sell-without-size-variants-toggle-design.md` (approved + amended).

---

### Task 1: Gate the size validation in the form schema

**Files:**
- Create: `client/apps/admin/src/validators/sub-product.schema.test.ts`
- Modify: `client/apps/admin/src/validators/sub-product.schema.ts:33-34` and `:372-381`

**Interfaces:**
- Consumes: `subProductFormSchema` (already exported from `./sub-product.schema`), `sizeOptionSchema`.
- Produces: unchanged public surface. `SizeOption.size` becomes defaulted `''` instead of `.min(1)`-strict; parsing behavior for single-item mode becomes tolerant.

- [ ] **Step 1: Write the failing test**

Create `client/apps/admin/src/validators/sub-product.schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { subProductFormSchema } from './sub-product.schema';

const base = {
  subProductData: {
    product: '507f1f77bcf86cd799439011',
    createNewProduct: false,
    costPrice: 500,
    sellWithoutSizeVariants: false,
    sizes: [] as { size?: string }[],
  },
};

function sizeIssues(res: {
  success: boolean;
  error?: { issues: { path: (string | number)[] }[] };
}) {
  if (res.success) return [];
  return res.error.issues.filter((i) =>
    i.path.join('.').startsWith('subProductData.sizes')
  );
}

describe('subProductFormSchema — size rules respect the toggle', () => {
  it('rejects a row with an empty size when selling WITH variants', () => {
    const res = subProductFormSchema.safeParse({
      subProductData: {
        ...base.subProductData,
        sizes: [{ size: '' }, { size: '50cl' }],
      },
    });
    expect(res.success).toBe(false);
    expect(sizeIssues(res)).toHaveLength(1);
  });

  it('allows incomplete hidden rows when selling WITHOUT variants', () => {
    const res = subProductFormSchema.safeParse({
      subProductData: {
        ...base.subProductData,
        sellWithoutSizeVariants: true,
        sizes: [{ size: '' }, { size: '' }, { size: '1L' }],
      },
    });
    expect(res.success).toBe(true);
    expect(sizeIssues(res)).toHaveLength(0);
  });

  it('accepts complete rows when selling WITH variants', () => {
    const res = subProductFormSchema.safeParse({
      subProductData: {
        ...base.subProductData,
        sizes: [{ size: '50cl' }, { size: '1L' }],
      },
    });
    expect(res.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify the new behavior fails**

Run: `npx vitest run src/validators/sub-product.schema.test.ts`
Expected: 2 pass (`rejects a row…`, `accepts complete rows…`), 1 FAIL (`allows incomplete hidden rows…` — currently `invalid_string`/`too_small` because of `sizeOptionSchema.size.min(1)`).

- [ ] **Step 3: Relax the row-level size rule**

In `client/apps/admin/src/validators/sub-product.schema.ts`, replace lines 33-34:

```ts
  size: z.string({ required_error: 'Size selection is required' })
    .min(1, 'Please select a size from the dropdown'),
```

with:

```ts
  size: z.string().default(''),
```

- [ ] **Step 4: Gate the superRefine size-required loop**

In `client/apps/admin/src/validators/sub-product.schema.ts`, replace lines 372-381:

```ts
  // Each size variant must have a size selected
  (sp.sizes || []).forEach((size, i) => {
    if (!size.size || size.size.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Size is required',
        path: ['subProductData', 'sizes', i, 'size'],
      });
    }
  });
```

with:

```ts
  // Each size variant must have a size selected — only when selling WITH
  // variants. In single-item mode the rows stay hidden (restorable) and must
  // never block the save.
  if (!sp.sellWithoutSizeVariants) {
    (sp.sizes || []).forEach((size, i) => {
      if (!size.size || size.size.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Size is required',
          path: ['subProductData', 'sizes', i, 'size'],
        });
      }
    });
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/validators/sub-product.schema.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 6: Commit**

```bash
git add client/apps/admin/src/validators/sub-product.schema.ts client/apps/admin/src/validators/sub-product.schema.test.ts
git commit -m "fix(subproduct): don't block save on hidden size rows in single-item mode"
```

---

### Task 2: Extract a toggle-aware size validator and use it in the save path

**Files:**
- Create: `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/validation.ts`
- Create: `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/validation.test.ts`
- Modify: `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/index.tsx` (import + replace `:932-957` guards)

**Interfaces:**
- Produces:
  - `export interface SizeRowLike { size?: string | null }`
  - `export function validateSizeVariants(sizes: SizeRowLike[] | undefined, sellWithoutSizeVariants: boolean): string[]` — returns `[]` when `sellWithoutSizeVariants` is true.
- Consumes: nothing; self-contained. Later used by `index.tsx` via `import { validateSizeVariants } from './validation';`.

- [ ] **Step 1: Write the failing tests**

Create `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateSizeVariants } from './validation';

describe('validateSizeVariants', () => {
  it('returns no errors when selling without size variants', () => {
    expect(validateSizeVariants([{ size: '' }], true)).toEqual([]);
    expect(
      validateSizeVariants([{ size: '50cl' }, { size: '50cl' }], true)
    ).toEqual([]);
    expect(validateSizeVariants(undefined, true)).toEqual([]);
  });

  it('flags missing size selections when selling with variants', () => {
    expect(
      validateSizeVariants([{ size: '50cl' }, { size: '' }, { size: null }], false)
    ).toEqual(['2 size variant(s) are missing a size selection']);
  });

  it('flags duplicate size values when selling with variants', () => {
    expect(
      validateSizeVariants([{ size: ' 50CL ' }, { size: '50cl' }], false)
    ).toEqual([
      'Duplicate size value " 50CL ". Each size value can only appear once per product.',
    ]);
  });

  it('reports missing before duplicates, preserving guard order', () => {
    const errs = validateSizeVariants(
      [{ size: '' }, { size: '70cl' }, { size: '70cl' }, { size: '1L' }],
      false
    );
    expect(errs).toHaveLength(2);
    expect(errs[0]).toMatch(/missing a size selection/);
    expect(errs[1]).toMatch(/Duplicate size value "70cl"/);
  });

  it('accepts clean size rows', () => {
    expect(validateSizeVariants([{ size: '50cl' }, { size: '1L' }], false)).toEqual([]);
  });

  it('treats undefined sizes as empty when selling with variants', () => {
    expect(validateSizeVariants(undefined, false)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/shared/ecommerce/sub-product/create-edit/validation.test.ts`
Expected: FAIL — module `./validation` cannot be resolved.

- [ ] **Step 3: Write the minimal implementation**

Create `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/validation.ts`:

```ts
export interface SizeRowLike {
  size?: string | null;
}

export const MISSING_SIZE_MSG = (count: number): string =>
  `${count} size variant(s) are missing a size selection`;

export const DUPLICATE_SIZE_MSG = (value: string): string =>
  `Duplicate size value "${value}". Each size value can only appear once per product.`;

/**
 * Validate size rows before saving a sub-product.
 *
 * When `sellWithoutSizeVariants` is true the size rows stay in the form,
 * hidden and restorable, so they must NEVER block a save — returns [].
 * Error message text matches the previous inline guards exactly.
 */
export function validateSizeVariants(
  sizes: SizeRowLike[] | undefined,
  sellWithoutSizeVariants: boolean
): string[] {
  if (sellWithoutSizeVariants) return [];
  const rows = sizes || [];
  const errors: string[] = [];

  const missingCount = rows.filter(
    (s) => !s.size || s.size.trim() === ''
  ).length;
  if (missingCount > 0) errors.push(MISSING_SIZE_MSG(missingCount));

  const seen = new Set<string>();
  for (const s of rows) {
    if (!s.size) continue;
    const key = String(s.size).toLowerCase().trim();
    if (seen.has(key)) errors.push(DUPLICATE_SIZE_MSG(s.size));
    seen.add(key);
  }

  return errors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/shared/ecommerce/sub-product/create-edit/validation.test.ts`
Expected: 6/6 PASS.

- [ ] **Step 5: Wire the helper into the save path**

In `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/index.tsx`:

a. After the existing colocated import at line 61 (`import SubProductSizes from './sizes';`), add:

```ts
import { validateSizeVariants } from './validation';
```

b. Replace the two inline size guards (current lines 932-957):

```ts
      // Guard: each size variant must have a size value selected
      const invalidSizes = (sp.sizes || []).filter(
        (s: any) => !s.size || s.size.trim() === ''
      );
      if (invalidSizes.length > 0) {
        if (!silent)
          toast.error(
            `${invalidSizes.length} size variant(s) are missing a size selection`
          );
        return false;
      }

      // Guard: no duplicate size values in the sizes array
      const seenSizes = new Set<string>();
      for (const s of sp.sizes || []) {
        if (!s.size) continue;
        const key = String(s.size).toLowerCase().trim();
        if (seenSizes.has(key)) {
          if (!silent)
            toast.error(
              `Duplicate size value "${s.size}". Each size value can only appear once per product.`
            );
          return false;
        }
        seenSizes.add(key);
      }
```

with:

```ts
      // Guard: size variants are validated only when selling WITH variants.
      // In single-item mode the rows stay hidden (restorable) and must never
      // block the save — validateSizeVariants returns [] for that case.
      const sizeErrors = validateSizeVariants(
        sp.sizes,
        sp.sellWithoutSizeVariants === true
      );
      if (sizeErrors.length > 0) {
        if (!silent) toast.error(sizeErrors[0]);
        return false;
      }
```

- [ ] **Step 6: Run the tests for both new suites + regression**

Run (one command):
```bash
npx vitest run src/validators/sub-product.schema.test.ts src/app/shared/ecommerce/sub-product/create-edit/validation.test.ts src/app/shared/ecommerce/sub-product/sub-product-list/filtering.test.ts
```
Expected: schema 3/3, validation 6/6, filtering 35/35 — all pass.

- [ ] **Step 7: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/validation.ts client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/validation.test.ts client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/index.tsx
git commit -m "fix(subproduct): validate size rows only when selling with variants"
```

---

### Task 3: Confirmation gate + single-item notice in `sizes.tsx`

**Files:**
- Modify: `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/sizes.tsx`

**Interfaces:**
- Consumes: `useFormContext` (`setValue`, `watch`), `useFieldArray` `fields`, `useState` (already imported at line 4), rizzui `Switch`, `Modal` (new import), framer-motion `motion` + `cardVariants`, icons `PiInfo`, `PiWarning`, `PiCheck`, `PiX` (all already imported except `PiInfo` which IS imported at line 32; `PiWarning` line 18; `PiCheck` line 17; `PiX` line 19).
- Produces: no external API change; the toggle commit path (`subProductData.sellWithoutSizeVariants` set via `setValue`) stays identical.

This file is `@ts-nocheck` and there is no component-test harness in this repo — correctness for this task is verified by review + the manual checklist in Step 6. tsc will not check it.

- [ ] **Step 1: Import `Modal`**

In `client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/sizes.tsx`, after line 6:

```ts
import { Input, Text, Button, Switch, Badge } from 'rizzui';
```

add:

```ts
import { Modal } from 'rizzui/modal';
```

- [ ] **Step 2: Add confirmation state**

After the `sellWithoutSizeVariants` watch (ends line 441 with `);`), add:

```tsx
  const [confirmSingleItem, setConfirmSingleItem] = useState(false);
```

- [ ] **Step 3: Gate the Switch's turn-ON**

Replace the current `Switch` `onChange` handler (lines 620-624):

```tsx
              onChange={(checked) => {
                field.onChange(checked);
                setValue('subProductData.sellWithoutSizeVariants', checked);
              }}
```

with:

```tsx
              onChange={(checked) => {
                // Safety gate: turning ON while sizes are configured asks
                // first, so a seller can't silently lose their variants.
                // Rows stay hidden (not deleted) — toggling back restores them.
                if (checked && fields.length > 0) {
                  setConfirmSingleItem(true);
                  return;
                }
                field.onChange(checked);
                setValue('subProductData.sellWithoutSizeVariants', checked);
              }}
```

- [ ] **Step 4: Add the single-item inline notice**

After the toggle card closing `</motion.div>` (line 627) and BEFORE `<AnimatePresence mode="wait">` (line 629), insert:

```tsx
      {sellWithoutSizeVariants && (
        <motion.div
          variants={fieldStaggerVariants}
          custom={2}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <PiInfo className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <Text className="text-sm font-medium text-gray-800">
                Selling as a single item
              </Text>
              <Text className="mt-0.5 text-sm text-gray-500">
                One price &amp; one stock. Price lives in{' '}
                <span className="font-semibold text-gray-700">Pricing</span>,
                stock lives in{' '}
                <span className="font-semibold text-gray-700">Inventory</span>.
              </Text>
            </div>
          </div>
        </motion.div>
      )}
```

- [ ] **Step 5: Add the confirmation Modal**

After `</AnimatePresence>` (line 929) and BEFORE the root closing `</motion.div>` (line 930), insert:

```tsx
      {/* Confirm turning off size variants */}
      <Modal
        isOpen={confirmSingleItem}
        onClose={() => setConfirmSingleItem(false)}
        size={{ sm: 'max-w-md', md: 'max-w-md', lg: 'max-w-md' }}
        className="[&>div]:p-0 [&>div]:rounded-2xl overflow-hidden"
        overlayClassName="bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          custom={0}
          className="overflow-hidden"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <PiWarning className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Sell without size variants?
                  </h2>
                  <p className="text-xs text-white/70">
                    Replace your variants with a single Unit item
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmSingleItem(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-all hover:bg-white/20 hover:text-white"
              >
                <PiX className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
              <Text className="text-sm text-gray-700">
                Your{' '}
                <span className="font-semibold text-gray-900">
                  {fields.length} configured size variant
                  {fields.length !== 1 ? 's' : ''}
                </span>{' '}
                will be replaced by a single{' '}
                <span className="font-semibold text-gray-900">Unit</span> item
                when you save. They stay in this form until then — turn this
                back off to restore them.
              </Text>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmSingleItem(false)}
                className="w-full sm:w-auto"
              >
                Keep Size Variants
              </Button>
              <Button
                type="button"
                className="w-full min-w-[140px] sm:w-auto"
                onClick={() => {
                  setValue('subProductData.sellWithoutSizeVariants', true);
                  setConfirmSingleItem(false);
                }}
              >
                <span className="flex items-center gap-2">
                  <PiCheck className="h-4 w-4" />
                  Sell Without Variants
                </span>
              </Button>
            </div>
          </div>
        </motion.div>
      </Modal>
```

- [ ] **Step 6: Manual verification checklist**

With `npm run dev` in `client/apps/admin` (boot the admin app and log in as a tenant admin):

1. Sub-Products → New Sub-product → Sizes section.
2. Add ≥2 size rows → flip switch ON → modal opens with "Sell without size variants?".
3. **Keep Size Variants** → switch stays OFF, size table still visible.
4. Flip ON again → **Sell Without Variants** → table hides, amber notice "Selling as a single item" appears, switch is ON.
5. Flip OFF → table returns with the same rows (nothing lost).
6. Leave one added row with an empty size selection, flip ON (confirm), then **Save** → save succeeds (no "missing a size selection" block). Verify after save the sub-product's size became a single "Unit" (check sub-product list / POS catalog card).
7. In edit mode of a product already selling without variants: toggle renders ON with the notice visible; flipping OFF shows the Unit row.

- [ ] **Step 7: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/sub-product/create-edit/sizes.tsx
git commit -m "feat(subproduct): confirm before selling without size variants"
```

---

### Task 4: Full verification + session docs

**Files:**
- Create: `docs/superpowers/specs/RESUME-sell-without-size-variants-toggle.md`
- Modify: `docs/memory/ckay-tenant-onboarding.md`

**Interfaces:**
- Consumes: output of Tasks 1-3.

- [ ] **Step 1: Run the full relevant test set + typecheck**

Run (from `client/apps/admin`):
```bash
npx vitest run src/validators/sub-product.schema.test.ts src/app/shared/ecommerce/sub-product/create-edit/validation.test.ts src/app/shared/ecommerce/sub-product/sub-product-list/filtering.test.ts
```
Expected: schema 3/3, validation 6/6, filtering 35/35.

Then:
```bash
set -a; source .env; set +a; pnpm exec tsc --noEmit
```
Expected: only pre-existing unrelated errors (none in `validators/sub-product.schema.ts`; `sizes.tsx`/`index.tsx` are `@ts-nocheck` so excluded).

- [ ] **Step 2: Write the RESUME spec**

Create `docs/superpowers/specs/RESUME-sell-without-size-variants-toggle.md` following the existing `RESUME-*.md` format (Date / Status / What was done / Verification / Gotchas). Include: the three-layer guard fix (schema, manual helper, server-unchanged), the modal gate behavior, the keep-hidden-restore decision, the verification results, and the gotcha that `next lint` is unusable in this repo.

- [ ] **Step 3: Update session memory**

Append to `docs/memory/ckay-tenant-onboarding.md` a short section: date, feature, files touched, decisions (confirmation+safety; rows kept hidden/restorable), verification commands used.

- [ ] **Step 4: Commit**

```bash
git add -f docs/superpowers/specs/RESUME-sell-without-size-variants-toggle.md docs/memory/ckay-tenant-onboarding.md
git commit -m "docs(subproduct): record Sell Without Size Variants confirmation gate"
```

---

## Self-review notes

- **Spec coverage:** design sections map 1:1 — toggle gate + Modal (Task 3), validation-guard skip all layers (Tasks 1-2), inline notice (Task 3 Step 4), server/transformer/consumers unchanged (no task — correct, out of scope). Edge cases (no sizes → no dialog; OFF → no dialog; edit-mode Unit row) covered by Task 3 Step 6.
- **Placeholder scan:** every step has full code or exact commands; no TBD/TODO.
- **Type consistency:** `validateSizeVariants(sizes, boolean): string[]` used identically in Task 2 Steps 3-5; `MISSING_SIZE_MSG`/`DUPLICATE_SIZE_MSG` messages match the previous inline text verbatim; schema fixture uses the exported `subProductFormSchema`.