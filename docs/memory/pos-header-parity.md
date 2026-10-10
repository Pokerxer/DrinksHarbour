---
name: pos-header-parity
description: POS header follows the sub-products mobile Menu pattern and keeps shop controls in a compact top row.
type: convention
---

# POS header matches sub-products

`point-of-sale/pos-nav-header.tsx` follows `ecommerce/ecommerce-nav-header.tsx`:
brand + shared `warehouses/mobile-nav-menu` below md, tabs from md, and shared
`nav-dropdown-panel` for desktop groups. Mobile Escape, outside-click, and route
change close the navigation. POS routes are in `pos-nav-items.tsx`.

POS adds a shop selector. Keep the mobile shop name truncated and hide the
cashier/manager badge until lg, so the mobile top row stays 47px high at 320px.
At md the tabs get a full-width second row; at xl they join the top row.
The shop popup anchors to the header on mobile so a long shop name cannot push
it off-screen. Shop creation remains in `components/pos-new-shop-modal.tsx`.

`node scripts/pos-header-layout-audit.cjs` checks actual interactive components
with isolated auth/API fixtures. No credentials or backend mutations are used.
See `docs/superpowers/specs/RESUME-pos-header-parity.md` for verification results.
