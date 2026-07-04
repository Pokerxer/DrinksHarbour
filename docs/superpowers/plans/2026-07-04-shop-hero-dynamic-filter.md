# Shop Hero — Dynamic Filter Reaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/shop` hero banner reflect the active applied filter (category / subcategory / brand) robustly, including multi-select, instead of silently falling back to the generic "All Drinks" theme.

**Architecture:** All changes are contained in one client component, `ShopHeroBanner.tsx`. A pure resolver reads the (possibly comma-joined) `category` / `subcategory` params, normalizes them to arrays, picks a single primary theme (first category → else parent of first subcategory → else default), and drives the headline, a count-aware subtitle, and a `Set`-based active state for the chip rail. `ShopClient.tsx` already passes the raw params, so it needs no change (verified in Task 3).

**Tech Stack:** Next.js 16 (App Router, client component), React 19, TypeScript, framer-motion, Tailwind.

## Global Constraints

- No test runner exists in `client/apps/platform` — verification is `npx tsc --noEmit` (no NEW errors referencing `ShopHeroBanner`) plus the manual browser checks in Task 4. Do NOT add a test framework.
- Touch only `client/apps/platform/src/components/Shop/ShopHeroBanner.tsx` (Tasks 1–2). Task 3 is a read-only verification of `ShopClient.tsx`. No server / API / product-query changes.
- Never show the flat `DEFAULT_CONFIG` ("All Drinks") theme while a category or subcategory filter is active.
- Preserve existing exact copy in `CONFIGS`, `SUBCAT_LABELS`, `SUBCAT_PARENT`, `DEFAULT_CONFIG` — do not edit those maps.
- Package manager is pnpm; run type-check from `client/apps/platform`.

---

### Task 1: Array-aware theme + count-subtitle resolver

Replace the single-value `useMemo` resolver and the label derivation so multi-select category/subcategory produces a themed hero with a count subtitle, never the generic fallback.

**Files:**
- Modify: `client/apps/platform/src/components/Shop/ShopHeroBanner.tsx` (props type ~351-356; resolver `useMemo` ~386-400; label derivation ~396-400; brandLabel ~403-405)

**Interfaces:**
- Consumes: existing module maps `CONFIGS`, `SUBCAT_PARENT`, `SUBCAT_LABELS`, `DEFAULT_CONFIG` (unchanged).
- Produces (used by Task 2's chip rail): `activeSubs: Set<string>`, `activeCats: Set<string>`, `isDefault: boolean`, and `config: CategoryConfig`.

- [ ] **Step 1: Widen the props type to accept arrays**

Find (~line 351-356):
```tsx
interface ShopHeroBannerProps {
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  totalProducts?: number;
}
```
Replace with:
```tsx
interface ShopHeroBannerProps {
  category?: string | string[] | null;
  subcategory?: string | string[] | null;
  brand?: string | string[] | null;
  totalProducts?: number;
}
```

- [ ] **Step 2: Add a `toList` normalizer above the component**

Insert immediately BEFORE `export default function ShopHeroBanner(` (~line 377):
```tsx
// Normalize a possibly comma-joined param into a lowercase, trimmed slug list.
function toList(v?: string | string[] | null): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : v.split(',');
  return arr.map((s) => s.trim().toLowerCase()).filter(Boolean);
}
```

- [ ] **Step 3: Replace the resolver `useMemo`**

Find (~line 386-393):
```tsx
  // Resolve config
  const { config, activeSub, isDefault } = useMemo(() => {
    const cat = typeof category === 'string' ? category.toLowerCase() : null;
    const sub = typeof subcategory === 'string' ? subcategory.toLowerCase() : null;
    const parentCat = sub ? (SUBCAT_PARENT[sub] ?? cat) : cat;
    const cfg = parentCat ? (CONFIGS[parentCat] ?? null) : null;
    return { config: cfg ?? DEFAULT_CONFIG, activeSub: sub, isDefault: !parentCat };
  }, [category, subcategory]);
```
Replace with:
```tsx
  // Resolve theme from active filters (single or multi-select).
  const { config, activeSubs, activeCats, isDefault, countSubtitle, singleSub } = useMemo(() => {
    const cats = toList(category);
    const subs = toList(subcategory);
    // Primary theme: first selected category, else parent of first subcategory.
    const parentCat = cats[0] ?? (subs[0] ? (SUBCAT_PARENT[subs[0]] ?? null) : null);
    const cfg = parentCat ? (CONFIGS[parentCat] ?? null) : null;

    let countSubtitle: string | null = null;
    if (cats.length > 1) countSubtitle = `${cats.length} categories selected`;
    else if (subs.length > 1) countSubtitle = `${subs.length} styles selected`;

    return {
      config: cfg ?? DEFAULT_CONFIG,
      activeSubs: new Set(subs),
      activeCats: new Set(cats),
      isDefault: !parentCat,
      countSubtitle,
      singleSub: subs.length === 1 ? subs[0] : null,
    };
  }, [category, subcategory]);
```

- [ ] **Step 4: Update the subcategory-label + display derivation**

Find (~line 396-400):
```tsx
  // Subcategory-level overrides
  const subcatInfo = activeSub ? SUBCAT_LABELS[activeSub] : null;

  const displayLabel       = subcatInfo?.label       ?? config.label;
  const displaySubtitle    = subcatInfo?.subtitle     ?? config.subtitle;
  const displayDescription = subcatInfo?.description  ?? config.description;
```
Replace with:
```tsx
  // Subcategory-level overrides only apply when exactly one subcategory is active.
  const subcatInfo = singleSub ? SUBCAT_LABELS[singleSub] : null;

  const displayLabel       = subcatInfo?.label      ?? config.label;
  const displaySubtitle    = countSubtitle ?? subcatInfo?.subtitle ?? config.subtitle;
  const displayDescription = subcatInfo?.description ?? config.description;
```

- [ ] **Step 5: Make the brand override array-safe**

Find (~line 403-405):
```tsx
  const brandLabel = brand && !category && !subcategory
    ? brand.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;
```
Replace with:
```tsx
  const brandList = toList(brand);
  const brandLabel = brandList.length === 1 && activeCats.size === 0 && activeSubs.size === 0
    ? brandList[0].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
```

- [ ] **Step 6: Type-check**

Run: `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep -i ShopHeroBanner`
Expected: no output (no type errors referencing this file). Note: `activeSub` is now removed — Step is complete only when the chip rail in Task 2 no longer references it; expect one `activeSub`-related error here until Task 2 lands. If that is the ONLY `ShopHeroBanner` line printed, proceed to Task 2 before committing.

- [ ] **Step 7: Commit (after Task 2 clears the last `activeSub` reference)**

Do not commit yet — Task 1 and Task 2 edit the same file and must compile together. Proceed directly to Task 2.

---

### Task 2: Set-based active state in the chip rail

Make every applied subcategory (and default-rail category) chip highlight, and highlight the "All {category}" reset only when no subcategory is active.

**Files:**
- Modify: `client/apps/platform/src/components/Shop/ShopHeroBanner.tsx` (chip rail ~574-634)

**Interfaces:**
- Consumes: `activeSubs`, `activeCats`, `isDefault`, `config`, `accent`, `glow` from Task 1.

- [ ] **Step 1: Highlight active category chips in the default rail**

Find the default-rail chip (~line 583-596):
```tsx
              {DEFAULT_CONFIG.subcategories.map((chip) => (
                <Link
                  key={chip.slug}
                  href={makeCategoryUrl(chip.slug)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all hover:scale-105"
                  style={{
                    background: 'rgba(255,255,255,0.09)',
                    color: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  {chip.label}
                </Link>
              ))}
```
Replace with:
```tsx
              {DEFAULT_CONFIG.subcategories.map((chip) => {
                const isActive = activeCats.has(chip.slug);
                return (
                  <Link
                    key={chip.slug}
                    href={makeCategoryUrl(chip.slug)}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all hover:scale-105"
                    style={
                      isActive
                        ? { background: accent, color: '#000', border: `1px solid ${accent}` }
                        : {
                            background: 'rgba(255,255,255,0.09)',
                            color: 'rgba(255,255,255,0.85)',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }
                    }
                  >
                    {chip.label}
                  </Link>
                );
              })}
```

- [ ] **Step 2: Fix the "All {category}" reset active state**

Find (~line 601-613):
```tsx
                <Link
                  href={makeSubUrl(null)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                  style={
                    !activeSub
                      ? { background: accent, color: '#000', border: `1px solid ${accent}` }
                      : { background: `${glow}20`, color: accent, border: `1px solid ${glow}40` }
                  }
                >
                  All {config.label}
                </Link>
```
Replace the `!activeSub` condition with `activeSubs.size === 0`:
```tsx
                <Link
                  href={makeSubUrl(null)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                  style={
                    activeSubs.size === 0
                      ? { background: accent, color: '#000', border: `1px solid ${accent}` }
                      : { background: `${glow}20`, color: accent, border: `1px solid ${glow}40` }
                  }
                >
                  All {config.label}
                </Link>
```

- [ ] **Step 3: Set-membership highlight for per-subcategory chips**

Find (~line 614-616):
```tsx
              {config.subcategories.map((chip) => {
                const isActive = activeSub === chip.slug || activeSub === chip.slug.replace(/-/g, ' ');
                return (
```
Replace the `isActive` line with:
```tsx
              {config.subcategories.map((chip) => {
                const isActive = activeSubs.has(chip.slug) || activeSubs.has(chip.slug.replace(/-/g, ' '));
                return (
```

- [ ] **Step 4: Type-check the whole file is clean**

Run: `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep -i ShopHeroBanner`
Expected: no output. (All `activeSub` references are now gone; `activeSubs`/`activeCats` are defined and used.)

- [ ] **Step 5: Commit Tasks 1 + 2 together**

```bash
cd /Users/mac/Documents/drinksharbour
git add client/apps/platform/src/components/Shop/ShopHeroBanner.tsx
git commit -m "fix(shop): hero reflects multi-select category/subcategory filters

Resolve theme from array params (first category, else parent of first
subcategory), add count-aware subtitle, and Set-based chip highlighting so
the hero never falls back to the generic theme while a filter is active.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Verify `ShopClient` passes raw params (no change expected)

Confirm the hero receives the full, comma-joined param string so multi-select reaches the resolver.

**Files:**
- Read only: `client/apps/platform/src/app/shop/ShopClient.tsx:630-638`

- [ ] **Step 1: Inspect the invocation**

Run: `grep -n -A6 "Category / subcategory hero banner" client/apps/platform/src/app/shop/ShopClient.tsx`
Expected: the component is passed `category={categoryParam}` and `subcategory={subcategoryParam}` — the raw `searchParams.get(...)` values (which retain commas). If instead it passes the split `category`/`subcategory` locals, change those two props to `categoryParam` / `subcategoryParam`. Otherwise no change.

- [ ] **Step 2: If a change was needed, type-check and commit**

Run: `cd client/apps/platform && npx tsc --noEmit 2>&1 | grep -i ShopClient`
Expected: no output.
```bash
git add client/apps/platform/src/app/shop/ShopClient.tsx
git commit -m "fix(shop): pass raw category params to hero for multi-select"
```
(If no change was needed, skip this task's commit.)

---

### Task 4: Manual browser verification

No automated tests exist; verify behavior in the running app.

**Files:** none.

- [ ] **Step 1: Start the platform app**

Run: `cd client/apps/platform && pnpm dev` (serves on port 3002).

- [ ] **Step 2: Walk the verification matrix at `http://localhost:3002/shop`**

Confirm each:
- [ ] `?category=whisky` → Whisky theme + copy, whisky chip rail.
- [ ] `?subcategory=single-malt` → "Single Malt Whisky" copy, whisky theme, `single-malt` chip active, "All Whisky" not active.
- [ ] Sidebar: select Whisky + Wine → hero themed to the FIRST selected, subtitle reads "2 categories selected", both category chips highlighted, NOT the generic "All Drinks" theme.
- [ ] Sidebar: under Whisky select two subcategories → whisky theme, subtitle "2 styles selected", both subcategory chips highlighted.
- [ ] Clear all filters → returns to "All Drinks" `DEFAULT_CONFIG` theme.
- [ ] `?brand=johnnie-walker` (no category/subcategory) → brand headline "Johnnie Walker".

- [ ] **Step 3: Note results**

Record pass/fail per row. If any row fails, stop and diagnose before considering the piece done.

---

## Self-Review Notes

- **Spec coverage:** Bug 1 (multi-select fallback) → Task 1. Bug 2 (single-chip highlight) → Task 2. `ShopClient` param passing → Task 3. Verification matrix → Task 4. Bug 3 (param-wipe) intentionally excluded per spec.
- **No placeholders:** every code step shows exact find/replace content.
- **Type consistency:** `activeSubs`/`activeCats` (Set<string>), `countSubtitle`, `singleSub`, `isDefault`, `config` produced in Task 1 and consumed by Task 2; the old `activeSub` is fully removed by end of Task 2.
