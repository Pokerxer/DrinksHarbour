# Monin catalog taxonomy

2026-10-12. 23 central Monin Products reviewed. Syrups belong under Syrup,
Le Fruit purées/mixes under Cocktail Mixers, alcoholic products under Liqueurs.
Curaçao/Triple Sec syrups are nonalcoholic fruit-flavour syrups, distinct from
Curaçao/Triple Sec orange liqueurs. Blackcurrant liqueur uses Crème de Cassis.

Lemon Rantcho is Le Concentré, a lemon juice concentrate, despite this Product's
name/description saying syrup; category Cocktail Mixers → Lemon Juice
Concentrates, type mixer. Names/content retained for separate editorial review.
Kiwi Syrup previously had type other and Sour Mix subcategory; use Fruit Syrups
and schema syrup type simple_syrup. Do not infer alcohol strength or modify
SubProducts/pricing when changing central catalog taxonomy.

Evidence, exact mappings, execution and rollback:
[Session handoff](../superpowers/specs/RESUME-monin-subcategories.md).

Completed: four new published groups, all 23 assignments verified, parent links
and counts refreshed. A concurrent Kiwi rename restored its old taxonomy; a
separate forward repair preserved Le Sirop de Monin Kiwi and restored Fruit
Syrups/simple_syrup. Use repair-monin-kiwi-taxonomy.js for subsequent read-only
audits; the original immutable migration rejects the old-to-new name change.
Full suite passed 3,701 (5 skipped); final repeat audit required zero changes.
