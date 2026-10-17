---
name: Smart sub-product catalog matching
description: Typo-tolerant central Product search and closest existing products while entering a new name.
type: memory
---

# Smart catalog matching

The sub-product picker calls authenticated `/api/products/catalogue-search` with
`matchMode=smart`. `catalogue-search.service.js` retrieves only central Product
identity fields, including approved and pending/unpublished entries. Archived
entries are excluded. No tenant SubProduct costs, prices, stock or supplier data
are retrieved. The public storefront search keeps its own visibility contract.

`catalogue-search-ranking.js` normalizes accents and punctuation, matches name
tokens in any order, tolerates missing/extra letters and adjacent transpositions,
and reuses `semanticSearch.service.js` beverage synonyms for related products.
Exact barcode/name outranks partial names and related classification. Equal name
matches prefer shorter names; complete words distinguish VS from VSOP.

`services/catalogue-search.ts` shares the typed API reader between the picker and
new-name suggestions. `use-catalogue-matches.ts` cancels immediately when the name
changes, before the 300ms debounce, and rejects superseded responses. Failure has
its own Retry state; it must never appear as an empty successful search.

`ClosestProductMatches.tsx` shows up to four suggestions under the new product
name. Clicking Use this product delegates to Basic Info's existing selection
handler and preserves tenant prices and size variants. Never auto-select a match.
The search keyboard listener is scoped to the picker input, not other form fields.

Limits: 160 query characters, 300 ranked candidates, 15 returned matches. These
suggestions support catalog reuse; they are not an exhaustive uniqueness check.
No new AI model is called; the existing embedding provider stays disabled.

See `docs/superpowers/specs/RESUME-sub-product-smart-search.md` for verification.

Verified October 11, 2026: full admin suite 2,688 passed (304 files), full server
suite 3,680 passed / 5 skipped. Real catalog responses passed the client validator.
Repository type checking retains 390 existing diagnostics with none in new files.
Browser startup was unavailable, so live visual interaction remains unverified.

Search access follow-up: the catalogue route must run `protect` →
`resolveTenantContext` → `tenantAdminOrSuperAdmin`. Omitting resolution caused
valid tenant owners/admins to receive 403 despite super-admin searches succeeding.
Added five HTTP regressions; full backend now 3,685 passed / 5 skipped. Real
eligible owner/admin requests return 200. Do not loosen approval/subscription
requirements for unresolved tenants. Older tabs may retain the previous generic
console handler; the current served bundle uses smart matching and inline retry.
