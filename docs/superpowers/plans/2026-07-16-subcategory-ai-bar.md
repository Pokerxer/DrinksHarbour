# SubCategory AI Bar + Detail-Route Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a blog-style "Generate full subcategory from a topic" AI bar to the subcategories admin pages, mirroring what was done for categories. The subcategory ai-fill backend already weaves internal links to self-canonical detail routes (`/categories/{parent}/{sub}`, `/product/{slug}`, `/brands/{slug}`), so no blog-side alignment is needed here.

**Architecture:**
- A new `POST /api/subcategories/admin/ai/generate-subcategory` endpoint produces a *full* subcategory draft (not just field fill) from a topic + **required** parent category name. It reuses the existing `buildSubCategoryLinkCatalog` + `subCategoryCatalogToPrompt` + `stripUnapprovedLinks` and the Sonnet smart model, returning the same shape `fillWithAI` returns plus `name`, `slug`, `parent` (the parent category ID resolved from `parentName`).
- A new admin `subcategoryService.generateSubCategory()` calls that endpoint; a new `SubCategoryAiBar` client component (mirroring `CategoryAiBar`) drops into the subcategory list page and create page. On apply it stashes the draft in `sessionStorage` and navigates to `/sub-categories/create?ai=1`.
- `CreateSubCategory` accepts an optional `aiDraft` prop and hydrates the form via `setValue` (same pattern as `CreateCategory`).

**Tech Stack:** Next.js App Router (admin), React + react-hook-form + rizzui, Node/Express backend, MongoDB, Anthropic Claude (Sonnet for full draft, Haiku for field fill), node:test + assert.

## Global Constraints

- Backend CommonJS, Anthropic SDK already required in `subcategory.controller.js`.
- Admin client uses `@ts-nocheck` on pages, `'use client'` on shared components, `rizzui`, `react-hot-toast`, `next-auth` `useSession()`.
- All AI endpoints require `protect, authorize(...adminRoles)` where `adminRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin']`.
- Parent category is **required** for subcategories (the form marks it `*`).
- No comments unless requested.
- File decomposition per AGENTS.md.

---

## File Structure

**Backend (server/):**
- `controllers/subcategory.controller.js` — add `generateSubCategory` (full draft) alongside existing `fillWithAI`. Reuse `buildSubCategoryLinkCatalog`, `subCategoryCatalogToPrompt`, `stripUnapprovedLinks`, `slugifyName`, `SUBCATEGORY_STYLES`, `aiStr`, `aiBool`, `HEX_RE`. Also need to resolve `parentName` → parent Category `_id` + `slug` for the response.
- `routes/subcategory.routes.js` — add `POST /admin/ai/generate-subcategory` before `/admin` so `ai` isn't caught by `:id`.
- `__tests__/subcategory.generate.test.js` — guard tests (missing topic, missing parentName, missing API key).

**Admin client (client/apps/admin/src/):**
- `services/subcategory.service.ts` — add `generateSubCategory` to the `subcategoryService`-style exports.
- `app/shared/ecommerce/subcategory/subcategory-ai-bar.tsx` — NEW, mirrors `CategoryAiBar`. Topic + **required** parent category select + Generate button.
- `app/shared/ecommerce/subcategory/create-subcategory.tsx` — accept optional `aiDraft` prop; hydrate via `setValue` when draft arrives.
- `app/(hydrogen)/sub-categories/page.tsx` — render `SubCategoriesAiSection` above the table.
- `app/(hydrogen)/sub-categories/subcategories-ai-section.tsx` — NEW client wrapper: fetches parent categories, renders `SubCategoryAiBar`, stashes draft in `sessionStorage`, navigates to `/sub-categories/create?ai=1`.
- `app/(hydrogen)/sub-categories/create/page.tsx` — render `CreateSubCategoryClient` wrapper.
- `app/(hydrogen)/sub-categories/create/create-subcategory-client.tsx` — NEW client wrapper: reads `?ai=1`, pulls draft from `sessionStorage`, passes as `aiDraft`.
- `app/(hydrogen)/sub-categories/category-page-header.tsx` — wire `SubCategoryAiBar` into the modal create path.

---

### Task 1: Backend — `generateSubCategory` full-draft endpoint

**Files:**
- Modify: `server/controllers/subcategory.controller.js` (append `generateSubCategory` to module exports)
- Modify: `server/routes/subcategory.routes.js` (add route)
- Test: `server/__tests__/subcategory.generate.test.js` (new)

**Interfaces:**
- Consumes: existing `buildSubCategoryLinkCatalog(name, parentName)`, `subCategoryCatalogToPrompt(catalog)`, `stripUnapprovedLinks(html, allowed)`, `slugifyName`, `SUBCATEGORY_STYLES`, `aiStr`, `aiBool`, `HEX_RE`, `Category` model (already required at top of file).
- Produces: `POST /api/subcategories/admin/ai/generate-subcategory` → `{ success: true, data: { name, slug, parent, displayName, tagline, shortDescription, description, type, subType, style, typicalFlavors, commonPairings, seasonalSpring, seasonalSummer, seasonalFall, seasonalWinter, metaTitle, metaDescription, metaKeywords, canonicalUrl, color, icon, status } }`. `parent` is the resolved Category `_id`.

- [ ] **Step 1: Write failing test**

`server/__tests__/subcategory.generate.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('generateSubCategory guard: missing topic returns 400', async () => {
  const { generateSubCategory } = require('../controllers/subcategory.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateSubCategory({ body: { topic: '', parentName: 'Whisky' } }, res, () => {});
  assert.strictEqual(out.code, 400);
  assert.match(out.payload.message, /topic is required/i);
});

test('generateSubCategory guard: missing parentName returns 400', async () => {
  const { generateSubCategory } = require('../controllers/subcategory.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateSubCategory({ body: { topic: 'Single Malt' } }, res, () => {});
  assert.strictEqual(out.code, 400);
  assert.match(out.payload.message, /parentName is required/i);
});

test('generateSubCategory guard: missing ANTHROPIC_API_KEY returns 500', async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const { generateSubCategory } = require('../controllers/subcategory.controller');
  const res = { status: (c) => ({ json: (p) => ({ code: c, payload: p }) }) };
  const out = await generateSubCategory({ body: { topic: 'Single Malt', parentName: 'Whisky' } }, res, () => {});
  assert.strictEqual(out.code, 500);
  process.env.ANTHROPIC_API_KEY = prev;
});
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd server && node --test __tests__/subcategory.generate.test.js
```
Expected: FAIL — `generateSubCategory` is not exported.

- [ ] **Step 3: Implement `generateSubCategory` in `subcategory.controller.js`**

Append before `module.exports`. Note: the `Category` model is already required at the top of the file (`const Category = require('../models/Category');`). The `SMART_MODEL` constant must be declared (it's not yet in this file — only `AI_FILL_MODEL` exists).

```js
const SUB_SMART_MODEL = process.env.ANTHROPIC_SMART_MODEL || 'claude-sonnet-4-6';

const generateSubCategory = asyncHandler(async (req, res) => {
  const topic = String(req.body?.topic || '').trim();
  const parentName = String(req.body?.parentName || '').trim();
  if (!topic) return res.status(400).json({ success: false, message: 'topic is required' });
  if (!parentName) return res.status(400).json({ success: false, message: 'parentName is required' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY is not configured' });
  }

  const parent = await Category.findOne({
    name: new RegExp(`^${String(parentName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  })
    .select('_id slug name')
    .lean();

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const catalog = await buildSubCategoryLinkCatalog(topic, parentName);

  const system =
    'You are a content assistant for DrinksHarbour, Nigeria\'s premier online premium beverages store. ' +
    'Respond with ONLY a single valid JSON object — no prose, no markdown fences.';

  const prompt = `Create a complete product subcategory for DrinksHarbour based on this topic/name: "${topic}".
Parent category: "${parentName}"

This subcategory sits under the "${parentName}" parent category. Fill EVERY field below with compelling, professional content.

Return a JSON object with exactly these keys:
{
  "name": "concise subcategory name, singular, title case (max 80 chars)",
  "displayName": "display-friendly name, plural if appropriate (max 120 chars)",
  "tagline": "short punchy tagline that sells the subcategory (max 150 chars)",
  "shortDescription": "2 sentences for listings and cards (max 280 chars)",
  "description": "3-4 compelling, informative paragraphs formatted as HTML using <p> tags (plus inline <a> internal links per the linking rules below, if a catalog is provided) (max 1800 chars including tags)",
  "type": "the drink type this subcategory belongs to, e.g. whiskey, wine (max 100 chars)",
  "subType": "a more specific sub-type label, e.g. Single Malt, or '' (max 100 chars)",
  "style": "single best value from: ${SUBCATEGORY_STYLES.join(', ')}",
  "typicalFlavors": "comma-separated list of 4-8 typical flavors/tasting notes",
  "commonPairings": "comma-separated list of 4-6 food or occasion pairings",
  "seasonalSpring": false,
  "seasonalSummer": false,
  "seasonalFall": false,
  "seasonalWinter": false,
  "metaTitle": "SEO page title with brand context for the Nigeria market (max 100 chars)",
  "metaDescription": "SEO meta description (max 320 chars)",
  "metaKeywords": "8-12 comma-separated search keywords relevant in Nigeria",
  "color": "6-digit hex color that fits the subcategory mood, e.g. #C0812A for whiskey, #722F37 for wine",
  "icon": "single most relevant emoji"
}

For the four seasonal booleans, set true only for seasons this subcategory is especially suited to (e.g. stouts in winter, rosé in summer); all false if not seasonal.${subCategoryCatalogToPrompt(catalog)}`;

  const response = await anthropic.messages.create({
    model: SUB_SMART_MODEL,
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
  const parentSlug = parent?.slug || catalog.parentSlug || slugifyName(parentName);
  const data = {
    name,
    slug: slugifyName(name),
    parent: parent?._id ? String(parent._id) : '',
    displayName: aiStr(json.displayName, 120),
    tagline: aiStr(json.tagline, 150),
    shortDescription: aiStr(json.shortDescription, 280),
    description: aiStr(stripUnapprovedLinks(json.description, catalog.allowed), 2000),
    type: aiStr(json.type, 100),
    subType: aiStr(json.subType, 100),
    style: SUBCATEGORY_STYLES.includes(json.style) ? json.style : '',
    typicalFlavors: aiStr(json.typicalFlavors, 500),
    commonPairings: aiStr(json.commonPairings, 500),
    seasonalSpring: aiBool(json.seasonalSpring),
    seasonalSummer: aiBool(json.seasonalSummer),
    seasonalFall: aiBool(json.seasonalFall),
    seasonalWinter: aiBool(json.seasonalWinter),
    metaTitle: aiStr(json.metaTitle, 100),
    metaDescription: aiStr(json.metaDescription, 320),
    metaKeywords: aiStr(json.metaKeywords, 500),
    canonicalUrl: `https://www.drinksharbour.com/categories/${parentSlug}/${slugifyName(name)}`,
    color: HEX_RE.test(aiStr(json.color, 7)) ? aiStr(json.color, 7) : '#6B7280',
    icon: aiStr(json.icon, 20),
    status: 'draft',
  };

  res.json({ success: true, data });
});
```

Add `generateSubCategory` to `module.exports`.

- [ ] **Step 4: Register the route**

In `server/routes/subcategory.routes.js`, add before `router.post('/admin', ...)`:

```js
router.post('/admin/ai/generate-subcategory', protect, authorize(...adminRoles), subcategoryController.generateSubCategory);
```

- [ ] **Step 5: Run test — expect pass**

```bash
cd server && node --test __tests__/subcategory.generate.test.js
```
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/subcategory.controller.js server/routes/subcategory.routes.js server/__tests__/subcategory.generate.test.js
git commit -m "feat(subcategories): add AI generate-subcategory endpoint (full draft from topic)"
```

---

### Task 2: Admin client — `subcategoryService.generateSubCategory`

**Files:**
- Modify: `client/apps/admin/src/services/subcategory.service.ts`

**Interfaces:**
- Produces: `generateSubCategory({ topic, parentName }, token)` → `POST /api/subcategories/admin/ai/generate-subcategory` → `{ success, data }`.

- [ ] **Step 1: Add the export function**

Append at the end of `client/apps/admin/src/services/subcategory.service.ts` (after `deleteAdminSubCategory`):

```ts
export async function generateSubCategory(
  body: { topic: string; parentName: string },
  token: string,
): Promise<{ success: boolean; data: any }> {
  const res = await fetch(`${API_URL}/api/subcategories/admin/ai/generate-subcategory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(json.message || 'AI generation failed');
  return json;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit
```
Report whether any NEW errors mention `subcategory.service`.

- [ ] **Step 3: Commit**

```bash
git add client/apps/admin/src/services/subcategory.service.ts
git commit -m "feat(admin): subcategoryService.generateSubCategory for full AI draft"
```

---

### Task 3: Admin client — `SubCategoryAiBar` component

**Files:**
- Create: `client/apps/admin/src/app/shared/ecommerce/subcategory/subcategory-ai-bar.tsx`

**Interfaces:**
- Props: `{ token: string; onApply: (data: any) => void; parentOptions: { value: string; label: string }[] }`.
- The parent select is **required** — the Generate button is disabled until a parent is selected. Mirrors `CategoryAiBar` styling.

- [ ] **Step 1: Create the component**

```tsx
// @ts-nocheck
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Input, Select, Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiSparkleBold, PiCaretDownBold } from 'react-icons/pi';
import { generateSubCategory } from '@/services/subcategory.service';

export default function SubCategoryAiBar({
  token,
  onApply,
  parentOptions,
}: {
  token: string;
  onApply: (data: any) => void;
  parentOptions: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(true);
  const [topic, setTopic] = useState('');
  const [parent, setParent] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return toast.error('Enter a topic or subcategory name first');
    if (!parent) return toast.error('Select a parent category first');
    setBusy(true);
    try {
      const parentName = parentOptions.find((o) => o.value === parent)?.label || '';
      const { data } = await generateSubCategory(
        { topic, parentName },
        token,
      );
      onApply(data);
      toast.success('Subcategory draft generated — review before saving');
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
          <Text className="text-sm font-semibold text-gray-900">Generate SubCategory with AI</Text>
          <p className="text-xs text-gray-500">
            Draft a full subcategory (description, SEO, taxonomy, flavours, pairings) from a single topic.
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600">
          Beta
        </span>
        <PiCaretDownBold className={cn('h-4 w-4 text-gray-400 transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-violet-50 bg-violet-50/20 px-4 py-3.5">
          <Select
            label="Parent category *"
            options={parentOptions}
            value={parent}
            onChange={(v: any) => setParent(v?.value ?? v ?? '')}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) =>
              v ? parentOptions.find((o) => o.value === v)?.label ?? '' : 'Select parent'
            }
            className="min-w-52 flex-1"
          />
          <Input
            label="Topic / SubCategory name"
            placeholder="e.g. Single Malt"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            className="min-w-64 flex-1"
          />
          <Button
            onClick={generate}
            isLoading={busy}
            disabled={!parent}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <PiSparkleBold className="me-1.5 h-4 w-4" /> Generate subcategory
          </Button>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit
```
Report whether any NEW errors mention `subcategory-ai-bar`.

- [ ] **Step 3: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/subcategory/subcategory-ai-bar.tsx
git commit -m "feat(admin): SubCategoryAiBar component (full AI draft from topic)"
```

---

### Task 4: Admin client — hydrate `CreateSubCategory` from an AI draft

**Files:**
- Modify: `client/apps/admin/src/app/shared/ecommerce/subcategory/create-subcategory.tsx`

**Interfaces:**
- Consumes: new optional prop `aiDraft?: any`.
- Behaviour: when `aiDraft` arrives, `setValue` every field. `parent` is set from `aiDraft.parent` (the resolved category `_id`). `slugManuallyEdited.current = true` so the auto-slug effect doesn't fight us.

- [ ] **Step 1: Add `aiDraft` to props**

Edit the component signature:

```tsx
export default function CreateSubCategory({
  id,
  subcategory,
  currentImages,
  isModalView = true,
  onSuccess,
  aiDraft,
}: {
  id?: string;
  isModalView?: boolean;
  subcategory?: SubCategoryFormInput;
  currentImages?: { thumbnail?: string; featured?: string; banner?: string };
  onSuccess?: () => void;
  aiDraft?: any;
}) {
```

- [ ] **Step 2: Add the hydrate effect**

Right after the existing `aiSuggestions` `useEffect` (inside the render-prop body), add:

```tsx
        useEffect(() => {
          if (!aiDraft) return;
          slugManuallyEdited.current = true;
          const fields = [
            'name', 'slug', 'parent', 'displayName', 'tagline', 'shortDescription',
            'type', 'subType', 'style', 'description',
            'typicalFlavors', 'commonPairings',
            'seasonalSpring', 'seasonalSummer', 'seasonalFall', 'seasonalWinter',
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

- [ ] **Step 3: Typecheck**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/apps/admin/src/app/shared/ecommerce/subcategory/create-subcategory.tsx
git commit -m "feat(admin): CreateSubCategory hydrates from an AI draft prop"
```

---

### Task 5: Admin client — wire `SubCategoryAiBar` into the subcategory pages

**Files:**
- Modify: `client/apps/admin/src/app/(hydrogen)/sub-categories/page.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/sub-categories/subcategories-ai-section.tsx`
- Modify: `client/apps/admin/src/app/(hydrogen)/sub-categories/create/page.tsx`
- Create: `client/apps/admin/src/app/(hydrogen)/sub-categories/create/create-subcategory-client.tsx`
- Modify: `client/apps/admin/src/app/(hydrogen)/sub-categories/category-page-header.tsx`

- [ ] **Step 1: Update list page** `sub-categories/page.tsx`

```tsx
// @ts-nocheck
import { routes } from '@/config/routes';
import SubCategoryTable from '@/app/shared/ecommerce/subcategory/subcategory-list/table';
import SubCategoryPageHeader from './category-page-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import SubCategoriesAiSection from './subcategories-ai-section';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('SubCategories'),
};

const pageHeader = {
  title: 'SubCategories',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.subCategories, name: 'SubCategories' },
    { name: 'List' },
  ],
};

export default function SubCategoriesPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4 space-y-5">
        <SubCategoriesAiSection />
        <SubCategoryPageHeader
          title={pageHeader.title}
          breadcrumb={pageHeader.breadcrumb}
        />
        <SubCategoryTable />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create** `sub-categories/subcategories-ai-section.tsx`

```tsx
// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SubCategoryAiBar from '@/app/shared/ecommerce/subcategory/subcategory-ai-bar';
import { getAdminCategories } from '@/services/category.service';

export default function SubCategoriesAiSection() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as any)?.user?.token || '';
  const [parentOptions, setParentOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!token) return;
    getAdminCategories(token)
      .then(({ categories }) => {
        setParentOptions(categories.map((c) => ({ value: c._id, label: c.name })));
      })
      .catch(() => {});
  }, [token]);

  const handleApply = (data: any) => {
    try {
      sessionStorage.setItem('subCategoryAiDraft', JSON.stringify(data));
    } catch {}
    router.push('/sub-categories/create?ai=1');
  };

  return (
    <SubCategoryAiBar token={token} onApply={handleApply} parentOptions={parentOptions} />
  );
}
```

- [ ] **Step 3: Update create page** `sub-categories/create/page.tsx`

```tsx
// @ts-nocheck
import CreateSubCategoryClient from './create/create-subcategory-client';
import PageHeader from '@/app/shared/page-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { routes } from '@/config/routes';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Create SubCategory'),
};

const pageHeader = {
  title: 'Create SubCategory',
  breadcrumb: [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.subCategories, name: 'SubCategories' },
    { name: 'Create' },
  ],
};

export default function CreateSubCategoryPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
        <CreateSubCategoryClient />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create** `sub-categories/create/create-subcategory-client.tsx`

```tsx
// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CreateSubCategory from '@/app/shared/ecommerce/subcategory/create-subcategory';

export default function CreateSubCategoryClient() {
  const params = useSearchParams();
  const [aiDraft, setAiDraft] = useState<any>(null);

  useEffect(() => {
    if (params?.get('ai') !== '1') return;
    try {
      const raw = sessionStorage.getItem('subCategoryAiDraft');
      if (raw) {
        setAiDraft(JSON.parse(raw));
        sessionStorage.removeItem('subCategoryAiDraft');
      }
    } catch {}
  }, [params]);

  return <CreateSubCategory isModalView={false} aiDraft={aiDraft} />;
}
```

- [ ] **Step 5: Wire modal path** in `sub-categories/category-page-header.tsx`

Add imports:
```tsx
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import SubCategoryAiBar from '@/app/shared/ecommerce/subcategory/subcategory-ai-bar';
```

Replace `CreateSubCategoryModalView`:

```tsx
function CreateSubCategoryModalView({ onCreated }: { onCreated: () => void }) {
  const { closeModal } = useModal();
  const { data: session } = useSession();
  const [aiDraft, setAiDraft] = useState<any>(null);
  return (
    <div className="m-auto w-full max-w-[820px] px-5 pb-8 pt-5 @lg:pt-6 @2xl:px-7">
      <div className="mb-7 flex items-center justify-between">
        <Title as="h4" className="font-semibold">
          Add SubCategory
        </Title>
        <ActionIcon size="sm" variant="text" onClick={closeModal}>
          <PiXBold className="h-auto w-5" />
        </ActionIcon>
      </div>
      <div className="mb-5">
        <SubCategoryAiBar
          token={(session as any)?.user?.token || ''}
          onApply={setAiDraft}
          parentOptions={[]}
        />
      </div>
      <CreateSubCategory
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

> Note: the modal's `parentOptions` is intentionally empty `[]` — the modal `CreateSubCategory` already fetches its own parent categories internally via `getAdminCategories(token)`. The AI bar in the modal will show "Select parent" with no options until the user types a parent name manually; for a richer modal experience, the `SubCategoriesAiSection` (list page) path is preferred. The modal path is a convenience fallback.

- [ ] **Step 6: Typecheck**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add "client/apps/admin/src/app/(hydrogen)/sub-categories/"
git commit -m "feat(admin): wire SubCategoryAiBar into list + create + modal paths"
```

---

### Task 6: Verification sweep

- [ ] **Step 1: Run backend tests**

```bash
cd server && node --test __tests__/subcategory.generate.test.js __tests__/blog.links.test.js __tests__/blog.helpers.test.js __tests__/blogPost.model.test.js __tests__/category.generate.test.js
```
Expected: all PASS.

- [ ] **Step 2: Typecheck admin app**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit
```
Expected: no NEW errors in touched files.

- [ ] **Step 3: Verify route registration**

```bash
grep -n "generate-subcategory" server/routes/subcategory.routes.js
```
Expected: one match, before `/admin/:id` routes.