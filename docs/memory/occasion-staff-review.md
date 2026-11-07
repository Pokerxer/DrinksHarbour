---
name: Occasion staff review and profile conversations
type: project
date: 2026-10-21
---

User retired customer-facing occasion AI. Customer signs in, submits requirements,
category/catalogue bottles and/or private file. Platform staff optionally use
Claude Haiku4.5 privately, edit and approve the plan. Approx30min response target;
customer can leave. User explicitly chose staff-sent WhatsApp, not automatic.
Email delivery uses existing sender, rejects simulated/suppressed acceptance.

User additionally required profile Chat. /my-account/chat and /[id] save/reopen
customer/admin conversations by JWT owner; initial brief/file and all website
messages/approved outbound plans persist. Profile desktop/mobile Chat menu and
shortcut added. No email/phone auto-linking, public reads, tenant-role access or
customer-visible AI drafts. Staff /occasion-requests reads same conversation.
Customer messages reopen requests; approved replies are copied to chat. No incoming
external WhatsApp/email sync. Private files/select:false, bounded history/upload,
UUID retries, revision/busy locks and explicit staff approval. No checkout writes.

4149backend/240platform and13targeted staff UI checks passed; full admin suite still
reports unrelated inventory/timeframe/worker issues (timeframe passed isolated
retry). Exact evidence/limits: docs/superpowers/specs/RESUME-occasion-staff-review.md.
Implementation local only; no deploy/commit/push. Legacy occasion AI components
remain unmounted. Do not restore public AI from older handoff files.

2026-11-06 (DRI-19, occasion plan child): GET /mine now carries per-request
status/createdAt/lastMessageAt/dueAt plus hasStaffReply and firstStaffReplyAt
(earliest staff-sender message, aggregated read-only from OccasionMessage; null
until the team replies). No routes, auth, idempotency, rate limits or delivery
behavior changed; GET /:id/messages still lets the frontend compute unread
client-side from sender fields. Verified 3 focused tests in
server/__tests__/occasionRequestStatus.test.js, 55/55 occasion suite; full
node --test '__tests__/*.test.js' run had 4683/5033 pass with the only failures
in mongodb-replica-set-dependent files and one pre-existing posSocketGateway
case (mongod not running locally; unrelated to occasion code).

2026-11-06 (DRI-22, occasion plan child): post-send human chat modal added in
platform components/Occasions/chat/ (PostSendChat controller, PostSendChatModal
dialog shell with focus trap/Escape/mobile sheet, PostSendChatThread with honest
~30-min waiting copy + "Checked HH:MM", PostSendChatComposer plain text 4000
chars, useOccasionThread 10s poll with client-side unread counting). Mounted
from OccasionChatPlanner on all four occasion pages: auto-open after a
successful submit, "Continue chat" affordance + unread badge once closed in
session, permanent "Open full conversation" link to the canonical
/my-account/chat/[id]. Reuses GET/POST /api/occasion-requests/:id/messages via
lib/customerConversation; no AI, no 410 contract change, no staff-flow change,
no delivery-guarantee copy. OccasionRequestForm gained an optional onReceipt
callback. Evidence: platform chat tests 4/4, prior occasion/weddings suites
46/46, broad platform component run 157/158 (single pre-existing failure in the
in-flight seo-growth.test.cjs owned by another child), tsc 3 pre-existing
errors in untouched files. No commit/push/deploy.

2026-11-06 (DRI-24, occasion plan child): occasions funnel + engagement pass.
Per-occasion client draft in lib/occasionDraft.ts (localStorage key
drinksharbour-occasion-draft:<general|corporate|house-parties|gifting|weddings>;
persists category preferences, quantity entries, hub occasion choice and
{channel,city,date,guests,budget,notes}; NEVER the attachment File, name/
email/whatsapp, or consent — contacts re-typed and consent re-given per send,
page copy says so). Bridges: OccasionRequestForm draftKey prop with
restore-on-mount, persist-on-change and a "Draft saved on this device …
attachment is never saved" note; clear() wipes the draft on Send-another/
Clear-brief. WeddingPlanner, OccasionsExplorer (hub picker) and
OccasionDrinksProvider (optional draftKey for provider pages) restore/persist
their own state. useOccasionThread now surfaces request.status from the
GET /:id/messages brief (DRI-19 payload) and PostSendChat's closed band is the
post-send status block ("with our team … about 30 minutes", "Your reviewed
plan was sent", "A human replied — open your conversation" from staff senders
— same single poll, no second loop, no countdown). Weddings now gets the pane
through WeddingPlanner.onReceipt (DRI-22 hadn't actually wired it; the
weddings call-count assertions now filter POST bodies). planning/
OccasionCtaBand.tsx: static "Send to our team" band anchored to
#occasion-planner between the tools band and the planner on corporate/
house-parties/gifting and after WeddingQuantities on weddings; shared tool
components must not embed #occasion-planner anchors (corporate.test.cjs
forbids it in the composed render). No new server persistence, no kill-list
mechanics (co-planner/QR/reminders/AI). Evidence: 60/60 platform occasion/
weddings/CustomerChat component suites, seo-crawl 8/8, type:check only the 3
pre-existing errors (Product/Detail, CartContext). Resume:
docs/superpowers/specs/RESUME-occasions-engagement-DRI-24.md.
