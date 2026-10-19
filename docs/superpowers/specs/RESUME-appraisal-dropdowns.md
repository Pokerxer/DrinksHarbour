# Appraisal dropdowns — 2026-10-19

Status: implemented locally; final verification recorded below. Uncommitted.
Plan: ../plans/2026-10-19-appraisal-dropdowns.md.
Previous complete handoff: RESUME-examination-usability.md.

Scope: shared Headless UI anchored portal select for exam difficulty/correct answer/
bank difficulty and AI-template department; preserve values and permission behavior.


## Delivered

Shared appraisal-select.tsx uses installed Headless UI2.2 Listbox with floating
anchor/portal. White rounded trigger/menu, red selected tint/check, focus ring,
chevron,44px targets, disabled styling and wrapping option context. Panel follows
trigger width, viewport padding12, scrollable maxheight and z1000 to sit above
existing z50 modal/scroll editor. modal=false preserves normal page scroll.
Selected value/context is announced via aria-describedby; label remains associated.

Applied to native exam question difficulty, correct-answer selection, bank difficulty
filter and AI-template department picker. Existing Rizzui lists unchanged. Correct
answer options show actual answer text; selected trigger includes one-line context,
full text wraps in open panel. Difficulty mentions AI defaults1/2/3 without changing
marks on selection. Values, grading and departments semantics stay unchanged.

Updated actual component interaction tests to select options via accessible menu
rather than changing a native select. Unit tests cover selected state, context,
keyboardEnd/Enter,Escape with focus return and disabled prevention. Added guarded
jsdom-only missing ResizeObserver/scrollIntoView support in src/test/browser-observers
and vitest setupFiles; floating geometry itself tested in actual Chromium.

## Verification

- Appraisal suite340tests/30files passed; latest rerun/count in completion ledger.
- Scoped tsc clean. Formatting/whitespace checked.
- Synthetic actual React component browser preview, compiled project Tailwind:
  desktop1366x1000 and mobile390x844. Verified pointer selection, actual filter
  change, keyboardHome/End/Enter,Escape focus,outside dismissal, portal outside
  scroll ancestor, viewport bounds,no horizontal overflow, correct-answer selection,
  and long answer wrapping. No page errors. Final browser log:
  /tmp/appraisal-dropdown-browser-final.log.
- Screenshots viewed /tmp/exam-dropdown-desktop.png and /tmp/exam-dropdown-mobile.png.
  Temporary harness /tmp/drinksharbour-exam-preview uses synthetic data/system fonts,
  not authenticated production HR. Helper stopped its temporary preview server.
- Initial jsdom lacked ResizeObserver; supplied test-only browser API stub, not a
  production workaround. Keyboard tests now await active option/focus before Enter
  to match Headless UI scheduled focus updates; real keyboard behavior passed.
- No backend changes/new dependencies/live data edits/subagents/commit/push/deploy.
  No new full server run: last UI-only iteration's server4065pass/36skip baseline
  remains historical; this iteration verified affected UI and types directly.
- Self-review; CodeRabbit unavailable from earlier checks.

Domain rules: server/services/peerAppraisal/EXAMINATION.md.
Previous usability/timer/weighted score rules remain unchanged.


Final ledger:340UItests/30files passed (/tmp/appraisal-dropdown-ui-last.log); scoped
tsc clean (/tmp/appraisal-dropdown-types-last.log); formatting/whitespace passed.
Synthetic desktop/mobile browser long-answer and accessibility interactions passed.
Temporary browser server stopped; all requested work complete locally, uncommitted.
