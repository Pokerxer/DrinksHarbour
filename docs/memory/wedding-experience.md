---
name: Wedding experience
type: project
date: 2026-10-20
---

/occasions/weddings now has custom components/Weddings presentation instead of
the generic CommercialGuide. White/Fraunces hero, burgundy reception place card,
five optional drink interests, wedding brief, original guidance, FAQs/help.

Only weddings gets custom dispatch. Metadata, other occasions and unknown 404
remain intact. Interests are typed/optional; labels enter the explicit WhatsApp
draft. No default quantities, packages, pricing, stock or service promises.
Shared OccasionPlanner accepts optional fixedOccasion/details/title/onClear;
existing hub defaults remain. Details edits invalidate drafts; clear also resets
interests while keeping Weddings. Prepare performs no request or analytics.

198 platform tests, scoped lint, final build and sequential type check pass.
Actual components + built CSS reviewed at desktop/mobile widths; no horizontal
overflow at 1280/390/320px. Mobile root shrinks to 14px; explicit text-[16px]
now keeps shared brief fields at 16px (computed browser check). Preview closed.
No backend change, dependency install, commit, push, deployment or message.
Resume: docs/superpowers/specs/RESUME-wedding-experience.md.

Bottle-list continuation adds catalogue/custom entries, quantities, sizes/units,
download and validated enquiry transfer. See docs/memory/wedding-bottle-list.md.

## 2026-11-14 wedding storefront

The canonical `/occasions/weddings` leads with Abuja wedding drinks, a reception
hero, category shopping and a separate brief action. The marketplace home,
desktop and mobile navigation, city delivery guides and bulk drinks link to it.
The original brief, bottle list, quantities, delivery guidance and both
subpages remain accessible. The public catalogue supplies up to three real
single-unit examples and their prices. Categories and planning remain usable
when catalogue requests fail. Bulk quantities and the venue handover window
are confirmed through the existing staff enquiry workflow.

Search metadata and social imagery match the page. The collection and
breadcrumb data describe the visible page and its shopping links. The existing
sitemap route carries the update date. After deployment, verify the canonical
in Search Console and measure wedding enquiries alongside relevant search
clicks. Production delivery and indexing require post-deployment verification.
