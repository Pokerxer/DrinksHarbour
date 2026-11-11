---
name: Nationwide marketplace delivery
description: Published delivery promise, canonical pages, and checkout display boundary
type: project
---

As of 2026-11-11, the DrinksHarbour marketplace serves all 36 Nigerian states and the FCT. The published promise is “Same-day delivery in Abuja. Delivery in 1–2 days (within 48 hours) elsewhere in Nigeria.” Same-day service applies to eligible FCT addresses on orders placed before noon, subject to stock.

Use `client/apps/platform/src/lib/deliveryCopy.ts` for public timing. The canonical nationwide policy is `/shipping-info`; `/delivery/abuja` and `/delivery/lagos` are city guides. Keep the visible FAQ answers, FAQ JSON-LD and public `llms.txt` aligned. The delivery pages and FAQ are in `/sitemap.xml`, advertised by `/robots.txt`. Update sitemap modification dates after significant content changes.

Marketplace checkout shows the published timing by destination after a current quote. Tenant checkout displays the quoted estimate. The shipping API's legacy day ranges still feed the order snapshot and the operations dashboard's late-order calculation. Updating operational SLA reporting requires a decision on when the delivery clock starts and how to measure same-day eligibility. See `server/data/shipping-zones.js` and `server/controllers/delivery.controller.js`.

Brand positioning leads with DrinksHarbour as a Nigerian online beverage marketplace. Nationwide delivery is available today. The seller network is growing across Nigeria, so invitations to apply should describe the expansion without claiming existing seller coverage in every state. Keep Abuja in the origin story, verified business address and local same-day service.
