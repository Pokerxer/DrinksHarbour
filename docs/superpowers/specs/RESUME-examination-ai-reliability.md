# Examination AI reliability — 2026-10-19

Status: fix implemented and verified locally; uncommitted, not deployed.
Exact failed model response not available; generic catch discarded its cause.
Repro confirmed: marks/difficulty mismatch rejects an otherwise valid bank.
Plan: ../plans/2026-10-19-examination-ai-reliability.md.


## Evidence and implementation

Exact failed response was not retained; no matching entry in local server.log/
backend.log. Do not claim this conclusively identifies the reported production
failure. Reproduced strict marks/difficulty rejection with injected valid question
banks. Existing unconstrained JSON parser collapsed all causes into one502 message.

exam-ai-output.js adds the supported schema, normalized difficulty → marks mapping,
strict semantic validation and typed retryable output errors. exam-ai.js uses
output_config.format.type=json_schema through the installed official Anthropic SDK.
Default claude-haiku-4-5 and model override retained. AI chooses difficulty; server
assigns easy1/medium2/hard3. Owner can still edit marks after accepting the draft.
No inferred answer indexes, missing question fabrication, dropped items or partial
bank saves. Exact requested count and distinct prompts/options remain mandatory.

At most2model calls: one original plus one repair for invalid/truncated/count/key
errors. SDK retries0; per-call cap45seconds, overall budget60seconds, tested with
mock clock. Repair repeats original topic/count plus controlled validation reason;
rejected questions/keys are not echoed. Refusal/provider/network/auth/rate errors
are not retried. Distinct public messages are controlled/sanitized, with no raw
provider errors or private bank exposure. Existing preview/apply/save/departments/
time/scoring semantics and HTTP rate limit unchanged. No live data mutations.

## Provider docs checked

Official supported model/schema/error behavior checked2026-10-19:
https://platform.claude.com/docs/en/build-with-claude/structured-outputs
https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
Haiku4.5 supports structured output. Schema must not use min/max numeric/string/
array limits beyondminItems0/1; these remain server-side. Case-insensitive enums
still need normalization. Truncations/refusals remain possible despite schema.
Installed messages.d.ts and SDK request options verified for output_config/timeout.

## Tests and limits

- Regression RED /tmp/exam-ai-recovery-red.log: constrained request absent, casing/
  marks mismatch rejected, no repair, same generic count/truncation/refusal error.
- Focused27tests pass (/tmp/exam-ai-recovery-final.log): actual SDK with injected
  HTTP transport serializes schema and reads returned Message; difficulty/casing/
  missing marks, repair count, precise failures, bad-key rejection, refusal,
  truncation, sanitized provider errors, per-call/overall budget and legacy math.
- UI5tests pass (/tmp/exam-ai-recovery-ui.log), including failed AI call preserves
  bank and no save occurs before explicit acceptance/save. No frontend code change.
- Full server result in completion ledger below. Scoped whitespace clean.
- No live paid API invocation, live model response, deployment, new dependency,
  commit, push, subagent or schema migration. Self-review; CodeRabbit unavailable.
  Do not promise the deployed service is fixed until backend runs this revision.


Final verification: full server4075passed/36skipped/0failed
(/tmp/exam-ai-recovery-server.log); focused27passed; bank UI5passed; scoped
whitespace passed. No live paid provider call or production verification performed.
Backend must run this revision for changes to affect the user's environment.
