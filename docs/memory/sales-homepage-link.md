# Sales homepage link

The tenant homepage **Quotations & Orders** launcher card opens `/sales`, the
sales overview. Keep quotation and order pages as secondary links on the card.

The card must have `href: routes.eCommerce.sales`; using `href: '#'` invokes
the generic launcher fallback and sends users to the first child route instead.

Regression coverage lives in
`client/apps/admin/src/layouts/hydrogen/tenant-menu-items.test.ts`.
