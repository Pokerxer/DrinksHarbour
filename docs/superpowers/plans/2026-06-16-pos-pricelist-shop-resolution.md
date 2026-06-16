# POS Pricelist ↔ Shop/Warehouse Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind pricelists to shops/warehouses with a tenant default, auto-resolve the pricelist for the active POS shop (with a validated manual override), and drive correct grid/card pricing from the resolved pricelist.

**Architecture:** A pure resolution core (`pickPricelistForShop`) decides which pricelist applies by precedence shop → warehouse → default, with a thin DB wrapper (`resolveShopPricelist`). The server resolves authoritatively in `getPOSProducts` and `createPOSOrder`; the client stores manual overrides keyed by active shop and applies rules client-side via the existing `applyPricelistToProduct`.

**Tech Stack:** Node.js, Mongoose 9, `node:test` (pure unit tests with dependency injection — no DB), Next.js, React, Jotai (`atomWithStorage`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-16-pos-pricelist-shop-resolution-design.md`

**Conventions:**
- Server tests are pure unit tests (no DB) — see `server/__tests__/poReceive.helpers.test.js`. Test the pure core; keep DB calls in thin wrappers.
- Client has no test runner; client tasks are verified with `npx tsc --noEmit` (ignore pre-existing `TS2688`) and described manual checks.
- Commit after every task.

---

## File Structure

- `server/models/Pricelist.js` — **modify**: add `shops`, `warehouses`, `isDefault` + index.
- `server/services/pricelist.service.js` — **create**: `pickPricelistForShop` (pure), `resolveShopPricelist` (async wrapper), `enforceSingleDefault`.
- `server/__tests__/pricelist.service.test.js` — **create**: unit tests for `pickPricelistForShop`.
- `server/routes/pricelist.routes.js` — **modify**: accept `shops`/`warehouses`/`isDefault` on create/patch; enforce single default.
- `server/routes/pos.routes.js` — **modify**: `GET /pos/pricelists?shopId=` returns allowed + resolvedId.
- `server/controllers/pos.controller.js` — **modify**: `getPOSProducts` returns `resolvedPricelistId`; `createPOSOrder` resolves authoritatively + records pricelist identity.
- `client/apps/isomorphic/src/app/shared/point-of-sale/api.ts` — **modify**: `getPricelists(token, shopId?)`.
- `client/apps/isomorphic/src/app/shared/point-of-sale/store/index.ts` — **modify**: shop-effective pricelist atoms/hooks.
- `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-session-bar.tsx` — **modify**: picker (Auto vs manual).
- `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-product-grid.tsx` / `pos-product-card.tsx` — **modify**: effective pricelist + Auto/Manual chip.
- `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-payment-modal.tsx` — **modify**: submit effective pricelist (already sends `shopId`).
- `client/apps/isomorphic/src/app/shared/point-of-sale/pos-pricelists.tsx` — **modify**: admin bindings UI.

---

## Task 1: Add binding fields to the Pricelist model

**Files:**
- Modify: `server/models/Pricelist.js`

- [ ] **Step 1: Add the three fields and an index**

In `pricelistSchema` (after the `tenant` line, before `rules`), add:

```js
  tenant:        { type: Schema.Types.ObjectId, ref: 'Tenant', required: false },

  // ── Resolution bindings (POS shop/warehouse → pricelist) ───────────────────
  // `shops` holds string ids: custom posSettings.shops subdoc ids AND the
  // built-in virtual shop ids 'retail' / 'wholesale'. Empty shops+warehouses
  // with isSelectable=true means "unscoped" — offered everywhere as a manual
  // option but never auto-resolved.
  shops:         [{ type: String }],
  warehouses:    [{ type: Schema.Types.ObjectId, ref: 'Warehouse' }],
  isDefault:     { type: Boolean, default: false },

  rules:         [priceRuleSchema],
```

Then add below the existing index line:

```js
pricelistSchema.index({ tenant: 1, name: 1 });
pricelistSchema.index({ tenant: 1, isDefault: 1 });
```

- [ ] **Step 2: Sanity-check the model loads**

Run: `cd server && node -e "require('./models/Pricelist'); console.log('ok')"`
Expected: prints `ok` (no schema errors).

- [ ] **Step 3: Commit**

```bash
git add server/models/Pricelist.js
git commit -m "feat(pricelist): add shop/warehouse/default binding fields"
```

---

## Task 2: Pure resolution core + service (TDD)

**Files:**
- Create: `server/services/pricelist.service.js`
- Test: `server/__tests__/pricelist.service.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/pricelist.service.test.js`:

```js
// server/__tests__/pricelist.service.test.js
const test = require('node:test');
const assert = require('node:assert');
const { pickPricelistForShop } = require('../services/pricelist.service');

// Helpers to build pricelist-like plain objects
const pl = (over = {}) => ({
  _id: over._id || Math.random().toString(36).slice(2),
  name: over.name || 'PL',
  isSelectable: over.isSelectable ?? false,
  shops: over.shops || [],
  warehouses: over.warehouses || [],
  isDefault: over.isDefault ?? false,
  createdAt: over.createdAt || new Date('2020-01-01'),
});

test('shop binding wins over warehouse and default', () => {
  const shopPL = pl({ _id: 's', shops: ['shop1'] });
  const whPL = pl({ _id: 'w', warehouses: ['wh1'] });
  const defPL = pl({ _id: 'd', isDefault: true });
  const { resolved } = pickPricelistForShop({
    pricelists: [defPL, whPL, shopPL], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(String(resolved._id), 's');
});

test('warehouse binding wins over default when no shop match', () => {
  const whPL = pl({ _id: 'w', warehouses: ['wh1'] });
  const defPL = pl({ _id: 'd', isDefault: true });
  const { resolved } = pickPricelistForShop({
    pricelists: [defPL, whPL], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(String(resolved._id), 'w');
});

test('falls back to the default pricelist', () => {
  const defPL = pl({ _id: 'd', isDefault: true });
  const other = pl({ _id: 'o', shops: ['shopX'] });
  const { resolved } = pickPricelistForShop({
    pricelists: [other, defPL], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(String(resolved._id), 'd');
});

test('returns null when nothing matches', () => {
  const other = pl({ _id: 'o', shops: ['shopX'] });
  const { resolved } = pickPricelistForShop({
    pricelists: [other], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(resolved, null);
});

test('unscoped selectable is in allowed but never auto-resolves', () => {
  const unscoped = pl({ _id: 'u', isSelectable: true });
  const { resolved, allowed } = pickPricelistForShop({
    pricelists: [unscoped], shopId: 'shop1', warehouseId: 'wh1',
  });
  assert.strictEqual(resolved, null);
  assert.deepStrictEqual(allowed.map((p) => String(p._id)), ['u']);
});

test('built-in retail shop resolves via the default-warehouse tier', () => {
  // Built-in 'retail' has no direct shop binding; resolveShopWarehouse maps it
  // to the default warehouse, so a warehouse-bound pricelist should resolve.
  const whPL = pl({ _id: 'w', warehouses: ['whDefault'] });
  const { resolved } = pickPricelistForShop({
    pricelists: [whPL], shopId: 'retail', warehouseId: 'whDefault',
  });
  assert.strictEqual(String(resolved._id), 'w');
});

test('tie-break is deterministic by createdAt ascending', () => {
  const older = pl({ _id: 'old', shops: ['shop1'], createdAt: new Date('2021-01-01') });
  const newer = pl({ _id: 'new', shops: ['shop1'], createdAt: new Date('2022-01-01') });
  const { resolved } = pickPricelistForShop({
    pricelists: [newer, older], shopId: 'shop1', warehouseId: null,
  });
  assert.strictEqual(String(resolved._id), 'old');
});

test('allowed set dedups across tiers and includes default + unscoped', () => {
  const shopPL = pl({ _id: 's', shops: ['shop1'] });
  const defPL = pl({ _id: 'd', isDefault: true });
  const unscoped = pl({ _id: 'u', isSelectable: true });
  const irrelevant = pl({ _id: 'x', shops: ['other'] });
  const { allowed } = pickPricelistForShop({
    pricelists: [shopPL, defPL, unscoped, irrelevant], shopId: 'shop1', warehouseId: 'wh1',
  });
  const ids = allowed.map((p) => String(p._id)).sort();
  assert.deepStrictEqual(ids, ['d', 's', 'u']);
});

test('no warehouseId: warehouse tier is skipped safely', () => {
  const whPL = pl({ _id: 'w', warehouses: ['wh1'] });
  const { resolved, allowed } = pickPricelistForShop({
    pricelists: [whPL], shopId: 'shop1', warehouseId: null,
  });
  assert.strictEqual(resolved, null);
  assert.deepStrictEqual(allowed, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && node --test __tests__/pricelist.service.test.js`
Expected: FAIL — `Cannot find module '../services/pricelist.service'`.

- [ ] **Step 3: Write the service**

Create `server/services/pricelist.service.js`:

```js
// services/pricelist.service.js
const Pricelist = require('../models/Pricelist');
const { resolveShopWarehouse } = require('./warehouse.service');

/**
 * Pure resolution core — no DB. Given the tenant's pricelists, the active
 * shopId, and its resolved warehouseId, decide:
 *   resolved — the auto-resolved pricelist by precedence shop → warehouse →
 *              default, or null.
 *   allowed  — dedup of shop-bound ∪ warehouse-bound ∪ default ∪
 *              unscoped-selectable; the set a manual override is validated
 *              against.
 * Tie-break within a tier: createdAt ascending (oldest wins), deterministic.
 */
function pickPricelistForShop({ pricelists, shopId, warehouseId }) {
  const sid = String(shopId || '');
  const wid = warehouseId ? String(warehouseId) : null;
  const list = Array.isArray(pricelists) ? pricelists : [];

  const hasShop = (p) => (p.shops || []).map(String).includes(sid);
  const hasWh = (p) => !!wid && (p.warehouses || []).map(String).includes(wid);
  const isUnscoped = (p) =>
    !!p.isSelectable && !(p.shops || []).length && !(p.warehouses || []).length;
  const byCreated = (a, b) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();

  const shopMatch = list.filter(hasShop).sort(byCreated);
  const whMatch = list.filter(hasWh).sort(byCreated);
  const defMatch = list.filter((p) => p.isDefault).sort(byCreated);
  const unscoped = list.filter(isUnscoped).sort(byCreated);

  const resolved = shopMatch[0] || whMatch[0] || defMatch[0] || null;

  const allowedMap = new Map();
  for (const p of [...shopMatch, ...whMatch, ...defMatch, ...unscoped]) {
    allowedMap.set(String(p._id), p);
  }
  return { resolved, allowed: [...allowedMap.values()] };
}

/**
 * Async wrapper: resolves the shop's warehouse, loads the tenant's pricelists,
 * and runs the pure core. Returns { resolved, allowed, warehouseId }.
 */
async function resolveShopPricelist(tenant, tenantId, shopId) {
  const warehouseId = await resolveShopWarehouse(tenant, tenantId, shopId);
  const pricelists = await Pricelist.find({ tenant: tenantId }).lean();
  const { resolved, allowed } = pickPricelistForShop({ pricelists, shopId, warehouseId });
  return { resolved, allowed, warehouseId };
}

/**
 * Ensure at most one default pricelist per tenant (mirrors Warehouse.isDefault).
 * Clears isDefault on all tenant pricelists except `exceptId`.
 */
async function enforceSingleDefault(tenantId, exceptId = null) {
  const filter = { tenant: tenantId };
  if (exceptId) filter._id = { $ne: exceptId };
  await Pricelist.updateMany(filter, { $set: { isDefault: false } });
}

module.exports = { pickPricelistForShop, resolveShopPricelist, enforceSingleDefault };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && node --test __tests__/pricelist.service.test.js`
Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/pricelist.service.js server/__tests__/pricelist.service.test.js
git commit -m "feat(pricelist): shop/warehouse/default resolution service with tests"
```

---

## Task 3: Accept bindings in pricelist CRUD + enforce single default

**Files:**
- Modify: `server/routes/pricelist.routes.js`

- [ ] **Step 1: Require the service at the top of the file**

After the existing requires (below the `auth.middleware` require), add:

```js
const { enforceSingleDefault } = require('../services/pricelist.service');
```

- [ ] **Step 2: Update the create route (`POST /`)**

Replace the body destructure and `Pricelist.create(...)` call in `router.post('/', ...)` with:

```js
    const tenantId = req.tenant?._id;
    const { name, currency, countryGroups, website, isSelectable, shops, warehouses, isDefault } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    const pl = await Pricelist.create({
      name: name.trim(), currency: currency || 'NGN',
      countryGroups: countryGroups || [], website: website || '',
      isSelectable: !!isSelectable,
      shops: Array.isArray(shops) ? shops.map(String) : [],
      warehouses: Array.isArray(warehouses) ? warehouses : [],
      isDefault: !!isDefault,
      tenant: tenantId, rules: [],
    });
    if (pl.isDefault) await enforceSingleDefault(tenantId, pl._id);
    res.status(201).json({ success: true, data: pl });
```

- [ ] **Step 3: Update the patch route (`PATCH /:id`)**

Replace the body of `router.patch('/:id', ...)` (the meta update, NOT the rules routes) with:

```js
    const { name, currency, countryGroups, website, isSelectable, shops, warehouses, isDefault } = req.body;
    const $set = {};
    if (name          !== undefined) $set.name          = name;
    if (currency      !== undefined) $set.currency       = currency;
    if (countryGroups !== undefined) $set.countryGroups  = countryGroups;
    if (website       !== undefined) $set.website        = website;
    if (isSelectable  !== undefined) $set.isSelectable   = isSelectable;
    if (shops         !== undefined) $set.shops          = Array.isArray(shops) ? shops.map(String) : [];
    if (warehouses    !== undefined) $set.warehouses     = Array.isArray(warehouses) ? warehouses : [];
    if (isDefault     !== undefined) $set.isDefault      = !!isDefault;

    const pl = await Pricelist.findByIdAndUpdate(req.params.id, { $set }, { new: true, runValidators: true }).lean();
    if (!pl) return res.status(404).json({ success: false, message: 'Pricelist not found' });
    if ($set.isDefault === true) await enforceSingleDefault(req.tenant?._id, pl._id);
    res.json({ success: true, data: pl });
```

- [ ] **Step 4: Confirm the file parses**

Run: `cd server && node -e "require('./routes/pricelist.routes'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/pricelist.routes.js
git commit -m "feat(pricelist): accept shop/warehouse/default bindings in CRUD"
```

---

## Task 4: Shop-scoped `GET /pos/pricelists`

**Files:**
- Modify: `server/routes/pos.routes.js:106-117`

- [ ] **Step 1: Replace the `/pricelists` route handler**

Replace the existing `router.get('/pricelists', ...)` block with:

```js
router.get('/pricelists', protectPOS, async (req, res, next) => {
  try {
    const Pricelist = require('../models/Pricelist');
    const tenantId = req.tenant?._id;
    const { shopId } = req.query;

    // Without a shop, fall back to the legacy all-selectable list.
    if (!shopId) {
      const filter = { isSelectable: true };
      if (tenantId) filter.tenant = tenantId;
      const pricelists = await Pricelist.find(filter)
        .select('name currency rules countryGroups website shops warehouses isDefault')
        .lean();
      return res.json({ success: true, data: { pricelists, resolvedId: null } });
    }

    // Shop-scoped: return the allowed set (with rules) + the auto-resolved id.
    const { resolveShopPricelist } = require('../services/pricelist.service');
    const { resolved, allowed } = await resolveShopPricelist(req.tenant, tenantId, shopId);
    res.json({
      success: true,
      data: {
        pricelists: allowed,
        resolvedId: resolved ? String(resolved._id) : null,
      },
    });
  } catch (err) { next(err); }
});
```

Note: `resolveShopPricelist` loads full pricelist docs (`.lean()`), so `allowed` already includes `rules` — the client needs them to apply overrides.

- [ ] **Step 2: Confirm the file parses**

Run: `cd server && node -e "require('./routes/pos.routes'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add server/routes/pos.routes.js
git commit -m "feat(pos): shop-scoped pricelists endpoint with resolvedId"
```

---

## Task 5: `getPOSProducts` returns `resolvedPricelistId`

**Files:**
- Modify: `server/controllers/pos.controller.js` (`getPOSProducts`, near `:1744` and `:1911`)

- [ ] **Step 1: Resolve the pricelist id alongside the warehouse**

Find (around line 1744):

```js
  const warehouseId = await resolveShopWarehouse(tenant, tenantId, shopId);
```

Immediately after it, add:

```js
  // Resolve the auto pricelist id for the active shop so the grid knows the
  // default selection without a separate round-trip / race.
  let resolvedPricelistId = null;
  try {
    const { resolveShopPricelist } = require('../services/pricelist.service');
    const { resolved } = await resolveShopPricelist(tenant, tenantId, shopId);
    resolvedPricelistId = resolved ? String(resolved._id) : null;
  } catch (_) { /* non-fatal — grid falls back to raw prices */ }
```

- [ ] **Step 2: Include it in the response**

Find (around line 1911):

```js
  res.json({ success: true, data: { products: filtered, total: filtered.length } });
```

Replace with:

```js
  res.json({ success: true, data: { products: filtered, total: filtered.length, resolvedPricelistId } });
```

- [ ] **Step 3: Confirm the file parses**

Run: `cd server && node -e "require('./controllers/pos.controller'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(pos): return resolvedPricelistId from getPOSProducts"
```

---

## Task 6: Server-authoritative pricelist in `createPOSOrder`

**Files:**
- Modify: `server/controllers/pos.controller.js` (`createPOSOrder`, `:1940-1947` and `:1960`)

- [ ] **Step 1: Resolve authoritatively instead of trusting the client id**

Replace the existing block (around lines 1940-1947):

```js
  // Fetch the selected pricelist once — applied to every line item's price
  let selectedPricelist = null;
  if (pricelistId) {
    try {
      const Pricelist = require('../models/Pricelist');
      selectedPricelist = await Pricelist.findById(pricelistId).select('rules').lean();
    } catch (_) { /* non-fatal — fall back to DB pricing */ }
  }
```

with:

```js
  // Resolve the pricelist AUTHORITATIVELY from the shop. The client may request
  // an override via pricelistId, but it is honored only if it belongs to the
  // shop's allowed set; otherwise we use the auto-resolved pricelist.
  let selectedPricelist = null;
  try {
    const { resolveShopPricelist } = require('../services/pricelist.service');
    const { resolved, allowed } = await resolveShopPricelist(req.tenant, tenantId, shopId);
    if (pricelistId) {
      const override = allowed.find((p) => String(p._id) === String(pricelistId));
      selectedPricelist = override || resolved || null;
    } else {
      selectedPricelist = resolved || null;
    }
  } catch (_) { /* non-fatal — fall back to DB pricing */ }
```

Note: `resolveShopPricelist` returns full lean docs including `rules` and `name`, so the existing rule-application loop (`:2038`) and the `appliedPricelist` snapshot (`:2289`, which reads `selectedPricelist.name`) both work — and `pricelistName` is now populated correctly (it was empty before because the old fetch used `.select('rules')` only).

- [ ] **Step 2: Confirm `shopId` is destructured before use**

`shopId` is already destructured from `req.body` at `:1928` and the warehouse resolution at `:1960` uses it. No change needed — the new block at Step 1 sits above `:1960` and uses the same `shopId`. Verify by reading lines 1916-1960.

- [ ] **Step 3: Confirm the file parses**

Run: `cd server && node -e "require('./controllers/pos.controller'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Run the full server test suite (no regressions)**

Run: `cd server && node --test __tests__/`
Expected: PASS — all existing tests plus `pricelist.service.test.js`.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/pos.controller.js
git commit -m "feat(pos): resolve pricelist authoritatively from shop in createPOSOrder"
```

---

## Task 7: Client API — shop-scoped `getPricelists`

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/api.ts:99-103`

- [ ] **Step 1: Add the `shopId` param and return `resolvedId`**

Replace:

```js
  async getPricelists(token: string) {
    return request<{ pricelists: any[] }>(`${API_URL}/api/pos/pricelists`, {
      headers: authHeaders(token),
    });
  },
```

with:

```js
  async getPricelists(token: string, shopId?: string) {
    const qs = new URLSearchParams();
    if (shopId) qs.set('shopId', shopId);
    return request<{ pricelists: any[]; resolvedId: string | null }>(
      `${API_URL}/api/pos/pricelists?${qs}`,
      { headers: authHeaders(token) }
    );
  },
```

- [ ] **Step 2: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "api.ts" || echo "no api.ts errors"`
Expected: `no api.ts errors`.

- [ ] **Step 3: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/api.ts
git commit -m "feat(pos): getPricelists accepts shopId, returns resolvedId"
```

---

## Task 8: Store rewiring — shop-effective pricelist

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/store/index.ts` (`:1190-1252` and `usePOSCart` pricelist read `:678-698`)

- [ ] **Step 1: Replace the pricelist atoms block**

Replace the block beginning `// ─── Pricelist (persisted — survives page refresh) ───` (the `posSelectedPricelistAtoms`, `posAvailablePricelistsAtom`, `posAvailablePricelistsLoadedAtom`, `usePOSPricelist`, `usePOSAvailablePricelists`) with:

```js
// ─── Pricelist (shop-effective) ───────────────────────────────────────────────
// The effective pricelist = manual override for the active shop (if any) else
// the server-resolved pricelist. Overrides are keyed by shop id and persisted;
// switching shops re-resolves (the new shop has no override → its resolved one
// shows). Carts stay terminal-keyed; only the pricelist dimension is shop-keyed.

// shopId → pricelistId ('' = explicit "no pricelist"; key absent = use resolved)
const posPricelistOverrideAtom = atomWithStorage<Record<string, string>>(
  'dh-pos-pricelist-override',
  {}
);
// Allowed set (with rules) for the active shop — fetched from the server.
const posAllowedPricelistsAtom = atom<any[]>([]);
// Auto-resolved pricelist id for the active shop.
const posResolvedPricelistIdAtom = atom<string | null>(null);
// Tracks which shop the current allowed/resolved data was fetched for.
const posPricelistLoadedShopAtom = atom<string | null>(null);

function effectiveShopKey(activeShopId: string | null) {
  return activeShopId ?? 'retail';
}

export const usePOSPricelist = () => {
  const { activeShopId } = usePOSActiveShop();
  const shopKey = effectiveShopKey(activeShopId);
  const [overrides, setOverrides] = useAtom(posPricelistOverrideAtom);
  const [allowed] = useAtom(posAllowedPricelistsAtom);
  const [resolvedId] = useAtom(posResolvedPricelistIdAtom);

  const hasOverride = Object.prototype.hasOwnProperty.call(overrides, shopKey);
  const selectedPricelist = useMemo(() => {
    if (hasOverride) {
      const ov = overrides[shopKey];
      if (!ov) return null; // explicit "no pricelist"
      return allowed.find((p) => p._id === ov) ?? null;
    }
    if (resolvedId) return allowed.find((p) => p._id === resolvedId) ?? null;
    return null;
  }, [hasOverride, overrides, shopKey, allowed, resolvedId]);

  const isManualOverride = hasOverride;

  // Sets a manual override for the active shop. null = explicit "no pricelist".
  const setSelectedPricelist = useCallback(
    (pl: any | null) => {
      setOverrides((prev) => ({ ...prev, [shopKey]: pl?._id ?? '' }));
    },
    [setOverrides, shopKey]
  );

  // Clears the override → falls back to the auto-resolved pricelist.
  const clearOverride = useCallback(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[shopKey];
      return next;
    });
  }, [setOverrides, shopKey]);

  return { selectedPricelist, setSelectedPricelist, clearOverride, isManualOverride };
};

/** Shop-scoped allowed pricelists + auto-resolved id (fetched on shop change). */
export const usePOSAvailablePricelists = () => {
  const { activeShopId } = usePOSActiveShop();
  const shopKey = effectiveShopKey(activeShopId);
  const [pricelists, setPricelists] = useAtom(posAllowedPricelistsAtom);
  const [resolvedId, setResolvedId] = useAtom(posResolvedPricelistIdAtom);
  const [loadedShop, setLoadedShop] = useAtom(posPricelistLoadedShopAtom);

  const load = useCallback(
    async (token: string) => {
      if (loadedShop === shopKey) return;
      try {
        const { posApi } = await import('@/app/shared/point-of-sale/api');
        const data = await posApi.getPricelists(token, shopKey);
        setPricelists(data.pricelists || []);
        setResolvedId(data.resolvedId ?? null);
        setLoadedShop(shopKey);
      } catch {
        /* silent — picker shows empty gracefully */
      }
    },
    [loadedShop, shopKey, setPricelists, setResolvedId, setLoadedShop]
  );

  const invalidate = useCallback(() => setLoadedShop(null), [setLoadedShop]);

  return { pricelists, resolvedId, loaded: loadedShop === shopKey, load, invalidate };
};
```

- [ ] **Step 2: Point `usePOSCart` at the effective pricelist**

In `usePOSCart` (around lines 678-698), remove the terminal-keyed pricelist atom selection and its `useAtom` read:

Delete:

```js
  const pricelistAtom =
    terminal === 'wholesale'
      ? posSelectedPricelistAtoms.wholesale
      : posSelectedPricelistAtoms.retail;
```

and delete:

```js
  // Pricelist is applied dynamically so the total stays live as selection changes
  const [selectedPricelist] = useAtom(pricelistAtom);
```

Then, near the top of `usePOSCart` (right after `const { terminal } = usePOSAuth();`), add:

```js
  const { selectedPricelist } = usePOSPricelist();
```

Everything downstream (`computeSubtotal(items, selectedPricelist ?? undefined)`) is unchanged.

- [ ] **Step 3: Type-check the store**

Run: `cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "store/index.ts" || echo "no store errors"`
Expected: `no store errors`.

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/store/index.ts
git commit -m "feat(pos): shop-effective pricelist store (override per shop + resolved)"
```

---

## Task 9: Pricelist picker (Auto vs manual) in the session bar

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-session-bar.tsx:482-560`

- [ ] **Step 1: Read the new hook shape and re-load on shop change**

Replace:

```js
  const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();
  const { pricelists, loaded, load } = usePOSAvailablePricelists();
```

with:

```js
  const { selectedPricelist, setSelectedPricelist, clearOverride, isManualOverride } = usePOSPricelist();
  const { pricelists, resolvedId, load } = usePOSAvailablePricelists();
  const { activeShopId } = usePOSActiveShop();
```

Ensure `usePOSActiveShop` is imported from the store (add it to the existing import from `@/app/shared/point-of-sale/store` if missing).

- [ ] **Step 2: Re-fetch when the active shop changes**

Replace the effect:

```js
  useEffect(() => {
    if (token) load(token);
  }, ...);
```

with (depend on `activeShopId` so switching shops refetches the allowed set + resolved id):

```js
  useEffect(() => {
    if (token) load(token);
  }, [token, activeShopId, load]);
```

- [ ] **Step 3: Replace the "No pricelist" entry with an "Auto" entry**

Find the button that calls `setSelectedPricelist(null)` (around line 533) and change its handler to `clearOverride()`, and its active state to "not a manual override":

```jsx
          <button
            onClick={() => {
              clearOverride();
            }}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${!isManualOverride ? 'bg-[#b20202]/5 font-semibold text-[#b20202]' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {!isManualOverride ? (
```

And update its label text to indicate auto-resolution, e.g. replace the inner label with:

```jsx
            <span>
              Auto
              {resolvedId
                ? ` · ${pricelists.find((p) => p._id === resolvedId)?.name ?? 'resolved'}`
                : ' · no pricelist'}
            </span>
```

- [ ] **Step 4: Update the trigger label to show Auto/Manual state**

Where the trigger renders `{selectedPricelist?.name || 'Pricelist'}` (around line 518), change to:

```jsx
          {selectedPricelist?.name || 'Auto'}
          {!isManualOverride && (
            <span className="ml-1 rounded bg-gray-200 px-1 text-[10px] font-medium uppercase text-gray-600">
              Auto
            </span>
          )}
```

(The per-pricelist `setSelectedPricelist(pl)` buttons in the list stay as-is — selecting one now writes a per-shop override.)

- [ ] **Step 5: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "pos-session-bar" || echo "no session-bar errors"`
Expected: `no session-bar errors`.

- [ ] **Step 6: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-session-bar.tsx
git commit -m "feat(pos): session-bar picker shows Auto vs manual pricelist override"
```

---

## Task 10: Grid + card display use the effective pricelist

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-product-grid.tsx` (`:243`, `:630-636`)
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-product-card.tsx` (`PricelistBreakdown`, `:55-275`)

- [ ] **Step 1: Grid — effective pricelist is already read via `usePOSPricelist`**

`pos-product-grid.tsx:243` already does `const { selectedPricelist } = usePOSPricelist();` — after Task 8 this is the effective (resolved-or-override) pricelist with no code change. Confirm the banner at `:630-636` reflects state by replacing it with:

```jsx
      {selectedPricelist && (
        <div className="...existing classes...">
          Pricelist: <strong>{selectedPricelist.name}</strong> — prices reflect this list
        </div>
      )}
```

(Keep the existing wrapper/classes; only ensure it reads `selectedPricelist` from the hook, which it does.)

- [ ] **Step 2: Card — surface Auto/Manual in `PricelistBreakdown`**

In `pos-product-card.tsx`, `PricelistBreakdown` already reads `const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();` (`:66`). Add `isManualOverride` to that destructure:

```js
  const { selectedPricelist, setSelectedPricelist, isManualOverride } = usePOSPricelist();
```

Where the breakdown renders the active pricelist name (near `:195`/`:253`), add a small chip next to the name:

```jsx
            <span className={`ml-1 rounded px-1 text-[10px] font-medium uppercase ${isManualOverride ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
              {isManualOverride ? 'Manual' : 'Auto'}
            </span>
```

The `_appliedPricelistSteps` rendering (`:1878`) is unchanged — it already shows the price chain.

- [ ] **Step 3: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep -E "pos-product-(grid|card)" || echo "no grid/card errors"`
Expected: `no grid/card errors`.

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-product-grid.tsx client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-product-card.tsx
git commit -m "feat(pos): grid/card show effective pricelist with Auto/Manual chip"
```

---

## Task 11: Checkout submits the effective pricelist

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-payment-modal.tsx` (`:1303-1315`, and the guard at `:926-964`)

- [ ] **Step 1: Confirm the submit already uses the effective pricelist**

At `:1314-1315` the payload sends `pricelistId: selectedPricelist?._id ?? undefined` and `shopId: activeShop?._id`. After Task 8, `selectedPricelist` (from `usePOSPricelist`) is the effective pricelist, so this is already correct. No change needed if `selectedPricelist` here comes from `usePOSPricelist()`.

Verify by grepping:

Run: `cd client/apps/isomorphic && grep -n "usePOSPricelist\|selectedPricelist" src/app/shared/point-of-sale/components/pos-payment-modal.tsx`
Expected: `selectedPricelist` originates from `usePOSPricelist()`.

- [ ] **Step 2: Keep the reward/pricelist-eligibility guard working**

The guard at `:926-964` checks `!c.pricelistIds.includes(selectedPricelistId)`. Ensure `selectedPricelistId` is derived from the effective `selectedPricelist?._id`. If a local `selectedPricelistId` variable exists, set it to `selectedPricelist?._id ?? ''`. No behavior change beyond using the effective id.

- [ ] **Step 3: Type-check the whole POS surface**

Run: `cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "point-of-sale" || echo "no POS type errors"`
Expected: `no POS type errors`.

- [ ] **Step 4: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/components/pos-payment-modal.tsx
git commit -m "feat(pos): checkout submits the shop-effective pricelist"
```

---

## Task 12: Admin bindings UI

**Files:**
- Modify: `client/apps/isomorphic/src/app/shared/point-of-sale/pos-pricelists.tsx`

- [ ] **Step 1: Load shops + warehouses for the binding selectors**

In the pricelist create/edit form component, fetch the tenant's shops (custom + built-in `retail`/`wholesale`) and warehouses. Reuse the admin token already used by the page. Add state:

```jsx
  const [shops, setShops] = useState<string[]>(initial?.shops ?? []);
  const [warehouses, setWarehouses] = useState<string[]>(initial?.warehouses ?? []);
  const [isDefault, setIsDefault] = useState<boolean>(initial?.isDefault ?? false);
```

Built-in shop options to always include: `[{ _id: 'retail', name: 'Retail (built-in)' }, { _id: 'wholesale', name: 'Wholesale (built-in)' }]`, concatenated with custom shops from the existing shops list/endpoint, plus warehouses from the warehouses endpoint already used elsewhere in admin.

- [ ] **Step 2: Render the three controls**

Add to the form body (use the project's existing multiselect/checkbox components — match surrounding inputs):

```jsx
      <MultiSelect label="Applies to shops" value={shops} onChange={setShops} options={shopOptions} />
      <MultiSelect label="Applies to warehouses" value={warehouses} onChange={setWarehouses} options={warehouseOptions} />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Default pricelist for this tenant
      </label>
```

(Replace `MultiSelect` with whatever the file already uses for multi-value selection; if none exists, use a set of checkboxes mirroring `pos-loyalty.tsx`'s `PricelistPicker` pattern.)

- [ ] **Step 3: Include bindings in the create/update payload**

Where the form calls the create (`POST /api/pricelists`) and update (`PATCH /api/pricelists/:id`) endpoints, add `shops, warehouses, isDefault` to the request body objects.

- [ ] **Step 4: Soft warning for duplicate shop binding**

After loading the pricelist list, compute shop ids bound by more than one pricelist and show an inline note near the Shops selector when the current selection overlaps:

```jsx
      {duplicateShopBindings.length > 0 && (
        <p className="text-xs text-amber-600">
          Note: {duplicateShopBindings.join(', ')} are bound by multiple pricelists; the oldest wins.
        </p>
      )}
```

- [ ] **Step 5: Show a Default badge + binding summary in the list view**

In the pricelist list row, render a "Default" badge when `pl.isDefault` and a compact summary of `pl.shops.length` shops / `pl.warehouses.length` warehouses.

- [ ] **Step 6: Type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | grep "pos-pricelists" || echo "no pos-pricelists errors"`
Expected: `no pos-pricelists errors`.

- [ ] **Step 7: Commit**

```bash
git add client/apps/isomorphic/src/app/shared/point-of-sale/pos-pricelists.tsx
git commit -m "feat(pricelist): admin UI for shop/warehouse/default bindings"
```

---

## Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full server test suite**

Run: `cd server && node --test __tests__/`
Expected: PASS — all tests green, including `pricelist.service.test.js`.

- [ ] **Step 2: Run the client type-check**

Run: `cd client/apps/isomorphic && npx tsc --noEmit 2>&1 | grep -v TS2688 | tee /tmp/tsc.out; test ! -s /tmp/tsc.out && echo "TYPECHECK CLEAN"`
Expected: `TYPECHECK CLEAN` (only pre-existing `TS2688` errors, which are filtered out).

- [ ] **Step 3: Manual smoke (described)**

1. Admin: create Pricelist "Wholesale WH-A", bind to warehouse WH-A; create "Store-1 Special", bind to shop Store-1; mark a third as Default.
2. POS: switch active shop to Store-1 → grid shows "Store-1 Special" with an **Auto** chip; switch to a shop bound only to WH-A → shows "Wholesale WH-A"; switch to an unbound shop → shows the Default.
3. Manually pick a different pricelist → chip shows **Manual**; switch shops → override drops, Auto returns.
4. Complete a sale; confirm the receipt/order `appliedPricelist` shows the pricelist name actually used, and tampering with the client `pricelistId` to one outside the allowed set falls back to the resolved pricelist server-side.

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore(pos): verification fixes for pricelist shop resolution"
```

---

## Self-Review notes

- **Spec coverage:** §1 model → Task 1; §2 service/endpoints/order authority → Tasks 2,4,5,6; §3 client store/display → Tasks 7,8,9,10,11; §4 admin → Tasks 3,12; §5 testing/verification → Tasks 2,6,13. All covered.
- **Type/name consistency:** `pickPricelistForShop`, `resolveShopPricelist`, `enforceSingleDefault`, `resolvedPricelistId`/`resolvedId`, `clearOverride`, `isManualOverride`, `posPricelistOverrideAtom` used consistently across tasks.
- **Back-compat:** unscoped selectable pricelists remain in `allowed` everywhere (Task 2 test); `GET /pos/pricelists` without `shopId` keeps the legacy list (Task 4).
