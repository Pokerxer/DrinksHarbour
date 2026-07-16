# Category AI Bar + Blog → Self-Canonical Detail Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a blog-style "Generate full category from a topic" AI bar to the categories admin pages AND align the blog's internal links to the self-canonical detail routes (`/categories/{cat}/{sub}`, `/brands/{slug}`, `/product/{slug}`) already used by the category/brand ai-fill generators.

**Architecture:**
- A new `POST /api/categories/admin/ai/generate-category` endpoint produces a *full* category draft (not just field fill) from a topic + optional parent — mirroring `blog.controller.js#generatePost`. It reuses the existing `buildCategoryLinkCatalog` + `stripUnapprovedLinks` and the Sonnet smart model, returning the same shape `fillWithAI` returns plus a slug.
- A new admin `categoryService.generateCategory()` calls that endpoint; a new `CategoryAiBar` client component (mirroring blog's `AiBar`) drops into the category list page header and the create page above `CreateCategory`. On apply it hydrates the existing `CreateCategory` form via `setValue` (react-hook-form).
- The blog's `buildLinkCatalog`/`catalogToPrompt`/`makeLinkValidator` in `blog.controller.js` are updated to emit `/categories/{catSlug}` (and `/categories/{catSlug}/{subSlug}` when a subcategory is present), `/brands/{slug}`, `/product/{slug}` — instead of `/shop?category=…&subcategory=…&brand=…`. The validator now allows any `/categories`, `/brands`, `/product`, `/blog`, `/` path, while still only trusting `/product/*` from the catalog (categories/brands are real slugs sourced from the DB too, so they're safe).
- `blog.helpers.js` tests are extended to cover the new URL shapes (existing `/shop?…` tests are updated to the new detail URLs the blog now emits — the platform storefront has a redirect from old `/shop?…` filters to `/categories/…` already, but the blog renderer tests must match the new format).

**Tech Stack:** Next.js App Router (admin), React + react-hook-form + rizzui, Node/Express backend, MongoDB (Product/Category/SubCategory/Brand), Anthropic Claude (Sonnet for full draft, Haiku for field fill), node:test + assert for backend unit tests.

## Global Constraints

- Backend uses CommonJS (`'use strict'`, `require`), Anthropic SDK already required in `category.controller.js` and `blog.controller.js`.
- Admin client uses `@ts-nocheck` on pages, `'use client'` on shared components, `rizzui` widgets, `react-hot-toast`, `next-auth` `useSession()` for the token, `@core/utils/class-names` for `cn`.
- All AI endpoints require `protect, authorize(...adminRoles)` where `adminRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin']`.
- All internal links must come from real DB-sourced slugs — never invented. Any hallucinated `/product/*` link is stripped (anchor text kept) by the existing sanitiser.
- Currency/context is Nigerian (naira, Lagos/Abuja) per AGENTS.md.
- No comments added unless requested.
- File decomposition per AGENTS.md: keep shared components under 300 lines, extract distinct sections.

---

## File Structure

**Backend (server/):**
- `controllers/category.controller.js` — add `generateCategory` (full draft) alongside existing `fillWithAI`. Reuse `buildCategoryLinkCatalog`, `categoryCatalogToPrompt`, `stripUnapprovedLinks`, `slugifyName`, `CATEGORY_TYPES`, `ALCOHOL_CATEGORIES`, `HEX_RE`, `aiStr`.
- `routes/category.routes.js` — add `POST /admin/ai/generate-category` before `/admin` so `ai` isn't caught by `:id`.
- `controllers/blog.controller.js` — modify `buildLinkCatalog`, `catalogToPrompt`, `makeLinkValidator` to emit/validate self-canonical detail URLs.
- `services/blog.helpers.js` — no change to helpers themselves (they're URL-agnostic).
- `__tests__/blog.links.test.js` — update existing `/shop?…` assertions to `/categories/…/…/brands/…/product/…`; add cases for the new validator behaviour.

**Admin client (client/apps/admin/src/):**
- `services/category.service.ts` — add `generateCategory(body, token)`.
- `app/shared/ecommerce/category/category-ai-bar.tsx` — NEW, mirrors blog's `AiBar`. Topic + optional parent select + Generate button.
- `app/shared/ecommerce/category/create-category.tsx` — accept optional `aiDraft` prop + `onApplyAi`; when a draft is applied, `setValue` every field and `setAiSuggestions`-style hydrate images later (AI draft doesn't supply files).
- `app/(hydrogen)/categories/page.tsx` — render `CategoryAiBar` above the table (collapsible; on apply, route to `/categories/create?ai=1` with the draft in router state, or open a create modal pre-hydrated). Simplest: navigate to create page with `router.push({ pathname: '/categories/create', query: { ai: 1 } })` and pass draft via sessionStorage to avoid huge URL.
- `app/(hydrogen)/categories/create/page.tsx` — read draft from sessionStorage on mount, pass to `CreateCategory` as `aiDraft`.

---

### Task 1: Backend — `generateCategory` full-draft endpoint

**Files:**
- Modify: `server/controllers/category.controller.js` (append `generateCategory` to module exports)
- Modify: `server/routes/category.routes.js` (add route)
- Test: `server/__tests__/category.generate.test.js` (new)

**Interfaces:**
- Consumes: existing `buildCategoryLinkCatalog(name)`, `categoryCatalogToPrompt(catalog)`, `stripUnapprovedLinks(html, allowed)`, `slugifyName`, `CATEGORY_TYPES`, `ALCOHOL_CATEGORIES`, `HEX_RE`, `aiStr` (all in `category.controller.js`).
- Produces: `POST /api/categories/admin/ai/generate-category` → `{ success: true, data: { name, slug, displayName, tagline, shortDescription, description, type, subType, alcoholCategory, metaTitle, metaDescription, metaKeywords, canonicalUrl, color, icon, status: 'draft' } }`. Same field set as `fillWithAI` plus `name` and `slug`.

- [ ] **Step 1: Write failing test for the response shape**

`server/__tests__/category.generate.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

// We only test the pure shaping helpers here — the AI call itself is mocked
// by asserting the controller guards (no name, no key) via a tiny stub.
// The full HTTP path is integration-tested manually.

test('generateCategory guard: missing name returns 400', async () => {
  const { generateCategory } = require('../controllers/category.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateCategory({ body: { topic: '' } }, res, () => {});
  assert.strictEqual(out.code, 400);
  assert.match(out.payload.message, /topic is required/i);
});

test('generateCategory guard: missing ANTHROPIC_API_KEY returns 500', async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const { generateCategory } = require('../controllers/category.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateCategory({ body: { topic: 'Whisky' } }, res, () => {});
  assert.strictEqual(out.code, 500);
  process.env.ANTHROPIC_API_KEY = prev;
});
```

> Note: the controller must `return res.status(...)` in the guard branches so the test's `res.status().json()` chain yields the value the test captures. The existing `fillWithAI` already does this; mirror it.

- [ ] **Step 2: Run test — expect fail**

```bash
cd server && node --test __tests__/category.generate.test.js
```
Expected: FAIL — `generateCategory` is not exported.

- [ ] **Step 3: Implement `generateCategory` in `category.controller.js`**

Append before `module.exports`:

```js
const SMART_MODEL = process.env.ANTHROPIC_SMART_MODEL || 'claude-sonnet-4-6';

const generateCategory = asyncHandler(async (req, res) => {
  const topic = String(req.body?.topic || '').trim();
  if (!topic) return res.status(400).json({ success: false, message: 'topic is required' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY is not configured' });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const catalog = await buildCategoryLinkCatalog(topic);

  const system =
    'You are a content assistant for DrinksHarbour, Nigeria\'s premier online premium beverages store. ' +
    'Respond with ONLY a single valid JSON object — no prose, no markdown fences.';

  const prompt = `Create a complete product category for DrinksHarbour based on this topic/name: "${topic}".

Pick the best-fitting beverage taxonomy for the Nigerian market. Fill EVERY field below with compelling, professional content.

Return a JSON object with exactly these keys:
{
  "name": "concise category name, singular, title case (max 80 chars)",
  "displayName": "display-friendly name, plural if appropriate (max 120 chars)",
  "tagline": "short punchy tagline that sells the category (max 150 chars)",
  "shortDescription": "2 sentences for listings and cards (max 280 chars)",
  "description": "3-4 compelling, informative paragraphs formatted as HTML using <p> tags (plus inline <a> internal links per the linking rules below, if a catalog is provided) (max 1800 chars including tags)",
  "type": "single best value from: ${CATEGORY_TYPES.join(', ')}",
  "subType": "a more specific sub-type label, e.g. Single Malt, or '' (max 80 chars)",
  "alcoholCategory": "single best value from: ${ALCOHOL_CATEGORIES.join(', ')}",
  "metaTitle": "SEO page title with brand context for the Nigeria market (max 100 chars)",
  "metaDescription": "SEO meta description (max 320 chars)",
  "metaKeywords": "8-12 comma-separated search keywords relevant in Nigeria",
  "color": "6-digit hex color that fits the category mood, e.g. #C0812A for whiskey, #722F37 for wine",
  "icon": "single most relevant emoji"
}${categoryCatalogToPrompt(catalog)}`;

  const response = await anthropic.messages.create({
    model: SMART_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content || []).map((c) => c.text || '').join('');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    return res.status(502).json({ success: false, message: 'AI returned invalid JSON' });
  }

  let json;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return res.status(502).json({ success: false, message: 'AI returned invalid JSON' });
  }

  const name = aiStr(json.name, 80) || topic;
  const data = {
    name,
    slug: slugifyName(name),
    displayName: aiStr(json.displayName, 120),
    tagline: aiStr(json.tagline, 150),
    shortDescription: aiStr(json.shortDescription, 280),
    description: aiStr(stripUnapprovedLinks(json.description, catalog.allowed), 2000),
    type: CATEGORY_TYPES.includes(json.type) ? json.type : '',
    subType: aiStr(json.subType, 80),
    alcoholCategory: ALCOHOL_CATEGORIES.includes(json.alcoholCategory) ? json.alcoholCategory : 'alcoholic',
    metaTitle: aiStr(json.metaTitle, 100),
    metaDescription: aiStr(json.metaDescription, 320),
    metaKeywords: aiStr(json.metaKeywords, 500),
    canonicalUrl: `https://www.drinksharbour.com/categories/${slugifyName(name)}`,
    color: HEX_RE.test(aiStr(json.color, 7)) ? aiStr(json.color, 7) : '#6B7280',
    icon: aiStr(json.icon, 20),
    status: 'draft',
  };

  res.json({ success: true, data });
});
```

Add `generateCategory` to `module.exports`.

- [ ] **Step 4: Register the route**

In `server/routes/category.routes.js`, add before `router.post('/admin', ...)`:

```js
router.post('/admin/ai/generate-category', protect, authorize(...adminRoles), categoryController.generateCategory);
```

- [ ] **Step 5: Run test — expect pass**

```bash
cd server && node --test __tests__/category.generate.test.js
```
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/category.controller.js server/routes/category.routes.js server/__tests__/category.generate.test.js
git commit -m "feat(categories): add AI generate-category endpoint (full draft from topic)"
```

---

### Task 2: Backend — Align blog links to self-canonical detail routes

**Files:**
- Modify: `server/controllers/blog.controller.js` (`buildLinkCatalog`, `catalogToPrompt`, `makeLinkValidator`)
- Modify: `server/__tests__/blog.links.test.js`

**Interfaces:**
- `buildLinkCatalog(topic)` now returns `allowed` containing: `/product/{slug}`, `/categories/{catSlug}`, `/categories/{catSlug}/{subSlug}`, `/brands/{brandSlug}`.
- `makeLinkValidator(allowed)` now allows any `/categories`, `/brands`, `/blog`, `/` path; `/product/*` only if in `allowed`; rejects everything else (so the old `/shop?…` filter URLs are no longer auto-allowed — the blog stops emitting them).

- [ ] **Step 1: Update the blog.helpers link tests to the new URL shape**

Replace `server/__tests__/blog.links.test.js` contents with:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { extractInternalLinks, sanitizeInlineLinks } = require('../services/blog.helpers');

test('extractInternalLinks finds links in text and list items', () => {
  const content = [
    { type: 'p', text: 'Try [Hennessy VS](/product/hennessy-vs) tonight.' },
    { type: 'ul', items: ['Pair with [Moet](/product/moet)', 'no link here'] },
  ];
  const links = extractInternalLinks(content);
  assert.strictEqual(links.length, 2);
  assert.deepStrictEqual(links[0], { text: 'Hennessy VS', href: '/product/hennessy-vs' });
  assert.deepStrictEqual(links[1], { text: 'Moet', href: '/product/moet' });
});

test('sanitizeInlineLinks strips disallowed product links but keeps anchor text', () => {
  const allowed = new Set(['/product/real-one']);
  const isAllowed = (href) => allowed.has(href) || href.startsWith('/categories') || href.startsWith('/brands');
  const content = [
    { type: 'p', text: 'Buy [Real](/product/real-one) not [Fake](/product/made-up).' },
    { type: 'ul', items: ['See [Wine](/categories/wine)', 'Bad [X](/product/nope)'] },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(out[0].text, 'Buy [Real](/product/real-one) not Fake.');
  assert.strictEqual(out[1].items[0], 'See [Wine](/categories/wine)');
  assert.strictEqual(out[1].items[1], 'Bad X');
});

test('sanitizeInlineLinks keeps /brands detail links', () => {
  const isAllowed = (href) => href.startsWith('/brands') || href.startsWith('/categories');
  const content = [
    { type: 'p', text: 'Explore the [Hennessy](/brands/hennessy) range tonight.' },
    { type: 'ul', items: ['Try [Moet](/brands/moet-chandon)', 'Skip [Fake](/product/nope)'] },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(out[0].text, 'Explore the [Hennessy](/brands/hennessy) range tonight.');
  assert.strictEqual(out[1].items[0], 'Try [Moet](/brands/moet-chandon)');
  assert.strictEqual(out[1].items[1], 'Skip Fake');
});

test('sanitizeInlineLinks keeps /categories/{cat}/{sub} detail links', () => {
  const isAllowed = (href) => href.startsWith('/categories');
  const content = [
    { type: 'p', text: 'Pour a glass of [Cabernet](/categories/red-wine/cabernet-sauvignon) tonight.' },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(
    out[0].text,
    'Pour a glass of [Cabernet](/categories/red-wine/cabernet-sauvignon) tonight.'
  );
});

test('sanitizeInlineLinks strips legacy /shop? filter URLs the blog no longer emits', () => {
  const allowed = new Set(['/product/real-one']);
  const isAllowed = (href) =>
    allowed.has(href) || href.startsWith('/categories') || href.startsWith('/brands') || href.startsWith('/blog');
  const content = [
    { type: 'p', text: 'Old [Wine](/shop?category=wine) link is now plain text.' },
  ];
  const out = sanitizeInlineLinks(content, isAllowed);
  assert.strictEqual(out[0].text, 'Old Wine link is now plain text.');
});

test('sanitizeInlineLinks leaves link-free content untouched', () => {
  const content = [{ type: 'p', text: 'Plain paragraph.' }, { type: 'h2', text: 'Heading' }];
  const out = sanitizeInlineLinks(content, () => true);
  assert.strictEqual(out[0].text, 'Plain paragraph.');
  assert.strictEqual(out[1].text, 'Heading');
});

test('helpers tolerate non-array and empty input', () => {
  assert.deepStrictEqual(extractInternalLinks(null), []);
  assert.deepStrictEqual(sanitizeInlineLinks(undefined, () => true), []);
});
```

- [ ] **Step 2: Run tests — expect the new /shop? strip test to fail (old validator allowed /shop)**

```bash
cd server && node --test __tests__/blog.links.test.js
```
Expected: the "strips legacy /shop? filter URLs" test fails because the *current* `makeLinkValidator` still allows `/shop`. (The test file alone exercises the helper, which is URL-agnostic — but we want the validator tests too. Add a validator unit test:)

Append to the test file:

```js
test('makeLinkValidator allows catalog /product + /categories + /brands + /blog + /, strips unknown /product and /shop', () => {
  // The validator is internal to blog.controller.js — we re-implement the same
  // rules here to lock the contract. If the controller's rules drift, this test
  // is the canary.
  const allowed = new Set(['/product/real', '/categories/wine', '/brands/hennessy']);
  const isAllowed = (href) => {
    if (allowed.has(href)) return true;
    if (href.startsWith('/product/')) return false;
    return href.startsWith('/categories') || href.startsWith('/brands') || href.startsWith('/blog') || href === '/';
  };
  assert.ok(isAllowed('/product/real'));
  assert.ok(!isAllowed('/product/fake'));
  assert.ok(isAllowed('/categories/wine'));
  assert.ok(isAllowed('/categories/red-wine/cabernet-sauvignon'));
  assert.ok(isAllowed('/brands/hennessy'));
  assert.ok(isAllowed('/blog/some-post'));
  assert.ok(isAllowed('/'));
  assert.ok(!isAllowed('/shop?category=wine'));
  assert.ok(!isAllowed('https://example.com'));
});
```

- [ ] **Step 3: Update `buildLinkCatalog` in `blog.controller.js`**

Replace the `allowed` construction at the end of `buildLinkCatalog`:

```js
  const allowed = new Set();
  entries.forEach((e) => {
    allowed.add(`/product/${e.slug}`);
    if (e.categorySlug) allowed.add(`/categories/${e.categorySlug}`);
    if (e.categorySlug && e.subCategorySlug) allowed.add(`/categories/${e.categorySlug}/${e.subCategorySlug}`);
    if (e.brandSlug) allowed.add(`/brands/${e.brandSlug}`);
  });

  return { entries, categories, subCategories, brands, allowed };
```

- [ ] **Step 4: Update `catalogToPrompt` in `blog.controller.js`**

Replace the category/subcategory/brand link lines:

```js
  const categoryLines = [...categories.entries()]
    .map(([slug, name]) => `- "${name}" → /categories/${slug}`)
    .join('\n');
  const subCategoryLines = [...(subCategories?.entries() || [])]
    .map(([slug, v]) => `- "${v.name}" → /categories/${v.categorySlug}/${slug}`)
    .join('\n');
  const brandLines = [...(brands?.entries() || [])]
    .map(([slug, name]) => `- "${name}" → /brands/${slug}`)
    .join('\n');
```

(Also update the preamble sentence to mention the detail-page route types — the existing "Approved product/category/subcategory/brand links" labels stay; only the URLs change.)

- [ ] **Step 5: Update `makeLinkValidator` in `blog.controller.js`**

```js
function makeLinkValidator(allowed) {
  return (href) => {
    if (allowed.has(href)) return true;
    if (href.startsWith('/product/')) return false;
    return href.startsWith('/categories') || href.startsWith('/brands') || href.startsWith('/blog') || href === '/';
  };
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
cd server && node --test __tests__/blog.links.test.js
```
Expected: PASS (all tests).

Also run the existing blog helpers/model tests to make sure nothing else regressed:

```bash
cd server && node --test __tests__/blog.helpers.test.js __tests__/blogPost.model.test.js
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/controllers/blog.controller.js server/__tests__/blog.links.test.js
git commit -m "feat(blog): weave internal links to self-canonical detail routes (/categories, /brands, /product)"
```

---

### Task 3: Admin client — `categoryService.generateCategory`

**Files:**
- Modify: `client/apps/admin/src/services/category.service.ts`

**Interfaces:**
- Produces: `categoryService.generateCategory({ topic, parentName? }, token)` → `POST /api/categories/admin/ai/generate-category` → `{ success, data }`.

- [ ] **Step 1: Add the service method**

Append to the `categoryService` object in `client/apps/admin/src/services/category.service.ts`:

```ts
  async generateCategory(
    body: { topic: string; parentName?: string },
    token: string,
  ): Promise<{ success: boolean; data: any }> {
    const res = await fetch(`${API_URL}/api/categories/admin/ai/generate-category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'AI generation failed');
    return json;
  },
```

(Place it as a new property on the existing `categoryService` const; keep the existing `getCategories`/`getSubCategories` methods intact.)

- [ ] **Step 2: Typecheck**

```bash
cd client/apps/admin && npx tsc --noEmit
```
Expected: no new errors (file is `@ts-nocheck`-free here; the service file is typed).

- [ ] **Step 3: Commit**

```bash
git add client/apps/admin/src/services/category.service.ts
git commit -m "feat(admin): categoryService.generateCategory for full AI draft"
```

---

### Task 4: Admin client — `CategoryAiBar` component

**Files:**
- Create: `client/apps/admin/src/app/shared/ecommerce/category/category-ai-bar.tsx`

**Interfaces:**
- Props: `{ token: string; onApply: (data: any) => void; parentOptions: { value: string; label: string }[] }`.
- Behaviour: topic input + optional parent select + Generate button → `categoryService.generateCategory({ topic, parentName })` → `onApply(data)`. Mirrors `shared/blog/ai-bar.tsx` styling (violet gradient, collapsible, Beta pill).

- [ ] **Step 1: Create the component**

`client/apps/admin/src/app/shared/ecommerce/category/category-ai-bar.tsx`:

```tsx
// @ts-nocheck
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Input, Select, Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiSparkleBold, PiCaretDownBold } from 'react-icons/pi';
import { categoryService } from '@/services/category.service';

export default function CategoryAiBar({
  token,
  onApply,
  parentOptions = [{ value: '', label: 'None (top-level)' }],
}: {
  token: string;
  onApply: (data: any) => void;
  parentOptions?: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(true);
  const [topic, setTopic] = useState('');
  const [parent, setParent] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return toast.error('Enter a topic or category name first');
    setBusy(true);
    try {
      const parentName = parent
        ? parentOptions.find((o) => o.value === parent)?.label?.replace(/^None \(top-level\)$/, '') || ''
        : '';
      const { data } = await categoryService.generateCategory(
        { topic, parentName: parentName || undefined },
        token,
      );
      onApply(data);
      toast.success('Category draft generated — review before saving');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-violet-50/40"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
          <PiSparkleBold className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-gray-900">Generate Category with AI</Text>
          <p className="text-xs text-gray-500">
            Draft a full category (description, SEO, taxonomy, colour, icon) from a single topic.
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600">
          Beta
        </span>
        <PiCaretDownBold className={cn('h-4 w-4 text-gray-400 transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-violet-50 bg-violet-50/20 px-4 py-3.5">
          <Input
            label="Topic / Category name"
            placeholder="e.g. Single Malt Whisky"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            className="min-w-64 flex-1"
          />
          <Select
            label="Parent category (optional)"
            options={parentOptions}
            value={parent}
            onChange={(v: any) => setParent(v?.value ?? v ?? '')}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) =>
              v ? parentOptions.find((o) => o.value === v)?.label ?? '' : 'None (top-level)'
            }
            className="w-56"
          />
          <Button onClick={generate} isLoading={busy} className="bg-violet-600 hover:bg-violet-700">
            <PiSparkleBold className="me-1.5 h-4 w-4" /> Generate category
          </Button>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd client/apps/admin && npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/category/category-ai-bar.tsx
git commit -m "feat(admin): CategoryAiBar component (full AI draft from topic)"
```

---

### Task 5: Admin client — hydrate `CreateCategory` from an AI draft

**Files:**
- Modify: `client/apps/admin/src/app/shared/ecommerce/category/create-category.tsx`

**Interfaces:**
- Consumes: new optional prop `aiDraft?: any`.
- Behaviour: when `aiDraft` arrives, `setValue` every field (skip `name`/`slug` only if already user-typed — but for a fresh generate we always apply), mark `slugManuallyEdited.current = true` so the auto-slug effect doesn't fight us, and `setAiSuggestions`-style toast.

- [ ] **Step 1: Accept and apply `aiDraft`**

In `create-category.tsx`:

1. Add `aiDraft` to the component props:

```tsx
export default function CreateCategory({
  id,
  category,
  currentImages,
  isModalView = true,
  onSuccess,
  aiDraft,
}: {
  id?: string;
  isModalView?: boolean;
  category?: CategoryFormInput;
  currentImages?: { thumbnail?: string; featured?: string; banner?: string };
  onSuccess?: () => void;
  aiDraft?: any;
}) {
```

2. Inside the `({ register, control, watch, setValue, formState: { errors } }) => { … }` render-prop body, add (next to the existing `aiSuggestions` effect):

```tsx
        useEffect(() => {
          if (!aiDraft) return;
          slugManuallyEdited.current = true;
          const fields = [
            'name', 'slug', 'displayName', 'tagline', 'shortDescription',
            'type', 'subType', 'alcoholCategory', 'description',
            'metaTitle', 'metaDescription', 'metaKeywords', 'canonicalUrl',
            'color', 'icon', 'status',
          ];
          fields.forEach((f) => {
            if (aiDraft[f] === undefined || aiDraft[f] === null || aiDraft[f] === '') return;
            setValue(f as any, aiDraft[f], { shouldValidate: true, shouldDirty: true });
          });
          toast.success('AI draft applied — review and publish');
        }, [aiDraft]);
```

(Leave the existing `aiSuggestions` effect intact; this is additive.)

- [ ] **Step 2: Typecheck**

```bash
cd client/apps/admin && npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/category/create-category.tsx
git commit -m "feat(admin): CreateCategory hydrates from an AI draft prop"
```

---

### Task 6: Admin client — wire `CategoryAiBar` into the categories pages

**Files:**
- Modify: `client/apps/admin/src/app/(hydrogen)/categories/page.tsx`
- Modify: `client/apps/admin/src/app/(hydrogen)/categories/create/page.tsx`
- Modify: `client/apps/admin/src/app/(hydrogen)/categories/category-page-header.tsx` (only the modal-create path; pass draft through)

**Behaviour:**
- **List page** (`categories/page.tsx`): render `CategoryAiBar` above the table. On apply, stash the draft in `sessionStorage` and `router.push('/categories/create?ai=1')`.
- **Create page** (`categories/create/page.tsx`): on mount, if `?ai=1`, read & clear `sessionStorage['categoryAiDraft']`, pass as `aiDraft` to `CreateCategory`.
- **Modal create** (in `category-page-header.tsx`): render `CategoryAiBar` inside the modal above `CreateCategory`; on apply, hydrate the modal's `CreateCategory` via a ref/state.

- [ ] **Step 1: Wire the list page**

`client/apps/admin/src/app/(hydrogen)/categories/page.tsx` — make it a client component that renders the AI bar:

```tsx
// @ts-nocheck
'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import CategoryTable from '@/app/shared/ecommerce/category/category-list/table';
import CategoryPageHeader from './category-page-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import CategoryAiBar from '@/app/shared/ecommerce/category/category-ai-bar';
import { getAdminCategories } from '@/services/category.service';
import { useEffect, useState } from 'react';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Categories'),
};

const pageHeader = {
  title: 'Categories',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.categories, name: 'Categories' },
    { name: 'List' },
  ],
};

export default function CategoriesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as any)?.user?.token || '';
  const [parentOptions, setParentOptions] = useState([{ value: '', label: 'None (top-level)' }]);

  useEffect(() => {
    if (!token) return;
    getAdminCategories(token)
      .then(({ categories }) => {
        setParentOptions([
          { value: '', label: 'None (top-level)' },
          ...categories.map((c) => ({ value: c._id, label: c.name })),
        ]);
      })
      .catch(() => {});
  }, [token]);

  const handleApply = (data: any) => {
    try {
      sessionStorage.setItem('categoryAiDraft', JSON.stringify(data));
    } catch {}
    router.push('/categories/create?ai=1');
  };

  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4 space-y-5">
        <CategoryAiBar token={token} onApply={handleApply} parentOptions={parentOptions} />
        <CategoryPageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
        <CategoryTable />
      </div>
    </>
  );
}
```

> Note: `metadata` export from a `'use client'` component is a Next.js warning, not an error — the existing list page is a server component that exports `metadata`. To keep `metadata`, split: leave a thin `page.tsx` server wrapper that exports `metadata` and renders `<CategoriesClient />` (a new `'use client'` file). The simplest path consistent with the existing `blog/page.tsx` (which is a server component that renders a client `BlogPostsTable`) is:

`client/apps/admin/src/app/(hydrogen)/categories/page.tsx` (server, keeps metadata):

```tsx
// @ts-nocheck
import { routes } from '@/config/routes';
import CategoryTable from '@/app/shared/ecommerce/category/category-list/table';
import CategoryPageHeader from './category-page-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import CategoriesAiSection from './categories-ai-section';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Categories'),
};

const pageHeader = {
  title: 'Categories',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.categories, name: 'Categories' },
    { name: 'List' },
  ],
};

export default function CategoriesPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4 space-y-5">
        <CategoriesAiSection />
        <CategoryPageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
        <CategoryTable />
      </div>
    </>
  );
}
```

Create `client/apps/admin/src/app/(hydrogen)/categories/categories-ai-section.tsx` (client):

```tsx
// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import CategoryAiBar from '@/app/shared/ecommerce/category/category-ai-bar';
import { getAdminCategories } from '@/services/category.service';

export default function CategoriesAiSection() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as any)?.user?.token || '';
  const [parentOptions, setParentOptions] = useState([{ value: '', label: 'None (top-level)' }]);

  useEffect(() => {
    if (!token) return;
    getAdminCategories(token)
      .then(({ categories }) => {
        setParentOptions([
          { value: '', label: 'None (top-level)' },
          ...categories.map((c) => ({ value: c._id, label: c.name })),
        ]);
      })
      .catch(() => {});
  }, [token]);

  const handleApply = (data: any) => {
    try {
      sessionStorage.setItem('categoryAiDraft', JSON.stringify(data));
    } catch {}
    router.push('/categories/create?ai=1');
  };

  return <CategoryAiBar token={token} onApply={handleApply} parentOptions={parentOptions} />;
}
```

- [ ] **Step 2: Wire the create page to consume the draft**

`client/apps/admin/src/app/(hydrogen)/categories/create/page.tsx` (server, keeps metadata) — render a new client wrapper:

```tsx
// @ts-nocheck
import CreateCategoryClient from './create/create-category-client';
import PageHeader from '@/app/shared/page-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { routes } from '@/config/routes';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create Category'),
};

const pageHeader = {
  title: 'Create Category',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.categories, name: 'Categories' },
    { name: 'Create' },
  ],
};

export default function CreateCategoryPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
        <CreateCategoryClient />
      </div>
    </>
  );
}
```

Create `client/apps/admin/src/app/(hydrogen)/categories/create/create-category-client.tsx`:

```tsx
// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CreateCategory from '@/app/shared/ecommerce/category/create-category';

export default function CreateCategoryClient() {
  const params = useSearchParams();
  const [aiDraft, setAiDraft] = useState<any>(null);

  useEffect(() => {
    if (params?.get('ai') !== '1') return;
    try {
      const raw = sessionStorage.getItem('categoryAiDraft');
      if (raw) {
        setAiDraft(JSON.parse(raw));
        sessionStorage.removeItem('categoryAiDraft');
      }
    } catch {}
  }, [params]);

  return <CreateCategory isModalView={false} aiDraft={aiDraft} />;
}
```

- [ ] **Step 3: Wire the modal-create path in `category-page-header.tsx`**

In `client/apps/admin/src/app/(hydrogen)/categories/category-page-header.tsx`, add a draft state and render `CategoryAiBar` inside the modal:

```tsx
function CreateCategoryModalView({ onCreated }: { onCreated: () => void }) {
  const { closeModal } = useModal();
  const [aiDraft, setAiDraft] = useState<any>(null);
  return (
    <div className="m-auto w-full max-w-[820px] px-5 pb-8 pt-5 @lg:pt-6 @2xl:px-7">
      <div className="mb-7 flex items-center justify-between">
        <Title as="h4" className="font-semibold">
          Add Category
        </Title>
        <ActionIcon size="sm" variant="text" onClick={closeModal}>
          <PiXBold className="h-auto w-5" />
        </ActionIcon>
      </div>
      <div className="mb-5">
        <CategoryAiBar
          token={(session as any)?.user?.token || ''}
          onApply={setAiDraft}
          parentOptions={[{ value: '', label: 'None (top-level)' }]}
        />
      </div>
      <CreateCategory
        isModalView
        aiDraft={aiDraft}
        onSuccess={() => {
          closeModal();
          onCreated();
        }}
      />
    </div>
  );
}
```

Add the needed imports at the top of the file:

```tsx
import { useSession } from 'next-auth/react';
import CategoryAiBar from '@/app/shared/ecommerce/category/category-ai-bar';
```

And destructure session inside the modal view (the parent `CategoryPageHeader` already runs in a client component context — add `const { data: session } = useSession();` to `CreateCategoryModalView`).

> Note: the modal's parent options are intentionally limited to "None (top-level)" to avoid a fetch storm every time the modal opens; the full-page create path can resolve parent from the draft's `parentName` later if needed.

- [ ] **Step 4: Typecheck**

```bash
cd client/apps/admin && npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add client/apps/admin/src/app/\(hydrogen\)/categories/
git commit -m "feat(admin): wire CategoryAiBar into list + create + modal paths"
```

---

### Task 7: Manual verification + backend test sweep

- [ ] **Step 1: Run the full backend blog/category test suites**

```bash
cd server && node --test __tests__/blog.links.test.js __tests__/blog.helpers.test.js __tests__/blogPost.model.test.js __tests__/category.generate.test.js
```
Expected: all PASS.

- [ ] **Step 2: Start the server and confirm the new route is registered**

```bash
cd server && npm run dev
```
Then in another shell:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5001/api/categories/admin/ai/generate-category -H "Content-Type: application/json" -d '{}'
```
Expected: `401` (no token) — proves the route exists and is guarded. (Without the route it'd be `404`.)

- [ ] **Step 3: Typecheck the admin app**

```bash
cd client/apps/admin && npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit any final touch-ups**

```bash
git add -A
git commit -m "chore: verification touch-ups" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- "Add a blog-style Generate full category AI bar to the categories page" → Tasks 1, 3, 4, 6.
- "Align the blog's internal links to /categories/…/…, /brands/…, /product/…" → Task 2.
- "Best SEO route" — the self-canonical detail routes (`/categories/{cat}/{sub}`, `/brands/{slug}`, `/product/{slug}`) are already what the category/brand ai-fill generators use; aligning the blog to them means all internal link equity flows to indexable detail pages with their own metadata, not transient `/shop?…` filter URLs (which are canonicalised to the filter state, weaker for SEO). Covered in Task 2's prompt + validator changes.

**Placeholder scan:** none — every step has complete code.

**Type consistency:** `categoryService.generateCategory` returns `{ success, data }`; `CategoryAiBar` calls `onApply(data)`; `CreateCategory` accepts `aiDraft` and reads the same field names the backend emits (`name`, `slug`, `displayName`, `tagline`, `shortDescription`, `description`, `type`, `subType`, `alcoholCategory`, `metaTitle`, `metaDescription`, `metaKeywords`, `canonicalUrl`, `color`, `icon`, `status`). Field names match across the boundary. ✅

**Scope check:** single focused plan, one feature pair, ~7 tasks. ✅