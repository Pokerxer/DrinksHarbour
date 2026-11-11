# Products single navigation header

The admin products layout already rendered ProductsNavGate, while all five
product pages also rendered EcommercePageHeader. This produced the Products
and Marketplace navigation bars shown in the user screenshot.

Removed the page-level header from list, pending, create, detail and edit.
ProductsNavGate retains the shared role/plan-aware tabs. The regression
renders each actual page inside ProductsLayout with data-heavy content
stubbed. All five checks reproduced two app launchers before the fix and one
after it. Focused layout/navigation tests passed 10/10.

See the final verification record in
`docs/superpowers/specs/RESUME-products-single-header.md`.
