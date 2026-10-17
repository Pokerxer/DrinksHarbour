# Customer credit notes

Lifecycle/mutation rules live in creditNote.service.js and creditNote.alloc.js.
Read-only workspace queries live in creditNote.browse.js. CreditNote status
`applied` means posted, not necessarily allocated. Present Available, Partially
applied or Fully applied according to unappliedAmount and amount+taxAmount.

Posting creates one journal for the complete credit. Invoice allocations do not
post another journal. Cancelling a draft creates no reversal; cancelling a posted
note uses the existing paired reversal and deallocation safety checks. Credit
is not a cash refund. Returns never silently post commercial credit.

Apply is customer-wide, using oldest posted notes first against one selected
Sales invoice. A note-specific action must fetch the complete customer balance
and label that behavior accurately. Never suggest a note ID constrains this API.

List/search/summary/invoice links are tenant scoped. Summary covers the complete
filtered result and excludes cancelled credit from balances. Credit scope invoice
choices include paid posted reviewed Sales NGN invoices; applying uses that
customer's open Sales invoices. Saved CustomerInvoice IDs resolve to their original
Sales source through salesSourceId; do not substitute POS receipts or drafts.

Tests: node --test '__tests__/*.test.js' from server. Local opt-in workspace
regression: node scripts/test-credit-workspace.js; it only uses disposable
localhost27192 drinks_credit_workspace_test_local and drops it in cleanup.
See docs/superpowers/specs/RESUME-credit-notes-workspace.md for verification/handoff.
