---
name: Prepare occasion selections before AI chat
type: project
date: 2026-10-21
---

Latest user direction supersedes chat-first UX. Bottle list and event brief lead.
Autocomplete while typing (250ms, public search, click/keyboard pick), then Send
list to AI reveals chat and submits all bottles/quantities/units/preferences,
city/date/guests/budget/notes and optional upload. Chat continues from this context.
Preserve other page sections and manual WhatsApp option. No automatic requests.

OccasionChat imperative start handle + deferred visibility; existing hook stores
explicit event context and includes full snapshot in initial user bubble. Source
Send and enquiry use distinct native submitter intent. AI missing city allowed;
provided fields validated. Hub has only one shared source form, no duplicate IDs.
Same Claude Haiku4.5/API/backend. Known bare catalogue slug links normalised.

226 platform tests pass, types/focused lint pass. Actual typing/select/send/reply
and mobile verified. No backend change, commit, deployment or server restart.
Resume: docs/superpowers/specs/RESUME-occasion-preparation-first.md.
