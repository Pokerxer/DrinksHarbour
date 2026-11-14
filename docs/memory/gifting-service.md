# DrinksHarbour gifting service proposal

2026-11-14. Advisory work. Proposed scope is personal beverage gifts delivered in Abuja. Launch assortment, prices, and delivery capacity are open decisions.

## Customer offer

Draft headline: Send a drinks gift in Abuja.

Draft supporting copy: Choose a gift, add a personal message, and we’ll deliver it to their door.

Use **Send a gift** in the main navigation and on the homepage. Lead with three examples of ready-to-send formats: a sparkling wine celebration box, a whisky thank-you box, and an alcohol-free gift box. Show the contents, finished packaging, and price up front. Show delivery availability and the total before payment. Keep an assisted option for custom hampers and corporate orders.

## Reuse and launch checks

- Rework the front of `/occasions/gifting` into a shopping entry point and retain its planning tools for buyers who need them. Reuse the existing gift checkout and admin gift order details.
- Price the finished gift after packaging, handling, delivery and any marketplace payout. Start with one fulfillment location per gift and verify the packaging SKU is available in production.
- Place an end-to-end gift order through each launch delivery option. Verify recipient address and contact, message and packaging handoff, receipt visibility, delivery confirmation for the sender, and the workflow for an unreachable recipient. Apply the existing age check for alcoholic gifts.
- The checkout date is a request today. Confirm delivery windows operationally before advertising a scheduled or same-day service.
- Launch with the homepage and product pages as discovery points. Track paid gift orders, on-time handovers and contribution per order before expanding the assortment or delivery area.

Implementation evidence is in the [gift checkout notes](gift-checkout.md) and the [occasion preparation notes](../../client/apps/platform/src/components/Occasions/README.md). Production checkout and fulfillment were outside this advisory review.

## Storefront implementation

- The canonical `/occasions/gifting` now leads with shopping and Abuja delivery, with links from desktop and mobile navigation, the marketplace homepage and Abuja delivery. The personal-gift, hamper and corporate intents keep their existing URLs. Local metadata, an editorial share image, collection and breadcrumb markup, and the sitemap entry support discovery.
- The page selects up to one sellable single-bottle offer from champagne, whisky and non-alcoholic catalog categories. It uses the offer ID, size ID and marketplace price and keeps category links visible if the catalog is unavailable. The editorial photograph illustrates gifting. Finished packages require actual product photos.
- Marketplace bottle pages reuse the gift-cart handoff. Checkout collects the recipient phone under `order.gift` and uses the address supplied at checkout. The platform gift panel and authorised merchant fulfillment show the recipient contact. The shipping contact snapshot still serves buyer notifications. Buyer-facing order data exposes the gift flag for the `is_gift` parameter on the paid purchase event.
- Before launch, publish and verify the packaging SKU and its sellable variant and warehouse stock. Confirm responsibility for packaging, including what happens when multiple sellers are in the cart. Test a paid production gift from order through handover and verify sender confirmation and receipt handling. Exact pilot box contents, photographs and prices remain operational inputs.
- After deployment, inspect the canonical URL in Search Console and check sitemap discovery. Track Abuja gifting query impressions and clicks against paid gift orders. Register `is_gift` as a GA4 event-scoped dimension if it is needed in GA4 reports.
