# Beverage shop and distributor outreach

Audience: prospective beverage shop or distributor. Purpose: invite the business to a short DrinksHarbour demonstration and provide a clear offer to review.

Deliverables are a copy-ready email in `tenant-email.md`, a branded HTML email in `tenant-email.html`, a seven-page PDF in `output/DrinksHarbour Tenant Introduction.pdf`, and the earlier editable presentation in `output/`. No email is sent by this task.

The offer follows current configured platform prices. Custom website design starts at NGN 500,000 once. Management at NGN 35,000/month is a proposed service tariff, subject to a written quote. Domain, hosting and platform subscription are separate. Neither outreach item promises sales, profit or unlimited service work.

Build with the bundled presentation runtime using `build/create-deck.mjs`. Private previews and validation reports stay in `build/`; deliver the final presentation only. Prices checked against `server/config/erm-plans.js` and `docs/saas/website-services-pricing.md` on 8 October 2026. Reconfirm prices and service scope before sending.

The PDF was completed on 9 October 2026. It shows the live shop, product page and Wyn City public tenant example, followed by published inventory and POS screenshots, configured plan prices, and optional website services. The two dashboard pictures are explicitly labelled interface examples. Source URLs and capture dates are recorded in `build/screenshots/brochure-sources.json`; the dashboard originals are in `client/apps/platform/public/erm/screenshots/`. `brochure-content.md` records the page outline.

Rebuild the PDF with `build/create-brochure.py` using the bundled Python runtime at `/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`. ReportLab and local Arial fonts are required. Render with bundled `pdftoppm` and inspect every page after edits. All seven final pages were visually checked; page count, embedded pictures, plan prices and 15 links were verified. PDF size is about 5 MB.
