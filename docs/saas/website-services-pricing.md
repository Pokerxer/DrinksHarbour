# DrinksHarbour Technologies website services

Status: investor-document service offer. User specified a starting build price of NGN 500,000; NGN 35,000 monthly management remains the proposed tariff. No website advertising or automatic billing has been configured for these services.

## Purpose

Offer tenants a personal branded website on their own domain, with DrinksHarbour as the admin system, backend and database. Tenant stock, prices, products and orders remain managed within the tenant's existing DrinksHarbour account. The existing included DrinksHarbour storefront remains part of the platform subscription; bespoke website work is optional and separately priced.

## Proposed prices and scope

| Service | Proposed charge | Included scope |
| --- | --- | --- |
| Custom website design and integration | From NGN 500,000 once | One tenant website, up to five content pages plus standard catalogue/product/cart/checkout views, responsive design, connection to existing tenant storefront APIs, two consolidated design revision rounds and launch handover. Final scope and price confirmed by written quote. |
| Website management | NGN 35,000 per month | Routine frontend updates, website availability checks, integration health checks and up to two hours of minor content/design changes monthly. Unused hours do not roll over. Additional work quoted before execution. |

Domain registration/renewal, frontend hosting, third-party subscriptions, taxes where applicable, advertising, copywriting, photography, new integrations, redesigns and major features are separately quoted. Management concerns the tenant's website; it does not include operating the tenant's business or unlimited catalogue entry. No response-time or uptime guarantee is implied without an agreed service level.

The tenant's DrinksHarbour platform subscription remains additional. Standard integrated sites require a plan with API access: currently Pro at NGN 65,000/month or a higher qualifying plan. A Pro tenant with website management would therefore pay NGN 100,000/month before separately quoted costs; design starts at NGN 500,000 once. Existing platform transaction/commission terms still apply as agreed; custom website orders must not be described as commission-free without reviewing their actual settlement configuration.

## Documentation scope

The user clarified that this offer belongs in `docs/legal/investors/DrinksHarbour Revenue and Profit Explained.docx`, not in the website footer or public website. Section 7 of the report explains the service, separate fees and illustrative contribution after delivery costs. The main financial scenarios exclude this additional stream until sales volumes and actual costs are available.

The short-lived footer, service page and registration pricing additions were removed. No automatic charge, Paystack service subscription or new entitlement was created.

## Research and evidence

Project evidence: `server/config/erm-plans.js` and `server/routes/storefrontIntegration.routes.js`. APIs exist in code; delivery must verify credentials, entitlements and integration on each tenant website.

Pricing is a proposed commercial decision, not a measured market average or guaranteed margin. Nigerian providers reviewed on 7 October 2026 advertise website-only builds around NGN 280,000 and website care from NGN 25,000–35,000/month. Their services differ from this integration offer:

- https://creativesolutionsng.com/pricing
- https://musskart.com/website-care-plan-nigeria.html
- https://joriontech.com/website-maintenance/

Profit should be measured separately: build fee less design/development/launch delivery costs; management revenue less allocated maintenance labour, monitoring and support costs. Do not add gross service fees directly to net profit scenarios.
