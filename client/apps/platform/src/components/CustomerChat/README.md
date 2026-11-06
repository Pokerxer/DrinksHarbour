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
