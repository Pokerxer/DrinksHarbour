# Product restock enquiries on WhatsApp — 2026-10-12

Product/Detail/OrderWhatsAppButton switches to "Ask about availability on
WhatsApp" for outOfStock=true. ProductDetail uses the selected size's shared
stock predicate, or checks for no buyable vendor sizes if none is selected.
The enquiry remains clickable while Add to Cart stays disabled. In-stock offers
keep their existing order CTA and details.

Uses configured NEXT_PUBLIC_WHATSAPP_PHONE (existing support fallback). Prefills
product, optional size/seller, public product link and a restock question; no
order total or availability promise. Browser origin preserves tenant page URLs;
queries/account details are excluded. Customers submit the message themselves.

Four focused tests, scoped lint and whitespace checks passed. Full suite:
105 passed, 2 current-location timeout/retry test failures unrelated to this
change. Local catalogue has no sold-out offers, so that state was verified with
render fixtures. In-stock Ceres page inspected in browser. No deployment or
production record changes. See ../superpowers/specs/RESUME-product-whatsapp-restock.md.
