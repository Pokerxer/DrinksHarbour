# Merchant pickup delivery contract

This directory's root adapter implements local pickup. Quote reads the saved MerchantOrder and parent
Order; browser tenant, location, customer, pricing and basket fields are ignored.
Saved parent pickup method and zero child shipping allocation are mandatory.
Quote freezes own customer, tenant/location, destination hash and basket hash,
NGN0, origin-only coverage and collection capability for15 minutes.

Booking requires accepted/picking child state and a stable idempotency key.
A Mongo transaction validates scope and expiry, serializes against child actions,
consumes the quote, and creates one deterministic shipment per child. Exact replay
returns that shipment; another operation conflicts. No stock or fulfillment command
runs. Merchant fulfillment actions remain the only lifecycle authority.

Shipment is separate from Delivery rider trips. Tracking refresh records the
current saved merchant-order state/version; identical observations deduplicate.
`source: merchant_order` supplies no carrier confirmation, pickup proof, customer
age check, geographic dispatch coverage, insurance or alcohol/fragile approval.
There are no external callbacks. No provider/carrier network calls are present.
External parcel/food/courier and local_dispatch fail explicitly in this pickup-only adapter. Separate protected routers retain their own reviewed responsibilities: `localDispatch/` uses existing rider/trip authority; `external/` implements a default-off reviewed Shipbubble parcel candidate on original manual-shipped V2 allocations. They do not convert pickup records or take over its stock/money lifecycle. See those READMEs for actual scope and certification limits.

The protected router uses existing JWT staff authority and merchant permissions,
returns private/no-store responses, and requires root mounting under
`/api/merchant-delivery`. Existing children remain operable when the parent creation
flag is disabled. Historical orders cannot create quotes without a MerchantOrder.

Quote `createdBy`, shipment `bookedBy` and event `recordedBy` preserve the verified
acting user; quote and booking also store explicit action names. Platform reads,
quotes, bookings/replays and tracking use shared `access.audit`; booking audit joins
the booking transaction. Exact replay retains the original booking actor. The first
tracking observation retains its original actor when the same version is retried.
