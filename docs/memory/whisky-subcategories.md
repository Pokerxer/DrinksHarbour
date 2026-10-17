# Whisky and related spirit browsing groups

2026-10-15. User requested more subcategories for whiskeys, Scotch and related
categories. Add entries under eight existing roots: Scotch, Bourbon, Rye Whiskey,
Irish Whiskey, Japanese Whisky, World Whisky, Brandy and Rum.

Blended Scotch was missing despite other core Scotch categories existing. Add
specific cask/finish styles, rye variants, verified world origins, Cognac grades
and rum production styles. Preserve existing entries and duplicate legacy names;
Single Barrel/Single Cask Scotch and Pure Malt/Blended Malt Japanese are aliases,
so do not create parallel synonyms. Do not invent age bands to expand the tree.

These are browse groups; cask finishes and production styles are not all legally
regulated categories. No individual Product strength, age, origin or assignment
is inferred by this migration. No product or tenant operational changes.

Sources, exact rows, migration, verification and rollback:
[Session handoff](../superpowers/specs/RESUME-whisky-subcategories.md).

Completed: 56 published SubCategories and parent links across eight families.
Scotch 9, Bourbon 4, Rye 8, Irish 7, Japanese 5, World 10, Brandy 7, Rum 6.
Database verification and repeat zero-change audit passed. Full backend suite:
3,878 passed, 16 skipped, no failures. Final taxonomy totals: 57 Categories,
821 SubCategories. No Product writes, commits, pushes or code deployment.
