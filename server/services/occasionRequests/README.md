# Occasion requests and saved conversations

Platform-owned wedding/occasion planning, not tenant CRM or an order. Customer
intake requires protect + role customer. Persist customer from req.user._id only;
ignore customer/tenant/recipient/status/draft fields supplied by clients. Never
match profile ownership using submitted email or phone. Every customer thread/file
query first scopes {_id,customer}. Platform admin/super_admin alone see staff queue,
contacts, files and drafts. Tenant roles are refused. No public record reads.

OccasionRequest stores original brief, consented contact, one bounded private file,
30minute response target and review/delivery state. OccasionMessage stores customer
and approved staff messages separately, with unique(request,messageKey) and bounded
content. Latest30 messages/20threads per page; earlier messages use an ObjectId
cursor. Profile replies/continuation are durable. Original brief/file remain on
request. Never expose an AI draft in customer thread projection.

Intake is idempotent using UUID + fingerprint including customer; retries must
match the initial snapshot. Enforce field/quantity/contact/extension/magic/size
limits before create. Upload ceiling8MB docs/5MB photos, one file. File bytes are
select:false and only authenticated attachment downloads with nosniff/no-store.
Staff notification failure does not erase a durable request. No model on intake.

Staff may inspect original file and explicitly invoke Claude Haiku4.5 through the
existing server Anthropic SDK/catalogue generation service. Only event/list data
and bounded recent conversation are supplied; email/phone are excluded. Model
output is a private draft, no customer send. Structured catalogue plans retain
verified IDs/prices/stock/budget checks. Staff must review final draft and approval.
Save/generate/send use revisions and busy locks to reject stale/concurrent work.

Publishing approved reply saves it to profile chat; external reply stays outstanding
(status draft). Email action saves approved reply to chat and calls existing sender;
suppressed/dev-mode/missing provider ID cannot count as sent. Failure retains draft
and shows delivery_failed. WhatsApp is HUMAN SEND per user choice: copy saved reply,
open WhatsApp, actually send, then explicitly confirm/record; this also saves the
reply in chat. No automatic WhatsApp send or false provider delivery receipt.
Identical reviewed reply retries dedupe by content + last customer message time.
Website customer messages reopen request and response target. An arriving follow-up
during outbound send must not be hidden under completed status.

Customer GET /mine payloads carry per-request status timestamps for the occasion
post-send status block and chat modal: status and submitted/lastMessageAt/dueAt
timestamps from the request projection (createdAt is the submitted instant), plus
hasStaffReply and firstStaffReplyAt computed read-only from the earliest staff
sender message in the thread (never request.sentAt, which only some delivery
paths set). firstStaffReplyAt is null with hasStaffReply false when the team has
not replied yet. The staff-reply lookup is skipped for empty pages. These fields
are additive and never include contact PII, drafts, costPrice, attachments or
tenant data. GET /:id/messages provides sender per message so the frontend can
compute unread state client-side from the message list; no server unread state,
read receipts or websocket is claimed.

Messages on this site and staff-recorded outbound plans are stored. Inbound email
or WhatsApp messages are not imported automatically. Email acceptance is not a
read/delivery receipt. A request stuck in sending after a process crash needs an
operator to check the mailbox before recovery; never auto resend uncertain sends.
No checkout/cart/reservation writes. Response target is an estimate, not a timed
job or guaranteed staffed SLA. Maintain profile and admin role isolation.
