---
name: Inline wedding AI assistant
type: project
date: 2026-10-20
---

User wanted AI directly in wedding builder. WeddingChatHelp now sends quick
prompts/custom questions to existing /api/chatbot/query and displays replies
inline through useWeddingAiChat + safe WeddingAiTranscript. Optional floating
chat draft retained. Existing model claude-haiku-4-5 / Anthropic SDK, no backend.

Important server contract: query truncates at 2000 chars. Keep question <=1000,
send current full list as recent history chunks <=3500 (total context <=6000),
plus six bounded prior turns. No silent list truncation or cartProposal execution.
Current list/preferences included only on explicit requests; no enquiry PII copy.
30s timeout, retry, clear/abort and stale-response protection; no persistence.

217 platform tests, scoped lint and final types pass. Actual local AI response
verified inline using Non-alcoholic ideas; mobile reviewed at 390x844, chat fits.
Test tab closed; viewport reset. No commit, deployment or server restart.
Resume: docs/superpowers/specs/RESUME-inline-wedding-ai.md.

Superseded primary UX: customer clarified conversation must lead all occasions.
See docs/superpowers/specs/RESUME-occasion-conversation.md for current behavior.
