# Profile Chat

Customer profile /my-account/chat lists owned occasion requests; /[id] reopens the
saved conversation. Both desktop/mobile account navigation use NAV_ITEMS. Account
shell requires sign-in; API remains the authority for identity. Never supply a
customer ID from the UI. Use fetchWithAuth for cookies/Bearer/CSRF/refresh.

Initial brief/file and all website customer messages/approved staff replies remain
on the server. AI drafts never enter this projection. Text renders as escaped
plain text, not raw HTML. Poll visible threads10s/list15s, merge IDs and allow
paginated older messages. No claim of websocket presence/read receipts. Failed
send keeps text and UUID for idempotent retry; clear only after acceptance.
Switching account/thread resets loaded state. Attachments use private download.
No customer AI or paid model call on these pages. Staff can use AI privately.
External inbound email/WhatsApp history is not automatically imported.

UI hardening (2026-10-27): polling recovery clears only load failures, preserving
failed-send text and actionable send errors. Every send/history response checks
the active account/thread context before changing state; switching threads resets
busy flags and retry keys. Keep this isolation even when the component is reused.
Composer and original brief wrap long content on mobile; controls retain 44px
minimum targets and visible focus. Regressions: customer-chat.test.cjs.

DRI-27 UX pass (2026-11-06): ConversationPage keeps its non-optimistic send
(text clears only on acceptance, UUID idempotent retry). Addition status copy:
the header line now reports all five backend request states (pending/draft/
sending/sent/delivery_failed) with staff-reply precedence, shared with the
occasions pane through `lib/chatStatus.ts` `chatStatusCopy(..., 'page')`.
Timestamps group by WAT day (`lib/chatFormatting.ts` `chatDayLabel`/
`chatTimeLabel` — Today/Yesterday/plain date; `isAuthChatError` there flags
401/auth-shaped failures) and the error band renders a "Sign in to continue"
link → `/login?redirect=/my-account/chat/<id>&reason=expired` (established
platform convention) so auth failures never dead-end. Composer: Enter submits
via `lib/chatKeyboard.ts` `enterSubmitsMessage` on a real desktop keyboard,
Shift+Enter inserts a newline, IME composition and coarse-pointer/virtual
keyboards keep default behaviour at event time; the button always works.
customer-chat.test.cjs now also covers status header copy, Enter/Shift+Enter/
coarse bail-outs, WAT day grouping and the sign-in return path (7 cases).

DRI-28 integration pass (2026-11-06): the profile thread now shares the
occasions pane's incremental polling contract. Initial load stays the full
read (which doubles as the server-side `lastCustomerReadAt` drain — reading
this page IS the read call); every later 10 s visible-tab tick reads
`GET /:id/messages?after=<last server _id>`, merging only strictly-newer
messages plus the brief `status` (keeps `olderCursor` and any earlier history
already merged). Unclear responses (ids at-or-before the cursor) or errors
degrade to a full read in the same tick via `mergeConversationHistory`.
Shared cursor math: `lib/incrementalThread.ts` (`newestServerId`,
`incrementalSplit`, `FULL_PAGE` — full 30-message pages re-page immediately
within the tick). `lib/customerConversation.ts` `read` takes a
`{ before?, after? }` cursor object and /mine rows type
`customerUnreadCount`; `customerUnreadCountFor()` treats absent/legacy
counts as zero. ConversationList renders the per-request server count as an
accessible unread badge (visual pill + `sr-only` "N unread replies from our
team", badge suppressed at zero). No new request loops. Nav (Sidebar/
MobileNav) Chat badge is DEFERRED: the only existing /mine poll lives inside
ConversationList on /my-account/chat, so a layout-wide badge would require a
new global polling loop or a context provider + fetch waterfall in the
my-account layout — both outside this issue's cheapness gate. Regressions:
customer-chat.test.cjs (9 cases — adds the server-unread badge, the
incremental page poll with read-call assertion, and full-read fallback).

DRI-41 WhatsApp-style redesign (2026-11-09): both surfaces live in
`components/chat-ui/` primitives now (ChatBubble/ChatTicks/ChatDayDivider/
ChatHeader/ChatComposer/ChatWallpaper/ConversationRow — presentation only;
state still lives in each consumer). Layout grammar: sticky caller-style
header (back + occasion identity + reference), status strip carrying
`chatStatusCopy`, wallpaper thread area (static burgundy-tinted pattern,
no parallax/motion), rounded alternating bubbles with the sharp corner on
the sender side, timestamps INSIDE the meta row labelled WAT.

Honest ticks (scored, not claimed): outgoing bubbles get a double check only
when `lib/chatStatus.ts chatReadState(createdAt, lastStaffReadAt)` proves a
server watermark covers them — `OccasionRequest.lastStaffReadAt` (DRI-41
server, DRI-26's `lastCustomerReadAt` mirror) is written by `GET
/:id/messages` when an authorised staff client polls the open conversation
and reaches the customer only through the read brief. No watermark (legacy
deployments, malformed timestamps, unproven messages) → single "Sent."
check, announced in sr-only text. The old "no claim of read receipts" rule
is superseded ONLY in this server-proven shape; nothing may fake a state —
`postSendChat`/`customer-chat` suites now assert the honesty boundary.

ConversationList rows are `chat-ui/ConversationRow` (avatar + occasion +
reference/date + activity time from `firstStaffReplyAt`/`lastMessageAt` /
`createdAt` via `chatListTimeLabel`, status "Team replied"/"With our team",
server unread badge). Behavior contracts unchanged: 15s list / 10s poll on
visible tabs, UUID-idempotent send, Enter/Shift+Enter/IME/touch guards via
`lib/chatKeyboard.ts` (composer now shared `chat-ui/ChatComposer`, stable
`customer-chat-message` textarea id), 44px targets, sign-in return path,
`[role=log/alert/status]` structure and every Regressions; the 320px no-overflow constraint is checked visually (screenshots at 320/390/1280
showed no horizontal overflow).
