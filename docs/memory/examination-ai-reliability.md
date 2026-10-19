---
name: examination-ai-reliability
description: Fix invalid-bank generation via constrained JSON, normalized difficulty marks and bounded repair with specific errors.
updated: 2026-10-19
---

User reported generic invalid/incomplete AI bank. Exact failed response unavailable;
existing catch lost cause. Reproduced valid-difficulty/mismatched-mark rejection.
New exam-ai-output schema/normalizer derives easy1/medium2/hard3 after case/space
normalization. AI request uses official SDK constrained JSON on existingHaiku4.5.
Strict semantic count/options/key/duplicate checks stay; never guess answer keys.
One controlled repair max, SDK retries0,45s/call60s total. Refusal/provider errors
no retry; safe count/truncation/validation/auth/rate/timeout messages instead of
catch-all. Repair never echoes rejected keys or includes HR/PDF data.

Focused27tests,UI5pass; full server4075pass/36skip/0fail. Actual SDK HTTP transport
mock verified serialization. No real paid API call, live response, deployment,
commit, new dependency or live mutations; exact production trigger unconfirmed.
Handoff: docs/superpowers/specs/RESUME-examination-ai-reliability.md.
