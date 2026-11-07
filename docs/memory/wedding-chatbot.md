---
name: Wedding chatbot integration
type: project
date: 2026-10-20
---

WeddingChatHelp connects current list/preferences to existing ChatbotWidget.
Review/ideas/non-alcoholic actions create reviewed drafts via transient queued
lib/chatPlanning.ts bridge and pure lib/weddingChatPrompt.ts. usePlanningDraft
opens widget; PlanningDraftCard appends to existing composer without replacing
unsent text. Explicit Send remains required; no automatic list/cart mutation.

Existing AI model claude-haiku-4-5 through Anthropic SDK. No backend/model change.
No new draft persistence or PII analytics. Current list only; city/date/guest/
budget/notes remain in enquiry form. Existing chat session persistence unchanged.

211 tests and type check pass. Lint zero errors, two existing widget image warnings.
Real local browser preview/prefill and provider reply verified with a non-personal
wedding-list prompt. Mobile layout checked; review defers keyboard focus until
Add list to message. Test tab closed and viewport reset.
No deployment/commit/server restart. Resume: RESUME-wedding-chatbot.md.

2026-10-20 follow-up: primary wedding AI is now inline with real requests and
conversation; floating handoff remains optional. See
docs/memory/inline-wedding-ai.md.
