---
name: storefront-function-prompts
description: Reusable prompts for building, debugging, and reviewing tenant storefront functionality.
---

# DrinksHarbour storefront prompts

Use these prompts with an implementation agent. Include the relevant route,
component, API response, and reproduction details when available.

## Build or improve a tenant storefront

> Build or improve the DrinksHarbour tenant storefront for `<tenant slug>`.
> Follow the central Product plus tenant-owned SubProduct architecture. Resolve
> the tenant from the approved subdomain/slug, scope every query to that tenant,
> and expose only approved, published, active products. Keep the storefront
> responsive and decomposed into small components. Use Nigerian Naira formatting,
> beverage fields, stock status, tenant branding, and the existing platform
> design system. Add age verification for alcoholic products. Reuse existing
> API services and components where possible. Add meaningful tests and report
> the files changed and validation performed.

## Diagnose a storefront that is empty or missing

> Diagnose why the `<tenant slug>` storefront is empty or unavailable. Trace the
> request from subdomain middleware through tenant resolution, the storefront
> API route, SubProduct filtering, publication/status checks, and the client
> rendering path. Determine whether the issue is tenant approval, slug routing,
> product publication, SubProduct ownership, stock/availability filtering, API
> failure, or frontend state. Reproduce the issue, identify the root cause, then
> make the smallest fix and add a regression test.

## Add or fix storefront product visibility

> Fix storefront product visibility for `<tenant slug>` and `<product>`.
> Verify that the central Product is approved and published, the tenant has a
> matching SubProduct, and the SubProduct belongs to the resolved tenant. Keep
> private fields such as cost price and vendor data out of public responses.
> Preserve products that are published but out of stock when the storefront
> contract allows them, and confirm the exact `isPublished`, `status`, tenant,
> and availability rules with existing services before changing them.

## Add storefront search and filtering

> Add `<search/filter>` to the tenant storefront. Scope results to the resolved
> tenant and the public product contract. Support beverage-relevant fields such
> as beverage type, ABV, origin, flavor notes, volume, price, and availability.
> Keep pagination stable, avoid leaking private SubProduct fields, preserve age
> verification, and add tests for tenant isolation and empty results.

## Add storefront cart and checkout

> Implement or fix storefront cart and checkout for `<tenant slug>`. Use the
> tenant's published SubProducts for pricing and stock, derive tenant ownership
> server-side, and never trust client-supplied tenant IDs or prices. Route orders
> to the owning tenant, apply the configured revenue model, preserve Nigerian
> Naira handling, and verify stock and age-gate requirements before payment.
> Add tests for tampered prices, cross-tenant items, insufficient stock, and
> alcoholic-product age verification.

## Add or fix tenant branding and storefront routing

> Fix tenant storefront routing and branding for `<tenant slug>`. Confirm the
> platform middleware resolves the wildcard subdomain, injects the tenant slug,
> and keeps the main marketplace separate from tenant storefronts. Load the
> tenant's approved public branding fields only, handle unknown/unapproved
> tenants safely, and verify server rendering, navigation, metadata, and
> mobile behavior.

## Review storefront security and quality

> Review the storefront implementation for tenant isolation, public-field
> exposure, authorization boundaries, age verification, price integrity, stock
> races, SEO correctness, accessibility, and error handling. Trace each finding
> to the source of the data and provide a minimal fix with a regression test.
> Confirm that public storefront reads remain available for approved tenants
> while all tenant mutations remain authenticated and tenant-scoped.

## Verify a storefront release

> Verify the storefront change for `<tenant slug>`. Run the relevant server and
> client tests, check the public store endpoint, check an approved product and an
> unpublished product, test an unknown tenant slug, test an alcoholic product's
> age gate, and check that another tenant's products cannot appear. Report any
> environment-dependent checks separately from completed validation.
