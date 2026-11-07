# Customer shipment progress

GET `/api/customer-shipments/:id` uses existing `protect` customer JWT authority and saved `Order.user`. Tenant staff, platform staff, guests and order-number/email details do not authorize this read. Parent ownership is queried together. Original direct integration checkouts and nonmarketplace channel snapshots are rejected404; current tenant/market preferences grant no access. An own legacy marketplace order returns `managed:false,groups:[]`; history is never backfilled.

Parent, child quantities and evidence are read sequentially within one read-only Mongo snapshot transaction. This avoids mixing quantities from before a dispatch with evidence saved after it. The database must support transactions, as existing managed fulfillment already requires. No goods, payment, stock or actor audit mutations occur here.

The projection is independent of operational DTOs. Every child line must match the parent's saved line/product/offer/size/tenant/location and original quantity; every allocation/booking/pickup matches saved child/order/tenant/location. Refunds additionally match the saved customer. Unknown lifecycle values become `awaiting_update`; no stored nested object passes through. Only merchant/product display names, bought quantities, recorded shipment/group states and safe refund amounts/progress leave the service. Operational actors, rider PII, private note/reason/evidence, unit ranges, batch/cost/share/provider/account/ledger data stay private.

V1 uses explicit whole-child state, with no invented historical split shipment. V2 uses saved quantity progress and immutable allocation quantities. Pre-dispatch local bookings expose their exact saved quantities. Pickup lifecycle uses child state because its booking stays permanently `booked`; V2 delivered pickup quantities exclude cancelled units. These are merchant/team observations, not external carrier or GPS verification. Failed local delivery remains explicitly failed.

An allocation with an immutable dispatchBooking marker remains local delivery when its matching booking evidence is missing or fails ownership checks. Its shipment status becomes awaiting_update; an allocation state alone cannot substitute for the missing local booking evidence.

External carrier responsibilities join only the same original parent/child/tenant/location/allocation inside that read snapshot. Private account/provider IDs, rates, raw callbacks/contacts/URLs never leave this DTO. A completed provider observation is labelled carrier_reported_delivered and does not change the merchant's shipped/delivered quantities; cancellation is carrier_cancelled, not a goods cancellation/refund. Submitting/uncertain financial responsibility stays awaiting_update. Local return intent and operator-confirmed quarantined receipt remain distinct labels; no private recovery reasons or rider evidence are exposed.

Platform account detail and the existing tracking page use `components/Orders/ShipmentProgress`. Responses bind to order+user+session; old requests abort and late responses are discarded. Pages remount on cookie-session user changes. Legacy details remain available independently of the managed shipment panel.

Verification and scope: `docs/superpowers/plans/global-phases/phase-d-customer-tracking.md`.
