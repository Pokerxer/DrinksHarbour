---
date: 2026-10-20
owner: analytics / commercial
status: event instrumentation implemented locally; live validation pending
---

# Measurement procedure

Read baseline.md before comparing dates. SiteGuru is GSC-connected but reports
GA4 not connected. This does not prove the existing Google tag collects no data.
An account owner must verify property access and connect the intended GA4
property to SiteGuru. Do not create another property or duplicate tag blindly.

## Event meanings

| Event | Trigger | Interpretation |
| --- | --- | --- |
| purchase | Loaded server order has paymentStatus=paid, is not cancelled/refunded and has valid merchandise snapshots | Paid purchase reported from confirmation page; not all server sales |
| generate_lead | Contact API returns success | Accepted contact message; includes service/support enquiries, not necessarily a sales-qualified lead |
| commercial_enquiry_click | Visitor activates a bulk/occasion WhatsApp enquiry link | Contact intent only; cannot prove a message was sent |
| add_to_cart / begin_checkout / view_item | Existing storefront commerce tracking | Funnel context, subject to consent and event receipt |

purchase.transaction_id is the server orderNumber; retain it across reloads for
GA4 deduplication. Merchandise value is subtotal minus merchandise discount;
shipping and tax are separate parameters. Current server discount allocations
inform net item prices; legacy unallocated discounts are apportioned only for
analytics. This changes reporting, never the order, payout or checkout totals.
Do not mix the new merchandise-value series with historical shipping-inclusive
purchase values without annotating the release.

No email, phone, address, order message or WhatsApp message text is added to new
lead/intention events. The contact subject is restricted to known categories.
The existing consent mode controls tag storage/identity. Do not add tracking
identifiers to the WhatsApp message or customer form to infer attribution.

## Validate on the released site

1. Confirm the intended measurement ID in deployment settings; use GA4 DebugView
   or Tag Assistant with test traffic excluded from business reports.
2. Test a successful contact submission and a validation/server failure. Only
   the accepted submission should generate a lead. Test this with a designated
   test message/account; do not spam the production support channel.
3. Test an occasion enquiry link: it must open a WhatsApp draft and emit only
   enquiry_type and contact_method, not the draft text or customer details.
4. Inspect pending/failed and paid orders in an authorised test environment.
   Pending/failed orders must not generate purchase. Check discounted items,
   shipping, tax, currency and transaction ID. Reload the same confirmation
   page and verify GA4 deduplication by transaction ID.
5. Verify granted/denied consent behavior and SPA navigation; tags being present
   does not prove consent updates or events were received by the correct property.
6. Mark purchase and, if useful, accepted contact leads as GA4 key events.
   Do not treat a WhatsApp click as a completed lead/order. Register the new
   enquiry_type/contact_method/contact_subject parameters if custom reporting
   needs them. Separate support messages from sales qualification in CRM follow-up.
7. Reconcile sampled paid backend orders against analytics. Browser-only tracking
   misses customers who never return to confirmation or block scripts. Consider
   a separately designed, consent-aware server event integration if completeness
   is required; do not claim this patch provides full revenue reconciliation.

[Google's purchase event reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events#purchase)
defines merchandise value and transaction-ID deduplication.

## Weekly scorecard

Use Organic Search session attribution for purchases/leads. Keep currency
separate and distinguish GSC clicks from GA4 sessions. Compare like periods,
annotating stock outages, promotions and holiday seasonality.

| Period / release note | GSC non-brand clicks | Impressions | CTR | Organic sessions | Paid purchases | Merchandise value (NGN) | Purchase session rate | Sales-qualified leads |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pre-release provider period: see baseline.md | Not segmented | 21,831 all-query | 1.38% all-query | Unavailable | Unavailable | Unavailable | Unavailable | Unavailable |
| Release date: pending | — | — | — | — | — | — | — | — |
| First complete 28 days after release | — | — | — | — | — | — | — | — |
| Next complete 28 days | — | — | — | — | — | — | — | — |

Purchase session rate = organic sessions with a paid purchase / organic sessions.
Record total order counts separately. Quote-to-order rate needs qualified lead
and eventual order records; it cannot be derived from WhatsApp clicks alone.

Track fixed queries for buy drinks/wine/whisky online Nigeria, alcohol delivery
Abuja, bulk drinks Nigeria and stocked brand + Nigeria combinations. Record
DrinksHarbour and Drinks.ng in the same Nigeria/mobile rank tracker, with Abuja
and Lagos local checks separate. GSC is our-site data, not competitor data.
Capture current referring domains using a dated provider export; do not reuse
September's stale authority metric as a growth result.

At day 30 validate data/indexing; day 60 assess category/hub demand; day 90
prioritize pages that produce relevant traffic and orders. No numerical ranking
or revenue uplift is promised by this implementation.
