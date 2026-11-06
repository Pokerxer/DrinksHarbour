# Occasion preparation and staff review

Current flow (2026-10-21): category preferences + image catalogue autocomplete +
quantity list + event/contact/upload form. No customer occasion AI/chat. Preserve
catalogue search/bottle images, category controls and commercial guides. The shared
OccasionChatPlanner name remains for imports but renders a staff request form.
Floating shopping AI is hidden on /occasions and /my-account/chat routes; shopping
chat elsewhere remains available. Public mode=occasion chatbot calls return410.

Customer must sign in before submission. Their UUID-idempotent request is owned
by server JWT, not email matching. Receipt links to /my-account/chat/[id], and
profile Chat menu lists saved conversations. Customer may leave; team aims to reply
in about30minutes, may take longer when busy. No countdown or guaranteed response.
Reply method email or staff-sent WhatsApp, with explicit contact consent. Selected
bottles send numeric quantities only; no client prices or size/pack controls.
One supported list/photo uploaded only on Send. Failed send preserves fields/file
and UUID; a changed snapshot gets another UUID. No model on edits or submission.

Staff /occasion-requests queue checks original request, privately uses catalogue
AI if needed, edits/approves final reply and sends it. Approved replies are also
stored in the customer's profile chat. AI drafts never appear to customers. Email
requires real provider acceptance; WhatsApp human send is explicitly recorded.
Original files are private authenticated downloads. No stock reservation/orders.

Legacy inline AI components/helpers remain isolated for compatibility/tests but
are no longer mounted in occasion customer pages. Existing general shopping chat
has separate behavior. Latest handoff: docs/superpowers/specs/RESUME-occasion-staff-review.md.

Form accessibility (2026-10-27): failed validation focuses the first invalid field
and associates its visible error through aria-invalid/aria-describedby. Keep
validation client-side before requests, preserving details and idempotent retries.

Occasion planning tools and subpages (2026-10-27): the four occasion pages have
bespoke planning bodies without any AI. Corporate/house-parties/gifting mount
XxxPlanning via CommercialGuide body in app/occasions/[occasion]; weddings keeps
its own WeddingPage with SubpageNav, calculator and reserve-free shelf. Shared
primitives live in components/Occasions/planning (GuestDrinkCalculator,
OccasionShelf, SubpageNav) — deterministic quantities only, never client-side
price math; pricing stays on /shop and bottle pages. Subpage content is
registered per occasion in lib/occasions/<occasion>.ts and renders under
app/occasions/[occasion]/[subpage] (static params, 404 otherwise); the floating
shopping AI stays hidden because the /occasions/ prefix matcher covers subpages.

Gifting functions + animation pass (same day evening): /occasions/gifting has
four deterministic gifting tools mounted BEHIND GiftingToolkit (tabbed client
component: Build a hamper / Recipients / Budget guide / Message — one panel at
a time, `rise` crossfade, aria tablist/tab/tabpanel). HamperBuilder is onUse-
driven: the shared SuggestionQuantities summary lives in the toolkit, not the
builder (exactly one summary, persists across tabs). RecipientOrganizer totals
stay inside its tab. Logic modules: recipientPlan.ts, giftBudgetLadder.ts
(naira ladder 0/10000/25000/60000), giftMessages.ts (16 pairs × 3 templates).
Animations in giftAnimations.module.css (rise/dropIn/shimmer/dot) disabled
under prefers-reduced-motion. No AI, no models, no client-side price math.
macOS casing gotcha: the budget lib is giftBudgetLadder.ts so
`./GiftBudgetTiers` imports the component, not the lib — keep lib/component
names distinct. The CSS-module import requires the `.module.css` stub in the
gifting, weddings test loaders.

Gifting planning pass (earlier same day): page composition is hero → SubpageNav
→ story body → full-width tools band → request-form planner → footer.
OccasionShelf must never search with a human label: it resolves query || category || type || label and
has labelled skeletons plus a Try-again error state. CommercialGuide takes
optional `below` (full-width band before footer) and pages may carry
`facts?: string[]` quick-fact chips with anchored sections on subpages. Keep
Planning story/below splits when reworking those files: named exports
XxxPlanningBody/XxxPlanningBelow; the default export still composes both for
the component tests.

Category selection drives the quantity calculators:
lib/occasions/categoryRows.ts maps the planner checkboxes to CalcConfig row
ids per occasion; GuestDrinkCalculator gets a filtered config (nothing
selected = full config + tip line; checked categories with no row render an
honest uncovered note). Corporate/house-parties share the selection through
OccasionDrinksProvider + OccasionChatPlanner's optional context; weddings
passes its own state down. Extend CATEGORY_TO_ROWS and the occasion CalcConfig
together so every planner checkbox keeps a row (house-parties intentionally
has none for toast).
File ownership for parallel agents: Weddings/**, Occasions/corporate/**,
Occasions/house-parties/**, Occasions/gifting/** plus each lib/occasions entry.
Plan: docs/superpowers/plans/2026-10-27-occasion-pages-plan.md; spec:
docs/superpowers/specs/2026-10-27-occasion-pages-subpages-design.md.

SEO + design polish pass (DRI-23, 2026-11-06; plan doc
docs/superpowers/plans/2026-11-06-occasions-improvement-plan.md): sitemap.ts
lists all 13 occasions URLs; GuideStructuredData derives breadcrumbs from path
depth (and emits CollectionPage on the index when given collectionItems);
CommercialGuide shows the parent-occasion breadcrumb link on subpages;
SubpageNav accepts planHref (weddings passes #wedding-list — its planner never
mounts id="occasion-chat"); the shared SubpageInCopyLinks primitive in
Occasions/planning/ renders the in-copy subpage link sentence for the occasion
bodies (corporate sections.ts gained an optional links field; gifting keeps
inline links); OccasionsExplorer/OccasionCard link each occasion's subpages as
short chips on the index. Design alignment: gifting story sections are
unboxed to match the corporate/house-parties body rhythm; house-parties shelf
grid and summary card follow the shared SuggestionQuantities gold-border
treatment. occasions.test.cjs's loader also resolves <dir>/index.ts now
(weddings loader precedent) so lib/occasions can be imported by the explorer.
Keep these when reworking; the planner/chat files stay owned by the funnel
child (DRI-24), not by this note.

Post-send human chat modal (DRI-22, 2026-11-06; plan
docs/superpowers/plans/2026-11-06-occasions-improvement-plan.md): ownership of
`Occasions/chat/**` is the chat-modal child. When OccasionRequestForm
successfully submits it now reports the receipt through an optional
`onReceipt` callback; OccasionChatPlanner stores the receipt and mounts
`PostSendChat` (keyed by conversationId), which auto-opens the modal on send
and keeps a "Continue chat" affordance (with a client-side unread badge) once
closed in the same page session. All four occasion pages get it through the
planner. Files: `chat/PostSendChat.tsx` (controller + affordance),
`chat/PostSendChatModal.tsx` (dialog shell: role=dialog, aria-modal,
aria-labelledby title, focus trap, Escape closes, close hands focus to the
Continue-chat button, mobile full-screen sheet, static styling so
prefers-reduced-motion is respected by construction), `chat/`
`PostSendChatThread.tsx` (honest waiting copy — "about 30 minutes … longer
when busy" + a "Checked HH:MM" line so busy periods read as time passing,
never a fake automated message; staff/customer bubbles like
components/CustomerChat/ConversationPage), `chat/PostSendChatComposer.tsx`
(plain text only, 4,000 chars, no price/size/pack controls),
`chat/useOccasionThread.ts` (10s poll of the EXISTING
GET/POST /api/occasion-requests/:id/messages endpoints while the tab is
visible; unread counts are computed purely client-side per message `_id`
because the backend has no read state; failed sends keep their text and reuse
the send's UUID message key, mirroring the inline form's honest retry
language). The modal is a convenience pane over the same conversation;
`/my-account/chat/[id]` stays canonical and "Open full conversation" links
appear in the modal footer and the closed-state row. No AI is mounted: the
floating shopping AI stays hidden on /occasions and its subpages via the
CustomerChatbot prefix matcher, and the modal does not change the pathname so
it cannot re-appear while open. The public mode=occasion 410 contract, the
staff review flow and the receipt copy in OccasionRequestForm are untouched.
Tests: `components/Occasions/chat/postSendChat.test.cjs` (4 cases: dialog
a11y/copy/canonical link, closed-state unread badge via the poll, failed-send
retry-key behavior, planner mounts the modal from the form's receipt).

Post-send chat UX pass (DRI-27, 2026-11-06): `Occasions/chat/**` still owns the
pane; `/my-account/chat/[id]` stays canonical. Sends are optimistic:
`useOccasionThread.send(content[, existingLocalId])` queues a client-only
`local:<uuid>` bubble (`ChatMessage` shape + `local: 'sending'|'failed'` +
`error`), clears the composer, and re-uses the same UUID idempotency key on
retry; local ids NEVER enter the `_id` cursor math (`apply()`/seenId/unread
always compute from the pure server list) and extras survive polls until the
server document replaces them. Failed sends stay inline on the bubble (text +
server error + per-message Retry via `retryMessage`); the composer no longer
holds failed text or a banner error. Keyboards: `lib/chatKeyboard.ts`
`enterSubmitsMessage` — Enter sends on desktop, Shift+Enter newlines, and at
event time bails out for IME composition and coarse-pointer/virtual keyboards
(missing `matchMedia` API counts as desktop); button submit works everywhere.
Status surfaces all five request states + staff-reply precedence via
`lib/chatStatus.ts` `chatStatusCopy(status, replied, surface)` ('modal' band in
PostSendChatThread, 'closed' band in PostSendChat, 'page' header line in
ConversationPage) — delivery_failed copy states what failed (the staff plan
send), that the plan stays saved, and recovery by retry/email/WhatsApp per
consent; no countdowns. Day grouping via `lib/chatFormatting.ts`
`chatDayLabel`/`chatTimeLabel` (WAT, fixed UTC+1; Today/Yesterday/plain-date
headers; malformed timestamps degrade instead of throwing) and
`isAuthChatError` detects 401/auth-shaped errors, which render "Sign in to
continue" links built with `chatSignInHref` →
`/login?redirect=/my-account/chat/<id>&reason=expired` (established platform
convention), never dead-ending in error copy. Reply-arrival attention: while
the pane is closed, unread counts flash the document title `(n) prior title`
from the existing poll only (1.2 s interval in `PostSendChat`, exact prior
title restored when the pane opens/unmounts) plus ONE static closed-band
unread line. Tests: `chat/postSendChat.test.cjs` (11 cases) keeps the 6 prior
cases green — the failed-send case now asserts optimistic queue → inline
failure → same-UUID retry → success replacement — with additions for
five-status copy, keyboard bail-outs, WAT day grouping, title-flash restore
and the auth return path. jsdom gotchas: `window.matchMedia` does not exist
there (stub it for coarse-pointer tests) and React-controlled textarea values
leak into `document.body.textContent` — assert on the `[role=log]` node.

Integration pass (DRI-28, 2026-11-06): `chat/useOccasionThread.ts` now polls
incrementally on DRI-26's `after` cursor. The initial load stays the full
read; every later 10 s visible-tab tick reads
`GET /:id/messages?after=<last server _id>` (via
`customerConversation.read(id, { after })`), merges only strictly-newer
messages plus the brief `status`, and — when a full 30-message page returns —
re-pages immediately with the last id inside the same tick (bounded loop).
Cursor math lives in `lib/incrementalThread.ts` (`newestServerId`,
`incrementalSplit`, `FULL_PAGE`): optimistic `local:*` bubbles NEVER feed the
cursor, and any error or unclear response (ids at-or-before the cursor, brief
missing) degrades to a full read in the same tick. `lastCheckedAt` advances
on every successful read either way; unread stays session-derived for the
instant in-modal/continue-badge display while the reads themselves drain
`lastCustomerReadAt` server-side (authoritative unread for closed surfaces is
`customerUnreadCount` from `GET /mine` — see CustomerChat README). Tests:
`chat/postSendChat.test.cjs` (16 cases) adds after-cursor merge + status
update, 30-page immediate re-page, unclear-response and error fallbacks, and
the placeholder-exclusion case.
