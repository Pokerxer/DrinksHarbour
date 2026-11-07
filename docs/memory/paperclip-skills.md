# DrinksHarbour skills in Paperclip

Engine note (2026-11-05): all agents run the OpenCode v2 bridge on
`opencode-go/glm-5.3-flash`; see `paperclip-opencode-bridge.md`. The Codex
loopback-profile bullet about the CEO runner below is historical.

The repository keeps the source files in `skills/drinksharbour-issue-delivery/` and
`skills/drinksharbour-tenant-review/`. The DrinksHarbour company library contains
editable Paperclip-managed copies. Paperclip rejected the repository paths as
outside its approved workspace roots. Changes to either copy need to be carried
over explicitly until a workspace import is configured.

Assign the skills alongside the bundled `paperclip` skill to agents that need
them. Issue delivery covers engineering implementation and handoff. Tenant
review covers tenant access, catalog ownership, marketplace pricing, and payout.

The company library also contains managed copies of the installed
`ui-ux-pro-max`, `frontend-design`, and `nodejs-backend-patterns` packages.
UI/UX Pro Max includes its runtime search scripts and data, with script paths
relative to the installed skill folder. The backend package includes both
reference files. The custom `software-engineering` source lives in
`skills/software-engineering/SKILL.md`.

The `junie` skill is a custom JetBrains Junie workflow guide maintained in
`skills/junie/SKILL.md`. The managed copy lives in the company library.
Junie CLI availability and agent assignment must be verified separately.

The Paperclip roster now has dedicated frontend, backend, software engineering,
and Junie workflow agents. Their identifiers and skill assignments are recorded
in `docs/superpowers/specs/RESUME-paperclip-skills.md`.

Growth roles use managed copies of the installed `seo` and ECC
`marketing-campaign` skills. The campaign copy uses direct research and brand
guidance when companion tools are unavailable. The SEO Specialist uses the
existing SEO priorities and evidence. The Marketing Specialist uses the platform
brief and drafts campaign assets within the scope of each issue.

The DrinksHarbour CEO owns the platform goal and leads the platform project.
The seven engineering and growth specialists report directly to the CEO.
Company skills remain assigned by role. The CEO uses task planning, acceptance
review, and software engineering to coordinate delivery.

DRI-2 is the CEO's cross-business implementation assignment. Its scope and
verification requirements are in
`docs/superpowers/specs/RESUME-paperclip-business-expansion.md`. DRI-1 tracks
the separate business-specific variant work already in review.

DRI-2 showed that the CEO's ACP environment check did not establish model
access. ACP rejected both tested models. The CEO now uses the Variant
Engineer's local Codex CLI settings, and a DRI-2 retry started on that path.

The next DRI-2 retry reached the local workspace and resumed implementation.
It verified the existing five business registrations and applied an ERM picker
slice for exact variant selection. The Paperclip loopback API remained
unreachable from the runner. See the DRI-2 resume spec for verification and the
remaining acceptance work.

DRI-2 local checks passed 243 admin tests, 107 focused backend tests, and
5 storefront gallery tests. The broad backend run reported 4,463 passing,
250 failing and 259 skipped, with loopback listener failures. Authenticated
browser and disposable MongoDB journeys remain open.

The DRI-2 retry after the workspace routing timeout reached the repository and
passed 70 focused backend checks. Loopback bind still returned EPERM and the
Paperclip health probe refused the connection. Use the acceptance checklist in
the DRI-2 resume spec on a runner that can host isolated fixtures and reach the
control plane; retain the existing CEO assignment.

The CEO uses the persistent `drinksharbour-ceo-loopback` Codex profile.
It keeps workspace file restrictions and allows loopback through the Codex
network proxy. The Paperclip API health request returned 200 from a live
DRI-2 run. See the DRI-2 handoff for usage and verification limits.

A scoped operator run for DRI-2 can host disposable local databases even when
the CEO runner cannot bind sockets. On 2026-11-05, 28 MongoDB and HTTP checks
and a retail variant migration rehearsal passed through that route. The
manual sales-order index failure and browser/till gaps are in the DRI-2 resume
spec and the Paperclip operator acceptance document.

The sales-order index repair is verified locally. DRI-2's operator evidence
revision 2 records 11/11 fresh model, bridge, and MongoDB integration passes.
The live index replacement and browser/till acceptance remain open.

DRI-2 now depends on DRI-3 (Frontend Engineer, browser acceptance) and DRI-4
(Backend Engineer, POS/till acceptance). Both have a required CEO review
stage, with the CEO retaining ownership of DRI-2.
