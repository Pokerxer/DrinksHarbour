---
name: Selective commit review
description: Completed independent fixes committed while preserving broader pending work, November 2026.
type: project
---

The user authorized reviewing repository-wide pending changes and committing only
completed, independently checked units. Inventory is repository-wide; detailed
review is limited to explicitly selected units. Do not label all held work broken
or complete without its own evidence. Never stage generated build output, private
records, ignored agent instructions or broad mixed dependency migrations by default.

Mixed files are staged from tested candidate content based on the committed tree,
leaving unrelated working changes intact. Run isolated checks; a passing combined
working-tree test does not establish that a selected commit is self-contained.

Current evidence and resulting commits: docs/audits/commit-readiness-2026-11-02.md.
No push/deployment is part of this commit request.

The reviewed set also includes safe existing compiler/cart/display corrections.
Final clean candidate: 4,023 backend tests, 5 shop tests, 7 socket tests and 88
platform module tests pass; TypeScript is clean after removing the 12 baseline
errors. No transitive dependency upgrades were included. See the audit for exact
commit identities and limits. Unrelated pending work remains in the working tree.
