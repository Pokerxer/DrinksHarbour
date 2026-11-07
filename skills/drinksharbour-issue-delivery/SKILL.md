---
name: drinksharbour-issue-delivery
description: Deliver a DrinksHarbour engineering issue from Paperclip with repository-specific verification and a resumable handoff. Use for assigned DrinksHarbour implementation or debugging work.
---

Use the bundled Paperclip skill for issue ownership, comments, and status. Resolve the project workspace from the issue and confirm that it contains DrinksHarbour's root `AGENTS.md` and `CLAUDE.md`. If the workspace is unavailable, record that blocker on the issue.

1. Read those entry files, the nearest instructions for the affected area, and the relevant `docs/superpowers/specs/RESUME-*.md` before editing. Identify the issue's acceptance criteria and preserve unrelated changes in the workspace.
2. Implement the smallest change that satisfies those criteria. For tenant access, catalog ownership, or checkout pricing, apply the `drinksharbour-tenant-review` skill if assigned. Use the repository rules for those boundaries in every case.
3. Run focused checks through the affected entry points. For the server suite, use `cd server && node --test '__tests__/*.test.js'`. Report skipped checks and their blockers separately from passing checks.
4. Update the relevant resume spec and project memory with the implementation, evidence, and remaining decisions. Post a concise issue handoff with file paths and check results, then set the status that matches the actual outcome. Keep commits, pushes, deployments, and live data changes within the issue's explicit authorization.
