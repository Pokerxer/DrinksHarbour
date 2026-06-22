# Sales Create — Odoo-Style Layout Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `sales-create.tsx`'s presentation layer to match Odoo's quotation-editor visual structure (status pills, two-column fields, Order Lines / Other Info tabs, restyled line-items table, bottom totals) — zero behavior change.

**Architecture:** Single-file presentation rewrite. All existing state, handlers, validation, and the `salesOrderService.create` payload stay byte-identical; only the JSX returned by `SalesCreate()` is restructured, plus one new local `tab` state (`'lines' | 'other'`) to drive the two content tabs and one `useMemo` for a display-only "today" date string.

**Tech Stack:** Next.js App Router, React, TypeScript (strict), Tailwind CSS — same as the rest of `shared/sales/*`.

## Global Constraints

- This is a presentation-only change: no new props, no new service calls, no new payload fields, no new files. The component's public contract (default export, no props, same `salesOrderService.create` call shape) is unchanged.
- Per the spec (`docs/superpowers/specs/2026-06-22-sales-create-odoo-layout-design.md`): no Invoice/Delivery Address, no Payment Terms, no order-line sections/notes/catalog, no coupons/rewards, no chatter panel, no pro-forma/print, no tax row — those are explicitly deferred to separate future cycles.
- Tailwind convention to match: brand red `#b20202` / `#9a0101` hover, `rounded-lg`/`rounded-xl` borders in `border-gray-200`, `text-sm`, toast via `react-hot-toast` (unchanged — no toast behavior changes in this plan).
- Client typecheck must stay clean: `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` must show no new errors beyond the existing 27 `TS2688` baseline.
- No automated test runner exists for this frontend — verification is `tsc --noEmit` + manual browser exercise via a running dev server.
- Keep the file readable despite the added markup; a tiny local `StagePill` presentational helper (defined in the same file, not a new file) keeps the main render function uncluttered — per the spec, no new files are created.

---

### Task 1: Restructure `sales-create.tsx`'s render layer

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/sales/sales-create.tsx` (full-file rewrite of the JSX return + two small additions to component state/memo — all logic above the `return` statement is otherwise unchanged)

**Interfaces:**
- Consumes: unchanged — `salesOrderService.create` (Task 1 of the original Stage A plan), `CustomerSearch`/`ProductLineSearch`/`useSalesCustomerPricelist` (Task 3 of Stage A), `fmtCur` (existing `purchases-analytics-helpers`), `computeItemPriceWithPricelist`/`POSCartItem` (existing POS primitives).
- Produces: no new exports — same default export `SalesCreate()`, no props, used identically by `app/(hydrogen)/sales/create/page.tsx` (untouched).

- [ ] **Step 1: Replace the full file content**

Replace the entire contents of `client/apps/isomorphic/src/app/shared/sales/sales-create.tsx` with:

```typescript
// client/apps/isomorphic/src/app/shared/sales/sales-create.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiCheck,
  PiFloppyDisk,
  PiPlus,
  PiTrash,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService } from '@/services/salesOrder.service';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';
import type { POSCartItem } from '@/app/shared/point-of-sale/types';
import { computeItemPriceWithPricelist } from '@/app/shared/point-of-sale/store';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import CustomerSearch from './customer-search';
import ProductLineSearch, {
  type ProductLineSelection,
} from './product-line-search';
import { useSalesCustomerPricelist } from './use-sales-customer-pricelist';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

const INLINE_CELL_CLS =
  'w-full border-0 border-b border-transparent bg-transparent px-1 py-1 text-right text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-0';

interface DraftLine {
  key: string;
  subProductId: string;
  product?: string;
  name: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  baseUnitPrice: number;
  discount: number;
  costPrice: number;
}

function blankLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    subProductId: '',
    name: '',
    sku: '',
    quantity: 1,
    baseUnitPrice: 0,
    discount: 0,
    costPrice: 0,
  };
}

/** Live unit price after pricelist rules, via the shared pure pricing function. */
function liveUnitPrice(line: DraftLine, pricelist: any): number {
  if (!line.subProductId || !pricelist) return line.baseUnitPrice;
  const pricingItem: POSCartItem = {
    subProductId: line.subProductId,
    productId: line.product ?? line.subProductId,
    sizeId: line.sizeId,
    name: line.name,
    variant: line.sizeName ?? '',
    sku: line.sku,
    price: line.baseUnitPrice,
    quantity: line.quantity,
    discount: 0,
    stock: 0,
    costPrice: line.costPrice,
  };
  return computeItemPriceWithPricelist(pricingItem, pricelist);
}

function lineTotalOf(unitPrice: number, discount: number, quantity: number) {
  return Math.max(0, unitPrice - discount) * quantity;
}

type CreateTab = 'lines' | 'other';

/** Non-interactive lifecycle-stage indicator — visual parity only, no click behavior. */
function StagePill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-[#b20202]/10 text-[#b20202]' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {label}
    </span>
  );
}

export default function SalesCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<CreateTab>('lines');

  const today = useMemo(
    () => new Date().toLocaleDateString(undefined, { dateStyle: 'medium' }),
    []
  );

  const { selected: pricelist, resolvedId } = useSalesCustomerPricelist(
    token,
    customer?._id ?? ''
  );

  const updateLine = useCallback((key: string, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }, []);

  const addLine = useCallback(() => setLines((p) => [...p, blankLine()]), []);
  const removeLine = useCallback(
    (key: string) => setLines((p) => p.filter((l) => l.key !== key)),
    []
  );

  const priced = useMemo(
    () =>
      lines.map((l) => {
        const unitPrice = liveUnitPrice(l, pricelist);
        return {
          ...l,
          unitPrice,
          lineTotal: lineTotalOf(unitPrice, l.discount, l.quantity),
        };
      }),
    [lines, pricelist]
  );

  const grandTotal = priced.reduce((s, l) => s + l.lineTotal, 0);
  const hasLines = lines.some((l) => l.subProductId);

  async function handleSave(asOrder: boolean) {
    const filled = priced.filter((l) => l.subProductId);
    if (filled.length === 0) {
      toast.error('Add at least one product line');
      return;
    }
    const badQty = filled.find((l) => !(l.quantity > 0));
    if (badQty) {
      toast.error(`Quantity for "${badQty.name}" must be at least 1`);
      return;
    }
    setSaving(true);
    try {
      const res = await salesOrderService.create(
        {
          docType: asOrder ? 'order' : 'quotation',
          customer: customer?._id,
          customerSnapshot: customer
            ? {
                name: `${customer.firstName} ${customer.lastName}`.trim(),
                phone: customer.phone,
                email: customer.email,
                customerId: customer._id,
              }
            : undefined,
          pricelist: resolvedId ?? undefined,
          appliedPricelist: pricelist
            ? { pricelistId: pricelist._id, pricelistName: pricelist.name }
            : undefined,
          items: filled.map((l) => ({
            product: l.product,
            subproduct: l.subProductId,
            size: l.sizeId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
          validUntil: validUntil || undefined,
          notes: notes || undefined,
          terms: terms || undefined,
        },
        token
      );
      toast.success(asOrder ? 'Order created' : 'Quotation saved');
      router.push(routes.eCommerce.salesDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.salesOrders}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Sales
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Sale</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">New</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Save as a quotation or create the order directly.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving || !hasLines}
              className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" />
              {saving ? 'Saving…' : 'Create Order'}
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving || !hasLines}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <PiFloppyDisk className="h-4 w-4" />
              Save as Quotation
            </button>
            <Link
              href={routes.eCommerce.salesOrders}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <StagePill label="Quotation" active />
            <StagePill label="Quotation Sent" active={false} />
            <StagePill label="Sales Order" active={false} />
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-x-10 gap-y-5 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Customer
          </label>
          <CustomerSearch
            token={token}
            selected={customer}
            onSelect={setCustomer}
            onClear={() => setCustomer(null)}
          />
          {pricelist && (
            <p className="mt-2 text-xs text-emerald-600">
              Pricelist &quot;{pricelist.name}&quot; auto-applied from this
              customer.
            </p>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Quotation Date
            </label>
            <p className="rounded-lg border border-transparent px-3 py-2 text-sm text-gray-700">
              {today}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Expiration
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex border-b border-gray-200 px-4">
          <button
            type="button"
            onClick={() => setTab('lines')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              tab === 'lines'
                ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Order Lines
          </button>
          <button
            type="button"
            onClick={() => setTab('other')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              tab === 'other'
                ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Other Info
          </button>
        </div>

        <div className="p-5">
          {tab === 'lines' ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Product
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Qty
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Unit Price
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Discount
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Line Total
                    </th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {priced.map((line) => (
                    <tr key={line.key}>
                      <td className="px-2 py-2">
                        <ProductLineSearch
                          token={token}
                          query={line.name}
                          onSelect={(info: ProductLineSelection) =>
                            updateLine(line.key, {
                              subProductId: info.subProductId,
                              product: info.productId,
                              name: info.name,
                              sku: info.sku,
                              sizeId: info.sizeId,
                              sizeName: info.sizeName,
                              baseUnitPrice: info.sellingPrice,
                              costPrice: info.costPrice,
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, {
                              quantity: Math.max(
                                1,
                                Number(e.target.value) || 1
                              ),
                            })
                          }
                          className={`${INLINE_CELL_CLS} w-16`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-medium text-gray-900">
                        {fmtCur(line.unitPrice, 'NGN')}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          value={line.discount}
                          onChange={(e) =>
                            updateLine(line.key, {
                              discount: Math.max(
                                0,
                                Number(e.target.value) || 0
                              ),
                            })
                          }
                          className={`${INLINE_CELL_CLS} w-24`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-semibold text-gray-900">
                        {fmtCur(line.lineTotal, 'NGN')}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <PiTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                onClick={addLine}
                className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#b20202] hover:underline"
              >
                <PiPlus className="h-3.5 w-3.5" /> Add a product
              </button>

              <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                <div className="flex w-full max-w-xs items-center justify-between text-base font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{fmtCur(grandTotal, 'NGN')}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Terms
                </label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={2}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/mac/Documents/drinksharbour/.claude/worktrees/sales-frontend/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -c "TS2688"`
Expected: `27` (unchanged baseline).
Run: `cd /Users/mac/Documents/drinksharbour/.claude/worktrees/sales-frontend/client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -v "TS2688"`
Expected: no output (no new errors).

- [ ] **Step 3: Manual browser verification**

With the server + client dev servers running, navigate to `/sales/create` and confirm:
1. The stage-pill row renders: "Quotation" highlighted red, "Quotation Sent" and "Sales Order" grayed out, neither clickable (no `onClick`, no cursor-pointer/hover style on them — they're plain `<span>`s).
2. The two-column field block shows Customer (left) and Quotation Date (today's date, read-only text) + Expiration (date picker, same as the old "Valid Until") on the right.
3. The "Order Lines" tab is active by default and shows the line-items table with the same columns as before (Product/Qty/Unit Price/Discount/Line Total), Qty and Discount cells now look like plain text until clicked/focused (borderless, with a red bottom-border appearing on focus).
4. Clicking "Other Info" switches to the Notes/Terms textareas; clicking back to "Order Lines" returns to the table without losing any entered data (tab switch must not unmount/reset state — confirm by typing in Notes, switching to Order Lines and back, and seeing the typed text still there).
5. "+ Add a product" (replacing the old "Add Line" button) adds a new empty row.
6. Pick a customer with an assigned pricelist (per the original Stage A verification notes) — confirm the green "Pricelist auto-applied" note still appears under Customer, and product line pricing still live-updates against the pricelist exactly as before this restyle.
7. "Save as Quotation" and "Create Order" still work end-to-end (same redirect-to-detail behavior as before).

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Documents/drinksharbour/.claude/worktrees/sales-frontend
git add client/apps/isomorphic/src/app/shared/sales/sales-create.tsx
git commit -m "feat(sales): restyle create page to Odoo-style layout (status pills, two-column fields, Order Lines/Other Info tabs)"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-22-sales-create-odoo-layout-design.md`):
- Status pill row (Quotation active, Sent/Order grayed, non-interactive) → Step 1 (`StagePill`). ✓
- Action buttons unchanged (Save as Quotation / Create Order / Cancel), restyled position → Step 1 (same handlers, same buttons, now paired with the stage pills in a column on the right). ✓
- Two-column fields: Customer + pricelist note (left), Quotation Date (new, read-only) + Expiration (renamed from Valid Until) (right) → Step 1. ✓
- Order Lines / Other Info tabs, Notes+Terms moved into Other Info → Step 1 (`tab` state). ✓
- Restyled line-items table (borderless inline-edit look for Qty/Discount, "+ Add a product" link replacing the old button) → Step 1 (`INLINE_CELL_CLS`). ✓
- Single Total row, no Untaxed Amount → Step 1 (unchanged `grandTotal` display, no new untaxed figure). ✓
- No new files, no new backend, no chatter/coupon/reward/address/payment-terms/tax/catalog/section additions → confirmed nothing in Step 1 introduces any of these. ✓
- No changes to `sales-quotation-detail.tsx` / `sales-order-detail.tsx` → not touched by this plan. ✓

**Placeholder scan:** No TBD/TODO; all code is complete and runnable as written. ✓

**Type consistency:** `DraftLine`, `blankLine()`, `liveUnitPrice()`, `lineTotalOf()`, `priced`, `grandTotal`, `hasLines`, `handleSave()` are all copied verbatim from the current file — no signature changes. New additions (`CreateTab`, `StagePill`, `tab` state, `today` memo) are self-contained and don't alter any existing function's signature or the `salesOrderService.create()` call shape. ✓

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-sales-create-odoo-layout.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent for this task, review after, fast iteration.
2. **Inline Execution** — execute this task in this session using executing-plans, batch execution with checkpoints.

Which approach?
