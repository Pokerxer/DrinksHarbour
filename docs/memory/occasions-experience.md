---
name: Occasions experience
type: project
date: 2026-10-20
updated: 2026-11-06
---

2026-11-06 update: the next occasions improvement round is planned by the
Paperclip CEO under company issue **DRI-18** (`74848846-b14d-4321-b46d-718c3ea60de7`,
assigned to DrinksHarbour CEO, in_progress at handoff). Scope: [occasion] page
handling/process, new engagement mechanics, design + SEO + marketing, and a
post-send chat modal where the customer chats with a HUMAN agent (reuse the
my-account/chat/[id] human thread; the no-AI 410 contract stays). Board wake
comment 7982d112 set priorities. Details and resume points:
docs/superpowers/specs/RESUME-occasion-ceo-plan-DRI-18.md.

2026-11-06 later: DRI-18 is DONE — plan ran through children DRI-19–24
(backend status basis, post-send human chat modal deep-linking
/my-account/chat/[id], saved draft + post-send status + sticky CTA, SEO
quick wins + design polish in commit 9cd03df3). The chat modal lives in
components/Occasions/chat/** with useOccasionThread 10s polling. Follow-up
round "improve the chat functionality" opened as **DRI-25**
(893f7c63-8c0a-46c5-9f4b-d59482c9c58a, CEO) and is DONE: children DRI-26
(server: after-cursor incremental reads, lastCustomerReadAt read marks,
customerUnreadCount in conversationRepository.list — 8/8 occasionConversation
tests), DRI-27 (UX pass, commit 541a0c9f: optimistic send, Enter/Shift+Enter
with touch/IME guard, all five status states incl. delivery_failed, WAT day
grouping, title flash, 401 return path — 16/16 postSendChat tests), DRI-28
(integration, commit b99789f2: incremental polling with full-read fallback,
canonical ConversationList + account-nav unread badges — plus 9/9
customer-chat, 2/2 occasions, 4/4 occasionsDraft). CEO verification run
2026-11-06T14:23Z; board 8-point audit delivered in full. Resume:
docs/superpowers/specs/RESUME-occasion-chat-improve-DRI-25.md.

2026-11-09 update: next round opened as **DRI-41**
(5ace937b-5fbb-447c-a7e1-800b1e11cc06, CEO, in_progress at handoff):
WhatsApp-style redesign of the /my-account/chat surfaces + upgrade of the
existing admin staff module (client/apps/admin/src/app/shared/occasion-requests
under app/(hydrogen)/occasion-requests) into a WhatsApp-Web-like staff inbox.
Honest-ticks rule (staff read ticks need lastStaffReadAt — CEO decision),
burgundy over WhatsApp grammar, governance contracts preserved. Resume:
docs/superpowers/specs/RESUME-occasion-chat-whatsapp-DRI-41.md.

User requested /occasions design and functionality improvements. New platform
components/Occasions folder provides burgundy/Fraunces hero, decorative inline
SVG, four guide/plan cards, bulk entry, selected catalogue links, enquiry brief
and delivery/trust FAQs. Page SEO identity remains unchanged.

Brief helper: lib/occasionBrief.ts. Required occasion/city; optional Lagos-time
calendar date, positive integer guests, positive NGN budget and bounded notes.
Prepare only creates a preview; explicit WhatsApp link opens a draft. Edits clear
stale drafts; Clear brief resets. No send, storage or PII analytics. EnquiryLink's
new optional label preserves its original default and click-intent tracking.

196 platform tests, scoped lint, final build and sequential type check passed.
Actual component + built CSS inspected at mobile/desktop widths, no overflow.
Global span reset shrank the hero accent; semantic em fixes inherited sizing.
Inputs use 16px on mobile to avoid automatic field zoom. No backend changes.
Preview server/tab closed and viewport reset. No commit/push/deployment/message.
Preserve unrelated dirty checkout work.
Resume: docs/superpowers/specs/RESUME-occasions-experience.md.

Wedding continuation extends shared brief with optional fixed occasion/context,
title and clear callback. Defaults unchanged. Mobile root is 14px, so text-base
was insufficient for 16px input text; explicit text-[16px] now fixes it.
See docs/memory/wedding-experience.md for this continuation's evidence.

## 2026-11-09 — DRI-41 WhatsApp-style chat redesign + staff chat inbox

Customer `/my-account/chat` list+thread+PostSend family now share
`components/chat-ui/` primitives (burgundy WhatsApp grammar, static wallpaper,
time+ticks inside bubbles, sticky caller header). Honest ticks: double check
only when the server watermark `lastStaffReadAt` (new DRI-26-mirror field,
written by the open-pane staff poll) covers the message; otherwise a single
"Sent." check. ConversationList rows = avatar + occasion + reference + activity
time + server unread badge. Admin `/occasion-requests` is now a two-pane
WhatsApp-Web-like staff inbox: row queue (status chips, unread badge from
`customerUnreadCount`, activity/response-target columns) + in-place
RequestDetail (`?id=` + replaceState, deep links intact). Staff panel polls
the DRI-26 incremental contract via `staff-history.ts`; the initial read is
the staff read mark. Admin list gains additive read-receipt aggregates; no new
endpoints; governance (draft→approve, AI drafts private, external channels,
no order writes) untouched. Suites: platform customer-chat 10/chat 16/occasions
drafts, admin 11 module tests; types + lint clean; visual evidence at
320/390/1280 (0 overflow) with both tick states; server
`__tests__/occasionConversation*.test.js` green. Global battery + evidence:
docs/superpowers/specs/RESUME-occasion-chat-whatsapp-DRI-41.md.
