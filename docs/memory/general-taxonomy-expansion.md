# General merchandising taxonomy

2026-10-15. User requested more types/categories/subcategories generally, after
the earlier whole-catalog expansion. Additive, no Product reassignment.

Four new roots: Drink Powders & Instant Mixes; Coffee & Tea Equipment;
Traditional Non-Alcoholic Drinks; Beverage Packaging & Supplies. Additional
subcategories cover drink formats, equipment, regional nonalcoholic beverages,
beer styles, garnishes, milk formats, snacks, gifts and bar care.

General type metadata explicitly distinguishes beverages from equipment,
packaging, snacks, garnishes and gifts. Backend non-beverage handling and admin
drink-field visibility must remain in sync. Choose weight sizes for powders,
coffee and snacks, units for equipment; retain all historic type values.

Plan, sources, migration, verification, rollback and deployment status:
[Session handoff](../superpowers/specs/RESUME-general-taxonomy-expansion.md).

Completed: 32 additional supported Product types, 4 published Categories,
72 published SubCategories and 72 parent links. DB totals 57/765; zero Product
writes. Independent verification and zero-change repeat audit passed. Backend
suite passed 3,874 (16 skipped); admin focused tests passed 74; standalone type
modules compiled. New code still needs deployment; no commit/push/release done.
