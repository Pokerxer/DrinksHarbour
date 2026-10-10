# Restock recommendations

The existing RestockPage also composes /notifications/vendor-orders. Purchases
remain editable reviewed drafts. Server recommendations use the exact tenant
SubProduct/Size/receiving-location and current vendor pricelist terms.

`restock-results.tsx` owns scoped rows, local supplier/quantity edits and complete
order groups. `restock-rules.ts` filters and sorts the chosen supplier and edited
quantity. Ready orders, review quantities/transfers, covered and excluded products
remain distinct. Filters preserve hidden selections and an invalid hidden quantity
blocks preparation with an explicit page warning. Currency/destination groups
never merge. Refresh/scope changes remount local selection state.

`restock-line.tsx` keeps supplier comparison and reviewed quantity inputs; reset
uses that supplier's recommendation, zero excludes a product. Manual-review offers
have no automatic reset. `restock-recommendation.tsx` shows dated quantity evidence,
pre-delivery shortages, pending transfer guidance and exact warehouse/forecast links.
Unknown histories and balances retain a reason, not invented demand. Stock/report
flags hide unauthorized facts, evidence, links and automatic quantities. Supplier
terms remain available for authorized manual buying; the server rechecks them on save.

Backend projections: server/services/restock/{replenishment,supplier-plan}.js.
See docs/superpowers/specs/RESUME-restock-functionality.md for rules and verification.

## Compact cards and detail modal

`RestockProductCard` shows the shared image/fallback, identity/location, review
state, selected order units and permission-aware availability. It is a native
button with dialog semantics and no nested links or form controls. Full supplier
terms, prices, quantity controls and evidence are in `RestockProductModal`, using
the shared focus-trapped, named Modal with Escape/backdrop/close and return focus.
`RestockLine` provides the full editor; embedded mode avoids repeating identity.

`RestockProductGrid` resolves its selection from all current scoped rows while
cards use the filtered/paged rows. An edit can therefore exclude a card from the
active filter while keeping the modal editor open. Selections stay in results,
so closing/reopening does not discard quantities or supplier choice. Filter/sort/
page changes remount the grid to close details while retaining edits. Plan/scope
refresh remounts results as before; removed products clear the modal selection.
The shared vendor-orders route also uses these compact cards and full editor.

The grid reset key uses the requested page, not the clamped visible page. A
quantity edit can empty the final filtered page and clamp pagination without
closing the editor. Explicit page/filter/sort navigation still closes details.

## Detail figures and supplier controls

restock-supplier-controls.tsx owns the full-width supplier selector, complete
supplier name/price/pack/MOQ/maximum terms and validated quantity field. Clearing
the supplier clears order selection; changing it uses that offer's suggestion.
Pack buttons start at the first pack multiple meeting MOQ, respect the maximum,
and return to zero below MOQ. Blank/invalid quantities never show a valid total.

The detail projection uses the reviewed quantity for ending balance and units
above requirement; forecast requirement remains a separate server figure. Missing
forecast evidence is explicitly unavailable with its reason, not beyond horizon.
Known stock/commitment, reserve and eligible arrival facts survive unsupported
forecasts. Negative/missing stock, missing history and unresolved transfers keep
manual review; none generate demand or perform a purchase. Posted transfer
consumption is shown separately from customer sales. Permission gates remain.

## Order unit calculations

Server recommendations exclude missed pre-delivery forecast sales from the later
purchase while retaining real outstanding outbound commitments. The detail modal
shows full-horizon and post-delivery demand, the separate early shortage, required
units before packs and rounded/reviewed order quantities. A valid smaller order
shows its unmet requirement. A zero later order with an earlier shortage is review
work, labelled Earlier supply needed, rather than Covered by supply. Missing
forecast evidence stays unavailable. Pack/MOQ/max validation is unchanged.
