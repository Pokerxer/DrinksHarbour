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
