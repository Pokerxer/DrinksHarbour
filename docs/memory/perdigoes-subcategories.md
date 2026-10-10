# Monte dos Perdigões taxonomy

User shorthand “monte d”, “lagar dos”, “sun blessed”, “poliphonia”, “tapada”
resolves to Monte dos Perdigoes and Poliphonia database Brands. Their requested
ranges include Monte do Barão, Lagar dos Perdigões, Sunblessed, Poliphonia and
Tapada do Barão. Reviewed names are in `server/data/perdigoes-subcategories.js`.

The producer's public catalog and technical sheets establish that the reviewed
red and white wines are blends, except the single-grape Alicante Bouschet.
Use global Red Blend / White Blend; do not classify these blends as Baga,
Syrah, Tinta Roriz, Viognier, Sauvignon Blanc or Albariño merely because those
existing values were assigned. Aragonez is a synonym of Tinta Roriz/Tempranillo:
reuse the existing taxonomy rather than creating another synonym entry.
Still Blanc de Noir belongs in White Wine, separate from sparkling wine.

Digo Samanja shares the Monte dos Perdigoes Brand but has no verified wine
identity. Explicitly exclude it from this migration. Do not infer its category
from that brand association.

Several current descriptions incorrectly claim Bairrada/Baga or Douro. This
classification migration leaves prose unchanged; a future content audit should
verify region, varieties, vintage and bottling identity against the producer.
Similar names, especially the two Poliphonia reserve entries, are not evidence
enough to merge central Products; compare labels and barcodes first.

Handoff and sources:
`../superpowers/specs/RESUME-perdigoes-subcategories.md`.
Run `node server/scripts/add-perdigoes-subcategories.js` for a read-only audit.
Add `--apply --report <markdown-path>` to apply atomically with rollback evidence.

2026-10-04: atomically applied nine published subcategories and twenty wine
classification corrections. Fresh audit returned zero changes; independent DB
verification passed. Full server suite passed: 3,315 tests, zero failures.
Original references and created IDs are in the before-audit Markdown report.
