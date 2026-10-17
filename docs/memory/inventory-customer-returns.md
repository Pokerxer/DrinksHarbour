# Inventory customer returns — 2026-10-14

User approved; implemented and verified. Resume:
docs/superpowers/specs/RESUME-inventory-customer-returns.md.

/inventory/returns combines Sales and POS goods returns, including restock:false.
Read-only tenant-scoped endpoint uses raw Sales counters and persisted POS refund
items; legacy salesReturnedQuantity overlap is subtracted once. Stock evidence
from confirmed customer return movements, never supplier/transfer returns. Missing
or ambiguous evidence/date stays unknown. Do not replay stock or infer cash.

Sales dedicated return writer now suppresses adjustStock generic received mirror:
one stock event, one unified return entry, typed relatedSalesOrder. No historical
repair. Non-restocked goods have no inferred destination; multiple proven locations
remain visible. Location filters select entire cumulative lines involving the site.
Missing older fulfilledQty does not erase persisted returnedQty.

Small UI/hook/service/print builder; shared inventory PDF; refresh/retry and business
request isolation; sidebar/nav/overview links. POS original receipt links select
exact ID/receipt in authorized loaded shop history; existing login/truncation still
apply. No second posting/refund workflow. No invoice snapshot, GL, live stock or
refund mutations. No migration, commits, deployment or browser-policy bypass.

Red/green Sales duplicate regression + real disposable Mongo scope/overlap/evidence/
quantity tests passed. Focused UI/PDF/POS-link7 passed; lint clean;359 pre-existing
TS errors, none in Returns changes. First full suites:server3,763pass/9skip,
admin2,822pass/341files. Final reruns after quantity/lint corrections passed with
same counts, zero failures. Local Mongo27193 stopped cleanly, test DB dropped by
runner. Inline review; no CodeRabbit installed. Existing browser policy prevents
browser layout verification; component behavior and actual PDF generation tested.

Invoice integration added2026-10-14: invoice-scoped Inventory links validate tenant ownership and pass their filter on the first request. See invoice-customer-returns.md for verified return/credit/refund handling.

2026-10-15 reservation verification found an initial empty-search debounce that
reloaded the page and closed a newly opened return detail. Treat undefined and
empty search as equal; timed interaction regression covers the 350ms interval.
No return quantities, credits or refund behavior changed for this fix.
