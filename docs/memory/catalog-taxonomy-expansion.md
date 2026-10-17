# Whole-catalog taxonomy expansion

2026-10-15. User chose the entire catalog, beyond Monin. Four new roots:
Ready-to-Drink Cocktails & Coolers, Non-Alcoholic Alternatives, Sake & Rice Wine,
Fermented Drinks. Existing wine/spirit/accessory structure retained.

Precise additive product types distinguish syrups, fruit mixes/purées, drink
concentrates, sauces/bases, malt/palm/rice drinks, baijiu/shochu and cordial/shrub.
Keep backend schemas, service/enrichment allowlists and both admin product flows
in sync when adding types. Unknown types remain invalid.

Category changes are central Product metadata only. Tenant stock, prices,
variants and approval state are not managed by taxonomy migrations. Empty
published categories support future inventory; never create fake products.

Plan, source evidence, exact identities, verification and rollback:
[Session handoff](../superpowers/specs/RESUME-catalog-taxonomy-expansion.md).

Completed database expansion: 4 Categories, 33 SubCategories, 44 exact Product
updates, verified counts/links and a zero-change repeat audit. 18 extra supported
Product types; 15 new constants plus 3 previously missing schema/form values.
Backend full suite passed 3,867 (16 skipped); final admin focused tests passed 26.
Full admin typecheck still has unrelated diagnostics; see handoff. Form/API code
is local and requires deployment/restart; no release was performed.
