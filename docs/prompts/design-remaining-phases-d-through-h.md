---
title: Design remaining Phase D and phases E–H with collaborating agents
date: 2026-10-28
status: ready-for-design-session
scope: remaining-D-and-E-through-H
---

# Copy this prompt into the design chat

Work in `/Users/mac/Documents/drinksharbour`. Design **all remaining Phase D work and phases E–H** from the recorded global-platform strategy. Deliver an implementation-ready product, UX/UI and technical design package, not an audit, generic roadmap or collection of unrelated mockups.

Use agents and subagents. I explicitly authorize delegation, peer discussion and design review, overriding the repository's one-agent default for this task. Make ordinary design choices without asking me questions. Record unresolved commercial/legal/provider decisions as explicit gates; never invent approval or business policy. Complete independent design work despite those gates.

## Scope and safety

This is a **design and planning assignment**, not runtime implementation. You may create design documents, diagrams, wireframes and clearly isolated local interactive prototypes with synthetic data. Do not change production application behavior, migrate data/indexes, install dependencies without need, commit, push, deploy, activate features, use real credentials, make real financial/provider/rider actions or send messages. Preserve the dirty checkout and unrelated work. Do not read private dotenv files or print secrets. Do not start implementation merely because an implementation-plan skill suggests it.

## Read and establish the baseline

Read `CLAUDE.md`, `AGENTS.md`, relevant nearest instructions and applicable installed skills. Start with:

- `docs/audits/specification-v3/{strategy,implementation,architecture,page-coverage}.md`
- `docs/superpowers/specs/RESUME-global-platform-phases.md`
- `docs/superpowers/specs/RESUME-phase-d-recovery-acceptance.md`
- `docs/superpowers/specs/phase-d-acceptance-2026-10-27.md`
- `docs/superpowers/plans/2026-10-27-phase-d-recovery-finance-providers-acceptance.md`
- `docs/saas/markets/` and the relevant venue, payments, fulfillment, inventory, gifting, billing and authorization documentation/source.

Latest verified handoffs supersede historical pending checkpoints. Inspect actual routes, components, models, services and tests before declaring a capability absent. Distinguish existing reusable behavior, incomplete integration, proposed design and externally gated execution. Existing tests do not prove proposed designs.

Use relevant product-capability, brainstorming, design-system, frontend-design, architecture, security and planning skills. Direct authorization to proceed without questions overrides a skill's routine approval/question loop. Research uncertain provider or jurisdiction-specific facts using current primary sources, linking sources and dates. An available provider product is not an approved account or commercial agreement.

## Team structure and collaboration

The root owns baseline, shared architecture, design consistency, integration and final acceptance. Assign scoped leads for:

1. Remaining D: returned-goods disposition, refund components/sources, settlement and recovery operations.
2. E: independent gifts, restaurant commerce, future seating and Nigeria customer journeys.
3. F: international ERM, localization, platform administration and operations.
4. G: UK eligibility, offers, quotes, Smart Cart, payments and fulfillment.
5. H: additional markets, advertising, loyalty, customer subscriptions/gifting and later distribution.

Respect available concurrency; run leads in waves rather than exceeding slots. Leads may delegate bounded UX, domain or read-only adversarial review to subagents when a slot is available. Do not build an orchestration framework or recursively multiply agents. Give each writer exclusive files. Only root edits shared contracts, index and cross-phase roadmap.

Agents must exchange concrete interface proposals and review each other's designs, particularly goods/money/settlement, country/provider settings, cart/fulfillment and customer status semantics. Record disagreements, evidence, decisions, unresolved risks and reviewer responses. Require independent review of each substantive design; root reconciles contradictions before calling the package complete. If delegation is unavailable, report the limitation honestly.

## Required design coverage

**D remainder:** Return inspection and disposition; eligible restock/quarantine/write-off and cost effects; shipping/tax/discount/fee refund allocations; original-source Kora/wallet/gift refunds; zero-value cancellation; merchant liabilities, commission, netting, payout allocation and reconciliation. Design merchant return/refund/settlement detail and platform exception queues. Keep physical receipt, stock availability, customer refund and merchant settlement independent. Missing source authority or policy must be explicit.

**E — V3-15–18:** Independent gift merchants, bundles/component stock, recipient privacy, messages/wrapping and restricted alcohol; restaurant discovery, location menus/modifiers/hours/zones, kitchen acceptance/preparation, food dispatch/collection and stage-aware cancellation; future seating capacity/slots/overlaps, amendments, no-shows and optional deposits. Design customer, merchant, kitchen and booking surfaces. Keep food, parcel, seat capacity and venue bills distinct.

**F — V3-19/20/24:** Country-aware addresses, language, transaction/display currency, tax, timezones, versioned plans, legal consent and original-currency/FX reporting. Design platform country/payment/delivery/merchant/subscription administration, tenant settings and customer preferences. Include audit, uncertain-operation recovery, durable jobs/dead letters/replay, monitoring and restore/cutover readiness. Customer preferences cannot activate markets or change settlement ownership.

**G — V3-21–24:** UK postcode/retailer eligibility, location offers/stock, restriction/coverage checks, expiring real quotes, bounded shipping-inclusive Smart Cart with deterministic fallback/manual choices, GBP multi-retailer checkout, partial refunds/settlements and courier tracking/labels. Design postcode entry, offer comparison, cart explanations, checkout and merchant operations. Stripe Connect/PayPal/couriers remain candidates until approved; do not change existing NG Paystack flows. Never claim a heuristic is globally optimal.

**H:** Inventory existing advertising, loyalty, customer subscriptions, gifting and distribution capabilities first; design only missing journeys/integration. Cover reviewed market onboarding, CPC/CPM campaign budgets/billing/reporting, non-cash loyalty/referrals/abuse controls, recurring customer orders and gifting, and later wholesale/distribution procurement/pricing/credit/logistics. Separate ERM SaaS billing from customer beverage subscriptions. Do not turn future premises, credit terms, distribution economics or proposed prices into approved commitments.

## Architecture and visual requirements

Preserve central Product plus tenant-owned SubProduct/Size, Tenant revenue policy, abstract locations, original order/channel/account/currency/unit identities and existing stock/accounting engines. Keep the separate Wyn website API, POS, venue, wallet, gift-card, inventory and delivery workflows intact. Extend existing services; do not create a second checkout, ledger, inventory engine or duplicate website. Tenant-private reads and mutations remain mandatory.

Inspect the existing visual system and representative screens. Reuse its components, tokens and navigation where appropriate; justify changes. Specify customer, tenant merchant/staff and platform-admin permissions and navigation separately. Designs must be responsive, keyboard-accessible and readable by nontechnical operators. Include loading, empty, validation, denied, unavailable, expired, partial, uncertain, retry and completed states. Prototypes must demonstrate meaningful interactions, not decorative cards or dead buttons; clearly label synthetic data and mocked actions.

## Durable deliverables

Before detailed work, create `docs/superpowers/specs/remaining-phases-design/README.md` with file map, ownership and checklist. Keep documents focused; split long files and link them.

Create a baseline/gap matrix, shared contracts and design-system notes, dependency roadmap and per-phase D/E/F/G/H folders. Each phase must contain:

- Capability scope, actors, reusable source anchors, non-goals, fixed constraints and unresolved policy.
- End-to-end journeys, route/navigation and screen/state matrix with role permissions.
- Concrete wireframes and representative visual/interactive prototypes for critical flows, plus reusable component inventory and responsive/accessibility behavior. Record actual local preview/browser findings where prototypes exist.
- State transitions, authoritative data/model changes, API/command inputs and outputs, validation, privacy, idempotency, concurrency, reconciliation and audit contracts.
- Exact money/rounding, stock/batch/capacity and historical-policy invariants, with worked examples wherever relevant.
- Failure/abuse cases, migration/backfill/index/cutover/rollback proposals and observability requirements. Proposals are not executed migrations.
- Independently implementable vertical slices with exact proposed files, RED/GREEN test scenarios, browser acceptance and explicit exit gates. Save executable plans under `docs/superpowers/plans/` and link them; leave implementation checkboxes unchecked.

Maintain a decision/risk register: owner, source, confidence, affected phases, safe behavior while unresolved and evidence required to close. Distinguish “ready to implement,” “policy/authority blocked” and “external acceptance required.” Give dependencies and parallelizable work, not fabricated dates or completion percentages.

Update the strategy, relevant project-memory entry and `docs/superpowers/specs/RESUME-remaining-phases-design.md` with **design status**, preserving implementation/production status accurately. Follow repository rules for the canonical memory location. Record agent ownership and review outcomes in the README; no opaque agent state is a substitute for files.

## Completion gate and report

Finish every phase's design, integrate shared contracts and resolve review findings that can be resolved from evidence. Verify links, source anchors, route consistency, permissions, cross-phase totals/state semantics and prototype journeys. Report exact checks actually performed; do not claim runtime tests or production readiness for designs.

Return a concise summary with links to the design index, representative prototypes, phase plans, unresolved decisions and recommended first implementation slice. Use confidence labels for material claims. Stop after the full design/planning package; do not implement, commit, deploy, activate markets or perform real transactions.
