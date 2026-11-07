# German wine subcategories

2026-10-31. Added48 published subcategories under existing wine parents:
White Wine30, Red Wine10, Rosé Wine3, Sparkling Wine5. Includes20 German
varietal options,13 regional wine options,6 Riesling Prädikat labels,
Liebfraumilch,3 rosé and5 sparkling styles. Generic Riesling, Pinot Noir,
Pinot Grigio, Sekt and Icewine remain untouched. Products are not reassigned.

Definitions: server/data/german-wine-subcategories.js. Migration: preview-default
server/scripts/expand-german-wine-subcategories.js, --apply requires --report.
Atomic transaction inserts only missing taxonomy and appends parent links with
$addToSet. New docs validate against the real schema. Conflicting names/slugs
abort; no product/tenant/price writes. Existing repeated parent links are left
alone. Verify via server/scripts/verify-german-wine-subcategories.js.

Live verification48 entries passed; total57 Categories/869 SubCategories.
Audit and rollback IDs: docs/superpowers/specs/2026-10-31-german-wine-applied.md.
Preview IDs are proposals only; rollback must use applied audit IDs and check
Product references before deleting taxonomy or removing added parent links.
Prädikat is not a sweetness ladder; verify sweetness from the label separately.
Handoff: docs/superpowers/specs/RESUME-german-wine-subcategories.md.

Final checks: after-preview0 changes; focused taxonomy6/6 passed. Full backend
4,436 pass/60 fail/221 skip (4,717 total); market/venue Mongo fixture setup absent.
Log /private/tmp/german-wine-taxonomy-tests.log. New taxonomy tests all pass.

User correction2026-10-31: omit the English 'German' prefix from display labels.
Use correct-wine-subcategory-labels.js and verify-wine-subcategory-labels.js.
29 ordinary labels are renamed; Riesling and Gewürztraminer reuse established
records. Their two unused duplicate records are archived with '(superseded)'
labels and removed from the parent links. Stable IDs/slugs remain unchanged;
product/tenant/pricing data is never written. Original expansion files and
reports are historical and must not be rerun expecting the former display names.
Current handoff: RESUME-german-wine-label-correction.md.

Correction saved and independently verified:31 actions (29 rename/2 reuse), zero
remaining prefixes and zero rerun changes. Three correction tests pass. Full
backend4,439 passed/60 missing venue fixture failures/221 skipped. Audit snapshots
and final verification are in RESUME-german-wine-label-correction.md.
