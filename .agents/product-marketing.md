# Product Marketing Context — DrinksHarbour

> Context doc for AI marketing skills (seo-audit, ai-seo, copywriting, ads,
> content-strategy, marketing-plan, …). Read this before running any marketing
> task; only ask for information it does not cover. Keep it current.

Source of truth: `AGENTS.md`, `server/config/erm-plans.js`,
`client/apps/platform/public/llms.txt`. Last updated: 2026-11-10.

## Product

DrinksHarbour (https://www.drinksharbour.com) is an online premium-beverage
marketplace for Nigeria, headquartered in Abuja. Customers buy wines, whisky
and other spirits, beers, champagne, soft and non-alcoholic drinks from
locally approved beverage businesses, delivered in Abuja/FCT and nationwide
(dedicated delivery pages for Abuja and Lagos). Age verification (18+) applies
to alcohol delivery. Prices are in Nigerian Naira (₦).

It is also a multi-tenant SaaS: beverage businesses subscribe to branded
storefronts and inventory/order/POS tools (see
`client/apps/platform/public/pricing.md` served as `/pricing.md` — Starter ₦15k, Growth ₦35k, Pro ₦65k, Enterprise ₦85k,
Venue ₦150k per month, ~13% down to 9% marketplace commission by tier, 14-day
free trial). In marketing language these subscribers are called "vendors"
(they appear publicly at /vendors); internally the codebase models them as
"tenants". The bars/clubs vertical under Venue is "Clubs & Lounges";
venue discovery is public at /venues.

## Who we're talking to (audiences)

1. **Drink buyers (primary, ads + SEO):** individuals aged 18+ in Abuja and
   Lagos — party hosts, gifting buyers, home bars; plus corporate/office
   gifting. Language: "buy drinks online Nigeria / Abuja shop drinks near me",
   "wine delivery Lagos", "where to buy whiskey in Abuja".
2. **Beverage businesses (B2B, lifecycle + /vendors/register):** independent
   liquor/beverage shops, bars, clubs and distributors in Abuja (first) then
   other states. Their jobs: sell online without building a website, manage
   stock/POS in one place, get discovered by local buyers.

## Positioning

- One sentence: "Nigeria's online marketplace for premium beverages — the
  operating system for the country's premium drinks industry."
- Differentiators: locally approved/independent businesses (not a single
  import monopoly); single shared catalogue with transparent per-seller
  prices; same-day FCT delivery outlook with nationwide shipping from Abuja;
  written authenticity guarantee; age-verified delivery.
- Primary competitors in Nigeria: local liquor retail chains with delivery
  (e.g., shops in Abuja/Lagos), general marketplaces selling drinks, and
  vendor-side tools like generic POS/importers. No dominant pure marketplace.

## Brand voice

- Warm, premium-but-approachable; trade English; Nigerian context first
  (naira prices, Abuja/Lagos, naija occasions — weddings, owambe, corporate
  end-of-year gifts).
- No gimmicks, no hard-sell countdowns; avoid the banned AI tells ("it's not
  X, it's Y", triadic "no X, no Y, no Z" lists). Keep claims supportable;
  measurable ones come from `docs/` and platform data, never invented.
- Grammar: British/Nigerian spelling where it matters, sentence-case in body
  copy, title case only for page titles.

## Key marketing surfaces (live)

- `/` `/shop` `/catalogue` — marketplace + category filter pages (`?category=…`)
- `/brands` `/categories` `/deals` `/occasions/**` — discovery surfaces
- `/delivery/abuja` `/delivery/lagos` `/shipping-info` — local intent pages
- `/vendors` `/vendors/register` — B2B funnel
- `/blog` — beverage guides/articles
- `/venues` — venue discovery section (Clubs & Lounges vertical)

## Constraints & guardrails

- **Never invent data**: stock, tenant counts, delivery windows, reviews,
  commission percentages — quote live numbers with a date or mark [verify].
- Images: no AI-fabricated product or lifestyle imagery for purchase surfaces
  unless the brief says so; reuse approved assets (Cloudinary CDN is standard).
- Payments: Paystack (never Stripe) in copy that names a gateway. Age 18+ gate
  copy is mandatory on alcohol-led creatives.
- Markdown "buy codes" and claim attestations live in `docs/` — link, don't
  paraphrase silently.
