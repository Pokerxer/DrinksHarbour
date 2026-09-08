# Brand search

Updated 2026-09-08. Fixes /brands (admin and storefront) and banner CTA brand picker.

Both reported brands were already active: Glenfiddich (15 stored products),
Laphroaig (9). Exact queries worked; whole-word text search missed partial input
(`glen`, `laph`). Banner searches could finish out of order and masked failures
as no matches. Storefront also hid zero-count brands as a separate rendering bug.

`server/utils/brandSearch.js` builds escaped, case-insensitive literal substring
filters, applied before pagination by brand.service. Includes name, slug, legal
and trading names plus existing descriptive fields. Does not require a text index.
Status restrictions stay unchanged; do not auto-publish or duplicate brands.

Admin brand list uses a trimmed name/slug filter before pagination and clears
search together with other filters. Brand services request fresh results.
Banner BrandPicker is extracted; use-server-search keys results to query/fetcher
and uses an abort signal to reject stale completions. Errors have their own
message and retry. Selected slugs continue to generate /brands/<slug> links.

Storefront uses displayableBrands for valid name/slug records and no longer
filters by cached productCount. Requests are aborted when replaced/unmounted.

Read-only database verification after fix returned the correct named brand for
`glen`, `laph`, padded uppercase Glenfiddich and full Laphroaig. No database writes.
Changes are local; backend/frontend deployment required to update the live app.
No commit or push requested. See ../superpowers/specs/RESUME-brand-search.md.

Verification: 1,812 admin, 31 storefront and 2,748 server tests passed. Scoped
lint had zero errors and five existing/extracted warnings. App-wide TypeScript
has existing unrelated failures. Live browser acceptance remains unverified.

Popup banner follow-up: `client/apps/platform/src/components/Banner/PopupBanner.tsx`
now uses `object-contain` for notification, full-screen, slide-in and default
modal artwork. The modal image area keeps a portrait ratio and allows up to 78vh,
so portrait creatives are fully visible even when older banner data says
`imageFit: cover`. The image-only modal no longer adds a content fade that would
obscure artwork. Platform focused tests and `git diff --check` pass; live browser
visual acceptance remains pending.
