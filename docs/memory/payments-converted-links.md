# Payments: converted quotation invoice links

2026-10-14. Continuation of the approved payments functionality.

`server/services/accountingPayment/sourceReceipts.js` previously queried saved
Sales invoices only using the original journal source IDs. A quotation payment
therefore lost its saved-invoice link after conversion to a sales order.

The read projection now selects docType/convertedTo from tenant-scoped Sales
sources, includes quotation conversion targets in the same-tenant invoice query,
and fills missing original-source links using the converted saved invoice. Direct
source invoices take priority. Missing targets retain verified receipt visibility;
non-quotation records cannot redirect through convertedTo. Original amounts,
receipt URLs and journal identities remain unchanged. No financial writes.

Regression: `server/__tests__/payments.convertedLinks.test.js` exercises the real
loader/projection with only database I/O replaced. It reproduced undefined invoice
href before the fix. Four conversion/priority/missing-target/type cases now pass.
Full server suite: 3,793 passed, 13 optional skips, zero failures. Focused conversion tests: four passed. Syntax and diff checks passed. Single-agent review checked tenant predicates, direct-link precedence and original receipt identity. CodeRabbit is unavailable; no external review or browser verification. Counts include unrelated existing workspace tests. No frontend edits; prior frontend transport verification
remains in accounting-fetch-connection.md. Browser access remains unavailable.

Resume: docs/superpowers/specs/RESUME-payments-converted-links.md.
