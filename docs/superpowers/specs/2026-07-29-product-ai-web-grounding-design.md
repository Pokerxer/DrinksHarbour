# Web-Grounded Product AI Generation — Design

**Date:** 2026-07-29
**Status:** Approved, ready for implementation
**Area:** `server/controllers/gemini.controller.js`, new `server/services/productResearch.service.js`, admin product create/edit

## Problem

The admin product pages (`client/apps/admin/src/app/(hydrogen)/products`) fill product data
entirely from model recall. `generateProductDetails` and the ~45 per-field endpoints in
`gemini.controller.js` run Haiku 4.5 with no web access, so objective facts — ABV, vintage,
appellation, distillery, cask type, bottle sizes — are produced from memory and are frequently
wrong. Wrong facts land in the catalog and then in customer-facing pages and structured data.

Worse, the failure paths actively manufacture data. Every per-field handler's `catch` returns a
fabricated fallback (`Premium ${name} - A distinguished ${type}...`,
`flavorProfile: ['smooth','rich','balanced']`) as `success: true`, and `generateEnhancedDemoData`
synthesises a whole spec sheet on rate-limit. The admin cannot tell a generated fact from a
placeholder.

## Goal

Objective product facts come from real sources or they come back blank. Subjective copy stays
generated, but may only build on facts that were confirmed.

## Decisions

| Question | Decision |
|---|---|
| Scope | Bulk auto-fill + the factual per-field endpoints. Copy endpoints reuse the cached brief; they never search. Sub-product generation and CSV import enrichment are out of scope. |
| Unconfirmed facts | Return blank and flag as unverified. Never guess, never fail the request. |
| Sources | Returned to the admin UI for spot-checking; not persisted on the Product model. |

## Architecture

### `server/services/productResearch.service.js` (new)

The single place in the product pipeline that touches the internet.

```
researchProduct({ name, brand, category }, opts) -> Brief | null
formatFactsForPrompt(brief) -> string
clearResearchCache()
```

One `anthropic.messages.create` call:

- Model `claude-opus-4-8`, overridable via `ANTHROPIC_RESEARCH_MODEL`.
- `tools: [{ type: 'web_search_20260209', name: 'web_search' }]` — the dynamic-filtering version,
  confirmed present in the non-beta namespace of the installed `@anthropic-ai/sdk` 0.104.2.
- Adaptive thinking (`thinking: { type: 'adaptive' }`). No `temperature`/`top_p`/`top_k` — Opus 4.8
  rejects them.
- Streamed via `.stream()` + `.finalMessage()` so a long search loop cannot hit an HTTP timeout.
- `stop_reason === 'refusal'` is handled as "not found", not as an exception.

**Brief shape:**

```js
{
  found: true,
  facts: { /* only fields a source confirmed */ },
  sources: [{ title, url }],
  unverified: ['abv', 'vintage', ...],
  searchedAt: '2026-07-29T...'
}
```

`facts` covers objective fields only: `brand`, `producer`, `distilleryName`, `breweryName`,
`wineryName`, `originCountry`, `region`, `appellation`, `abv`, `volumeMl`, `standardSizes`,
`vintage`, `age`, `ageStatement`, `productionMethod`, `caskType`, `grapeVarieties`, `ingredients`,
`allergens`, `officialTastingNotes`, `awards`.

**The omission rule is what makes the policy work.** The research prompt forbids inference: a field
that no source confirmed is left out of `facts` entirely. `unverified` is then derived by diffing
the known factual field list against the keys actually present — not self-reported by the model.

**Sources are extracted from `web_search_tool_result` blocks in the response**, which carry real
`{ title, url, page_age }`. They are never read out of the model's prose. A URL the model invents
therefore cannot reach the admin.

**Cache:** in-process `Map`, keyed on a normalised `name|brand`, 24h TTL, LRU-capped at 200 entries.
`researchProduct(q, { cacheOnly: true })` returns `null` on a miss without spending a search.

The Anthropic client is injectable so tests never make a network call.

### `server/controllers/gemini.controller.js`

**`generateProductDetails`** researches first, then:

1. Injects a `CONFIRMED FACTS (the only permitted source of specifics)` block into the existing
   Haiku fill prompt, with an explicit instruction to emit `null`/`""` for any factual field absent
   from that block.
2. Runs `sanitizeProductData` unchanged.
3. **Overwrites** every factual field from `facts` afterwards, so model drift cannot survive even if
   the fill pass ignores the instruction. The brief, not the LLM, is authoritative for facts.
4. Responds `{ success, data, sources, unverified, researched: true, metadata }`.

**Factual per-field endpoints** (`origin-country`, `region`, `appellation`, `producer`, `vintage`,
`age-statement`, `production-method`, `cask-type`, `volume-abv`, `standard-sizes`, `ingredients`,
`allergens`, `nutritional-info`, `generate-origin`, `generate-beverage-info`) return their value
directly from the brief. No second LLM call — exact, and faster than today. A miss returns
`{ value: null, unverified: true, sources }`.

**Copy endpoints** (short/full description, flavor profile, food pairings, tasting notes, meta
title/description, keywords) call with `cacheOnly: true` and inject whatever is warm. After an
auto-fill the brief is already cached, so they get grounded specifics for free; on a cold cache they
degrade to today's behaviour rather than triggering a paid search per button.

**Fabricated fallbacks are removed.** Factual `catch` paths return blanks with an explicit `note`;
`generateEnhancedDemoData` no longer emits invented ABV/origin/tasting data.

### Admin client

- `client/apps/admin/src/services/gemini.service.ts` — return types carry `sources` and `unverified`.
- `client/apps/admin/src/app/shared/ecommerce/product/create-edit/product-identification.tsx` — a
  collapsible `Sources (n)` list under the auto-fill button, and per-field buttons toast
  *"Couldn't verify — left blank"* rather than filling silently.

## Testing

`server/__tests__/productResearch.service.test.js`, `node:test`, injectable client, no network:

- Sources come only from `web_search_tool_result` blocks; a URL appearing solely in model text is
  discarded.
- Cache hit avoids a second call; TTL expiry re-searches; `cacheOnly` miss returns `null` without
  calling the client.
- Malformed JSON in the response yields `found: false` instead of throwing.
- Fields absent from `facts` appear in `unverified`.
- `stop_reason: 'refusal'` yields `found: false`.

Plus merge-helper coverage: the brief overrides conflicting model output in `generateProductDetails`.

Baseline to preserve: 628/631 (`node --test '__tests__/*.test.js'`), 3 known pre-existing failures.

## Cost

One search + one Opus pass per new product (~$0.10–0.20), then free across every field button for
24h. All copywriting stays on Haiku.

## Out of scope

- Persisting sources on the Product model (no schema change).
- `generate-from-subproduct`, `generate-subproduct-content`, and CSV-import Haiku enrichment — a
  500-row import must not fire 500 research passes.
- Brand/category/subcategory `ai-fill`.
