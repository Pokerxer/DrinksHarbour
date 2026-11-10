# Occasion review queue

Only platform admin/super_admin. Middleware matcher and route-roles must mirror
API roles; tenant staff/owners/admins cannot view customer briefs or conversations.
Queue refreshes30s, saved message panel10s, with explicit retry and pagination.
Do not poll-refresh the reply editor or overwrite unsaved edits. Customer replies
appear in the saved conversation and reopen request; inspect latest messages before
approving. AI check uses existing server Claude Haiku4.5, never browser API keys.

AI result is editable private draft. Explicit review checkbox required for profile
publish/email/manual WhatsApp record. Any edit/save resets approval. Publish in
chat leaves requested external response outstanding. Email sends and saves the
reply in chat; failure is visible, not sent. WhatsApp requires a second checkbox
confirming human actually sent it; opening/copying is not evidence of sending.
External send failures/suppression retain reply. Use server revision conflict errors
and refresh; never silently replace newer staff work. No auto cart/order writes.

DRI-41 staff chat inbox (2026-11-09): /occasion-requests is a two-pane
WhatsApp-Web-like inbox (`occasion-inbox.tsx`): left = the conversation queue
(request-queue now renders list rows — avatar, name, occasion/city, reference,
status chip, activity time, response target) and right = the same RequestDetail as before, selected in place via `?id=` (`history.replaceState` +
`useSearchParams`, Suspense-wrapped). Deep links /occasion-requests/[id]
remain the full-width detail page; plain row clicks keep real hrefs
(meta/ctrl/shift clicks open new tabs). Small screens show one pane at a
time (list first, detail when selected).

Queue rows carry the server read-receipt aggregates (DRI-41 additive fields on
the admin list: `customerUnreadCount`, `firstStaffReplyAt`, `hasStaffReply`,
`lastMessageAt`): the burgundy badge counts team replies this customer has NOT
read yet (`customerUnreadCount`, suppressed at zero and for legacy rows);
activity prefers `sentAt`, then `firstStaffReplyAt`, then `createdAt`.

The saved conversation panel reads through `staff-history.ts` (the customer
library's incremental correctness shape): initial full read — which IS the
server-side staff read watermark `lastStaffReadAt` (DRI-41) whenever an
authorised staff client polls the open pane — then every 10 s visible-tab tick
reads `?after=<last server _id>` (DRI-26) merging only strictly-newer
messages; unclear/errored responses degrade to a full read in the same tick;
full 30-message pages chain inside the tick. Bubbles/day rails
(`chat-parts.tsx`) mirror the customer surfaces (burgundy outgoing/white
incoming, WAT, escaped text). Staff outgoing ticks stay honest: one tick =
saved in the customer's chat; NO customer-read tick is rendered here (per-
message customer-read proof lives only in the customer's own brief). All the
governance from DRI-22/DRI-28 above is untouched. Regression suites:
request-queue.test.tsx, request-queue.badge.test.tsx,
conversation-panel.test.tsx, request-detail.test.tsx.
