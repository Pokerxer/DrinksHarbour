# Examination AI generation reliability

User reports generic incomplete/invalid bank error. Exact response is unavailable:
existing code discards validation cause and local logs contain no matching record.
Confirmed reproducible failure: a valid difficulty plus inconsistent/missing marks
rejects whole bank, and unconstrained free-form response formatting is fragile.

- [x] RED tests structured-output request/response, case-insensitive difficulty and
  authoritative marks, single bounded semantic repair, helpful terminal count/
  truncation/refusal/provider errors, no answer-key guessing or saved-bank writes.
- [x] Use official installed SDK output_config.format json_schema for supported
  Haiku4.5, documented at platform.claude.com. Supported schema subset only: no
  min/max lengths/counts/numbers. Server validates all remaining constraints.
- [x] Normalize only difficulty casing/whitespace and derive easy1/medium2/hard3.
  Never coerce/guess correct answer indexes, invent missing questions or partialsave.
- [x] At most one application repair within60s overall, per-call cap45s, SDK retries0.
  Repair includes only controlled validation reason and original topic/count; no
  rejected answer bank echoed. Refusals/provider auth/rate/network errors no retry.
- [x] Distinct safe messages instead of generic catch-all. Model unchanged and
  department/timer/tenant/apply/save controls unchanged. No live paid invocation.
- [x] Full server + targeted UI existing error-preservation test, docs/resume/memory.

Keep focused files: exam-ai.js orchestration; new exam-ai-output.js schema/parser/
normalization/errors. Inject SDK client for actual boundary tests. Single agent,
no dependencies, production mutations, commits, push or deploy.
