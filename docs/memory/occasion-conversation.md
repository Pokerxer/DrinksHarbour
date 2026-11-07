---
name: Conversation-led occasion planning
type: project
date: 2026-10-20
---

User clarified main experience must be customer/AI conversation for weddings and
other occasions, with typed/pasted lists, uploads and catalogue picks. Preserve
manual sections. Shared OccasionChat/Composer/Planner now lead hub/all occasion
guides; WeddingChatHelp wraps existing wedding state. Supporting tools remain.

Existing multipart API mode=occasion routes BEFORE generic file/image handling
so history survives uploads. Model claude-haiku-4-5 / Anthropic SDK. New small
server/services/occasionChat.service.js; no new package, persistence or credentials.
Explicit sends only, attachment-only messages, retries preserve files/drafts,
clear aborts late work, 90s timeout, transient bounded history/reference. Catalogue
cards use actual public entries and add to planning list only on user selection.
Download chat/summary; no cart/order execution. See components/Occasions/README.md.

Live test found invented volume maths and internal stock disclosure. Prompt now
forbids derived serving/volume estimates; strip raw stock counts before AI input.
Unknown ABV never implies0%. No claims of unlimited memory: analysis10k chars,
attachment reference5k, sent history20turns/24k including manual list.

Latest checks/results and browser state: docs/superpowers/specs/RESUME-occasion-conversation.md.
No commit/push/deploy; preserve unrelated checkout. API/dev left running.

Final verification:223 storefront tests;4106 backend pass,36skip,0fail; types and
scoped lint pass. Live text/CSV/follow-up/catalogue selection verified; mobile390
checked. Conversation download verified. Own tab closed and viewport reset.

2026-10-21 UX superseded: source panels first, autocomplete, explicit Send reveals
chat. Current handoff: docs/superpowers/specs/RESUME-occasion-preparation-first.md.

2026-11-06 DRI-26 backend delivered: `GET /api/occasion-requests/:id/messages`
gains `?after=<message _id>` (newer-only, ascending, ≤30, brief rides along;
malformed cursor → same 404 guard as `before`; `olderCursor` only for
full/`before` reads). Customer reads of own threads persist
`OccasionRequest.lastCustomerReadAt` (forward-only, admin/super_admin never
write). `GET /mine` returns `customerUnreadCount` (staff messages newer than
the mark; 0 for legacy rows without the mark) via a second aggregate beside
`firstStaffReplies`. No new endpoints, no status/notify/send changes. See
docs/superpowers/specs/RESUME-occasion-chat-improve-DRI-26.md; frontend DRI-25
child switches the 10 s full-thread poll onto the `after` cursor.

2026-11-06 DRI-28 frontend integration delivered: both customer pollers
(`Occasions/chat/useOccasionThread.ts` + `CustomerChat/ConversationPage.tsx`)
start with one full read then read incrementally on `?after=<last server
_id>` per 10 s visible-tab tick, merging only strictly-newer messages + the
brief `status`; full 30-message pages re-page immediately inside the tick
(bounded). Errors/unclear cursor semantics fall back to the full read the
same tick. Cursor helpers live in `lib/incrementalThread.ts`; optimistic
`local:*` bubbles never feed cursor math. Reading either surface still
issues `GET /:id/messages`, which drains `lastCustomerReadAt` server-side;
in-modal unread stays session-derived for instant display. ConversationList
renders `customerUnreadCount` from the existing 15 s `/mine` poll as an
accessible badge (pill + sr-only text, hidden at 0; `customerUnreadCountFor`
treats legacy/missing as 0). Account-nav Chat badge DEFERRED — the only
/mine poll is inside ConversationList on /chat, so a layout badge would need
a new global loop (violates the cheapness gate). See
docs/superpowers/specs/RESUME-occasion-chat-integration-DRI-28.md; platform
chat suites 31/31 green.
