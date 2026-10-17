---
name: appraisal-cycle-detail-design
description: Approved shared redesign of the standard and colleague bonus cycle detail page.
updated: 2026-10-15
---

Implemented and uncommitted. `/appraisals/cycles/[id]` has a shared header with
status/dates, Draft → Collecting → Closed stages, summary metrics, a broad content
column and a compact desktop next-action sidebar. Mobile stacks actions before
the roster. Cancelled cycles are distinct from successful completion.

Focused components in `client/apps/admin/src/app/shared/appraisals/cycle-workspace/`
serve both standard `cycle-detail.tsx` and `peer-rating/cycle-panel.tsx`.
Standard confirmations, stalled review, reports and standing-feedback access are
preserved. Peer closure guards, draft saves, scoring and privacy are preserved.
Participant table has initials, submission pills and aligned numeric columns.
No backend changes or new dependencies.

Fresh checks: 21 appraisal test files / 305 tests passed; scoped appraisal
TypeScript check passed; formatting and diff whitespace checks passed. Actual
components previewed with synthetic data at mobile/tablet/desktop widths without
page-wide overflow. Live authenticated walkthrough was not completed. Self-review
only: CodeRabbit is unavailable. Temporary preview was cleaned up.

Full handoff: `docs/superpowers/specs/RESUME-appraisal-cycle-detail-design.md`.
