# Employee peer appraisal workspace implementation plan

User-authorized scope: improve design and functionality of /appraisals/peer/[cycleId]. Execute in this session with one agent; no additional approval, dependencies, backend changes or deployment.

Design: employee task workspace using existing app fonts, white surfaces, slate #111827 text, #6b7280 secondary text, brand #b20202 actions, #fef2f2 selected surfaces and #e5e7eb rules. Strong cycle title and human status; main task column with a quiet desktop sidebar explaining tasks and score release. Mobile stacks sidebar after work. Signature: a five-cell rating scale with clear selected numbers, alongside an actual rated/unrated progress track. No new fonts/assets needed.

Files:
- peer-rating/employee-page.tsx: load/retry/status orchestration; retain loaded review on failed refresh; independently show result error, never offer editing on closed/cancelled/unassigned cycles.
- peer-rating/employee-header.tsx: back link, cycle title/status and contextual copy.
- peer-rating/employee-guide.tsx: assigned task explanations, score release and scale guidance.
- peer-rating/use-peer-review.ts: editable ratings, revision/dirty tracking, locked persistence, unload warning while unsaved.
- peer-rating/review-form.tsx: search and all/unrated filters, progress, empty states, draft save feedback, final review confirmation. No bulk rating or changed rating semantics.
- peer-rating/rating-row.tsx: accessible responsive five-cell selection.
- peer-rating/employee-workspace.test.tsx and review-form.test.tsx: real interaction tests with network APIs mocked.

Tasks:
- [x] Write/observe failing tests for filter/empty state, explicit final confirmation, unsaved draft lifecycle, and page content surviving a failed result refresh.
- [x] Implement components/hook with existing server contracts; exam lifecycle stays mounted during review refresh where possible.
- [x] Run full appraisal UI suite and scoped TypeScript; visually inspect actual components with synthetic desktop/mobile data.
- [x] Review privacy/read-only/async boundaries; update resume and memory with verification.

Review focus: filtered-out ratings stay in payload; submit cannot bypass completeness or read-only state; failures preserve values and retry revision; no unselected exam access; refresh errors must not erase submitted ratings/exam state. Existing tests requiring immediate submit must be updated to the explicit final confirmation flow.

Completed. Verification and handoff: ../specs/RESUME-employee-peer-workspace.md.
