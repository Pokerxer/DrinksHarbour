# Appraisal dropdown design

User requested dropdown design improvements in the ongoing examination context.
Single agent, no new dependencies, no server/scoring changes or live data edits.

Implement a shared AppraisalSelect component using installed Headless UI Listbox
and floating anchored portal (escapes question-bank scroll clipping). White rounded
menu, subtle shadow, brand-red selected tint/check, visible focus, wrapping long
option text, disabled treatment. Keep labels associated and keyboard/outside-click/
Escape/selection-focus provided by Headless UI. At least44px trigger/option targets.

Apply to the three native exam selects and native AI-template department select.
Existing Rizzui selects elsewhere already use app styling and stay unchanged.
Correct-answer options show actual answer text as context alongside Option1–6;
difficulty options explain levels, without automatically rewriting owner's marks.

- [x] RED interaction tests for selection/labels, long text, disabled, keyboard and
  Escape/outside dismissal; component and focused integrations.
- [x] Update question editor, bank filter, AI department and existing interaction tests.
- [x] Appraisal suite, scoped tsc/formatting, synthetic desktop/mobile browser menus
  including scrolling/portal clipping and keyboard; update resume/domain/memory.

No dependency installation, subagents, commits, deployment or production mutations.
