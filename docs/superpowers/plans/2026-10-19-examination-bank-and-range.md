# Examination question bank, personalized tests and attendance ranges

Execute inline with writing-plans/TDD/frontend-design/pdf/security-review skills.
No agents, commits or live HR changes. Preserve existing uncommitted work.

## Confirmed outcome

Use supplied Wyn City 30-question PDF and management answer key now. Assign each
employee 10 questions sampled without replacement and shuffled independently;
freeze their subset/order at launch. Preserve 2 marks each / 20 marks total.
Owner chooses attendance start/end dates, inclusive in the tenant calendar.
Add optional AI question bank generation, reviewed before accepting/saving.
Equal combined weighting and existing outside-department two-component rule stay.

## Compatibility and boundaries

Legacy month-only exams and launched attempts without question IDs keep their
existing questions, order and marks. New editor uses explicit dates and 10 questions
per employee. Persist date range and actual assignment in final snapshots.
Keep the supplied private bank server-side and accessible only to unrestricted
Wyn City HR (verified tenant slug wyncity), not every tenant or employee bundle.
AI uses the existing appraisal Anthropic integration/model convention, server key,
bounded topic/count, validation and draft-only HR access; no real AI call in tests.

Files: server/data/examinations/wyn-city-drinks-30.json; focused peerAppraisal
attendance-window, exam-assignment, question-bank and exam-ai services; extend exam
and attempt schemas, grading/projections, controller/routes, result snapshot.
Admin examination UI: date range inputs; bank source panel with supplied bank and
AI preview; compact accordion editor and assignment/marks summary. Keep files small.

## Tasks

- [x] Extract all 30 prompts/options and exact answer key; visually inspect source.
  Add source notes and bank validation tests before data import.
- [x] RED→GREEN range parsing/inclusive boundaries and legacy month fallback;
  preserve attendance exclusions and block unfinished ranges/overnight shifts.
- [x] RED→GREEN random immutable 10-question assignment, marks and rejection of
  answers to questions outside that person's subset. Add real HTTP workflow.
- [x] RED→GREEN AI request/output validation, authorization and private-bank access;
  reuse installed SDK with injected test transport and no paid call.
- [x] RED→GREEN UI date-range/save, bank loading, AI review/apply, compact editing,
  10-question/20-mark display and historical result compatibility. Verify scoped types.
- [x] Run relevant and full suites, review component structure/interactions, update domain README/resume/memory. Live browser walkthrough remains unverified.

## Decisions

Private source verified at /Users/mac/Downloads/Wyn_City_Drinks_Knowledge_Appraisal_30_Question_Bank_Updated.pdf.
Question 7 contains a missing currency glyph in the PDF; normalize it to ₦ using
platform currency convention. No other wording or answer changes. New date ranges
are limited to 366 days for bounded scoring queries. No answer-option shuffle
requested: keep options/key correspondence; shuffle questions only. Independent
samples may overlap; do not promise disjoint questions across employees.
