---
name: exam-recipient-preview
description: Department selections preview the actual draft cycle recipients with live roster changes.
updated: 2026-10-19
---

Implemented locally, uncommitted. HR eligible endpoint exposes minimal current
department ID/null. Existing tenant/active/role restrictions retained. Cycle roster
hook emits selected IDs; exam preview intersects current eligible employees with
live roster and selected departments. Grouped names/counts,empty states and unsaved
roster note. Only cycle selections,not all employees; final launch refreshes current
department and freezes assignment as before. No extra endpoint/schema or permission.

Full server4075pass/36skip,real Mongo HTTP10pass,scoped tsc clean. UI341pass/31files (maxWorkers2),actual synthetic desktop/mobile passed. No live data edits/deploy/dependencies/
subagents/commit. Handoff: docs/superpowers/specs/RESUME-exam-recipient-preview.md.

Superseded recipient behavior: individual checkboxes and exact assignment are now
implemented; see exam-recipient-selection.md and its RESUME file.
