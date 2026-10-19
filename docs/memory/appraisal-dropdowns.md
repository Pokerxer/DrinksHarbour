---
name: appraisal-dropdowns
description: Shared styled accessible floating dropdowns for exam and AI department selection.
updated: 2026-10-19
---

Implemented locally, uncommitted. AppraisalSelect uses installed Headless UI Listbox
with viewport-aware portal, red selected/check and focus,44px targets, wrapped option
context. Exam difficulty, correct answer,bank filter,AI-template department now use
shared control. Actual answer text displayed; difficulty selection does not alter
marks. Portal prevents bank scroll clipping. No backend/dependency changes.

Appraisal suite340pass/30files, scoped types; actual synthetic browser desktop/mobile
passed keyboard/selection/filter/Escape/outside/focus/long text/portal/viewport checks.
Test-only missing observer APIs installed through guarded vitest setup file. No live
HR edits,subagents,commit,deploy or new full server run.
Resume: docs/superpowers/specs/RESUME-appraisal-dropdowns.md.
