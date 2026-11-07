# Uncommitted frontend polish — 2026-10-27

User requested delegated UI/UX Pro Max and frontend review. Three scoped agents
improved venues, new admin operations, and customer chat/planning. Root improved
order tracking. Preserve existing brand and API/security/payment authority.

## Second wave (4 concurrent agents, all verified)

- Platform venues: branded `venues/error.tsx` recovery card, `[slug]` location
  picker restyled (cursor now `encodeURIComponent`-ed), reserve skeleton, form
  validation focusing first invalid, spinner/busy labels, tone banners in
  payer-checkout, status chips always with text. 9/9 venue tests + tsc clean.
- Occasions/chat/authenticity/bulk-drinks: thin pages elevated, skeletons and
  textured empty states, focus rings, auto-grow composer. 37/37 node tests +
  type check clean. Existing wine/forest/warm-white tokens preserved.
- Admin venue workspace: new mirrored `shared/venue/workspace/controls.tsx`
  kit (do NOT fork a second style — extend it), scannable venue-completion,
  readable rewrites of capacity/money/payer files with pinned test strings
  kept verbatim. 23/23 tests, tsc 0, eslint clean.
- Admin ops: foundation tokens refined (API additive only), all five
  workspaces unified, interpolated-amount refund confirms, "Retry locations"
  preserved, occasion-queue session guard untouched. 44/44 scoped tests.
- Full-suite integration: admin 3273/3274 after fixing the
  `venue-review-corrections` checkbox race (checkbox query now inside
  waitFor — remount legitimately shows Loading bill); 5/5 deterministic.
  Both apps tsc exit 0. Flaky before the test fix, component was correct.

Open items: display font split (Fraunces/Bouscery on occasions pages vs
font-[var(--font-kavoon)] elsewhere) needs a platform decision; sticky admin
venue sub-nav `top-0` offset vs shell header untested in browser;
`beforeunload` guards do not cover in-app route changes.

Order tracking is decomposed into the route and components/Orders/TrackingLookup,
tracking-display and tracking-types. Preserve its session-keyed boundary, no-store
lookup, sign-in redirect containing the requested order number, accessible label
and error association, and explicit recorded-status refresh. Refund status copy
must not promise a provider settlement date unsupported by order data.

Relevant handoffs: docs/superpowers/specs/RESUME-ui-frontend-polish.md and its three
linked owner documents. All results remain uncommitted. Consult that handoff for
fresh verification and remaining limits.
