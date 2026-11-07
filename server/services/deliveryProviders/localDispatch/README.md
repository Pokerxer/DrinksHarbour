# Reviewed local rider dispatch

This adapter uses the existing Delivery/Driver engine and canonical version2
merchant quantity commands. MerchantDispatchBooking is service responsibility;
MerchantShipmentAllocation is immutable goods ownership; Delivery is the rider
trip. Existing version1 pickup MerchantShipment records/index are preserved.

Creation is off unless MERCHANT_LOCAL_DISPATCH_ENABLED=true AND the own location
has a current explicit platform-reviewed contract. No contracts are seeded.
Quote freezes selected lines, original customer/destination, child version,
requirements/packaging/weight, reviewed coverage/rate and expiry. Unknown transport
facts, unsupported coverage/capabilities or exhausted original shipping budget
fail closed. Existing zone/distance rates are not asserted as provider quotes.

Book reserves only saved child.shippingMinor in MerchantDispatchBudget; no new
charge/receipt/payout occurs. Draft cancellation releases only that reservation.
Dispatch commits it and calls shipQuantities in the same transaction as trip,
rider claim and immutable allocation link. Resolve delivered calls the same
canonical deliverAllocation command without consuming stock again. Failed drops
leave goods shipped. Only one stop per managed trip is implemented.

Shared driverClaim is acquired before legacy goods effects. A managed trip
requires no active legacy trip/claim and locks the rider transactionally. Legacy
claims persist after partial/uncertain errors for exact-trip retry; another
workflow cannot take the rider. Completion/cancel releases only its own claim.
Legacy trips/queues/DTOs remain in their original endpoints; managed trips are
excluded from populated parent views and cannot call whole-parent lifecycle.

Operational DTOs explicitly filter nested lines/events/proof. Option lists show
only reviewed terms, own eligible rider names/type/capacity and own bookings.
Staff mutation, version/key replay and platform audit use verified JWT authority.
Tracking is operator-recorded lifecycle evidence, not GPS/carrier confirmation.

No automatic failed-drop retry/reassignment, new fare, COD, payout/shipping refund,
external carrier, parcel/food, legal/capability certification or real dispatch is
provided. Platform reviewers manage explicit immutable terms in the admin
`/delivery-settings` workspace; configuration reads and mutation responses use
allowlisted DTOs and private/no-store transport. Terms begin blank, history
separates current and superseded versions, and uncertain review writes retain
their exact version for explicit refresh/reconciliation. Read authority matches
platform settings:write review authority. Repeated revocation preserves original
attribution/time; current terms never rewrite accepted bookings. See
`docs/superpowers/plans/global-phases/phase-d-local-dispatch.md` for actual evidence
and limits; root owns final full checks and build.

Managed goods allocations carry immutable dispatchBooking identity. Public manual
quantity delivery cannot close a rider-managed leg; operators must resolve the
saved local booking so trip, allocation and driver update together. The quantity
DTO exposes only a safe deliveryManaged flag. Earlier records recover only from
explicit saved booking+trip-stop allocation links, without metadata backfill or a
second delivered/stock effect. See the2026-10-27 evidence addendum.

Configuration workspace evidence: `docs/superpowers/plans/global-phases/phase-d-delivery-settings.md`. Coverage country formatting remains exact (Nigeria versus NG); reviewers explicitly select the supported frozen-address representation. No rate or approval is seeded.

Explicit failed-drop recovery is now available on the protected booking recover
endpoint: versioned/keyed `reattempt`, `return`, and `receive_return`. A retry
creates a fresh Delivery with the saved destination, original allocation and
frozen quote requirements; immutable booking.delivery and the original failed
trip remain historical facts. activeDelivery selects the current rider stop.
Eight retries maximum reserve room for return request/receipt within the ten
recovery action bound. The exact own rider claim, allocation and child serialize
in one Mongo transaction; original goods shipment and shipping budget never run
again. Old resolution key replay cannot resolve a new attempt. Orphan old-trip
claims and foreign/current unit financial blocks fail closed for retries.

Return request proves intent only. Physical receipt is an immutable
MerchantDeliveryReturn bound to the exact original allocation/unit ranges and
original active location. Receipt is quarantine evidence, never sellable stock,
COGS reversal, refund or payout approval. Refunded goods may still be received;
money and physical goods evidence remain independently authoritative. Restocking,
disposal and return-shipping/refund policy require separate reviewed engineering.
See the failed-delivery recovery plan for RED/GREEN evidence and current limits.
