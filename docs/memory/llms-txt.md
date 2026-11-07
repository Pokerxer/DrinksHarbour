---
name: Public llms.txt
description: Marketplace AI discovery file, location, scope and rollout checks.
type: project
---

The marketplace overview lives in `client/apps/platform/public/llms.txt` and is
served at `/llms.txt`. Edit this plain file when public navigation changes.
Use canonical www URLs and public content only; current product pages determine
prices, stock and seller availability. The overview is marketplace-wide, including
when retrieved on a tenant hostname. It is not a tenant inventory feed.

The overview also routes readers to Abuja/FCT and Lagos delivery information,
support, public business plans/onboarding and venues. Bottle sizes and seller
offers must be compared explicitly. The age statement describes published policy,
not verified enforcement. Avoid copying mutable fees, price lists or guarantees.
The FAQ currently contains outdated payment-provider copy; do not propagate it.

Deployment and a fresh production retrieval are required before claiming the
audit warning is resolved. See
`docs/superpowers/specs/RESUME-llms-txt.md` for verification and handoff.
