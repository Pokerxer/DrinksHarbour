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
