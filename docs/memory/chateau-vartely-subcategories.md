# Château Vartely taxonomy

The catalog uses global beverage subcategories, not winery range names.
Taraboste, Individo, Cameo, Totem and Inspiro are commercial ranges; classify
their Products by grape, blend or beverage style under the existing Category.

Pastoral is a red liqueur wine (Fortified Wine / Pastoral). Divin VSOP and
Tribut XO are Moldovan brandy (Brandy / Divin); do not label them Cognac.
Individo Merlot Cabernet Sauvignon and Taraboste Cabernet Sauvignon & Merlot
belong in Red Blend. Rară Neagră and Fetească Neagră are distinct grapes.
Muscat liqueur wine is distinct from the semi-sweet still Muscat products.
Aqua Vie is pomace brandy; Rachia di Moscato is grape wine brandy; Tramonto is
plum brandy. Sources, migration and verification are in
`../superpowers/specs/RESUME-chateau-vartely-subcategories.md`.

The migration validates exact reviewed names and rejects unknown brand products
or conflicting slug parents. It uses an atomic transaction and writes only
central Products, SubCategories and Category references/counts. Tenant
SubProducts, prices, stock and approval states are untouched.

Run `node server/scripts/add-chateau-vartely-subcategories.js` for a read-only
audit; add `--apply --report <markdown-path>` to persist an audit and apply.
Database credentials remain in the ignored server environment file.

2026-10-04: applied 15 published subcategories and ten corrections across 14
Products atomically. Independent DB verification passed; repeat dry run returned
zero changes. Full server suite passed: 3,303 tests, zero failures. Original
references and created IDs are saved in the before-audit Markdown report.
