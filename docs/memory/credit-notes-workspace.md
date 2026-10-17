# Credit notes workspace — 2026-10-14

User approved a bounded redesign of /accounting/credit-notes. Resume:
docs/superpowers/specs/RESUME-credit-notes-workspace.md.

Stored lifecycle remains draft/applied/cancelled; the workspace presents posted
notes as Available, Partially applied or Fully applied using unappliedAmount and
VAT-inclusive total. Summary covers every matching note, not just visible page;
cancelled credit is excluded. Search/date/availability filters run before paging.
Saved invoice/source and allocation links are owner scoped.

Posting/cancellation have review dialogs; draft cancellation moves no journal.
New workspace credits default to draft. Application is explicitly customer-wide:
fresh account balance, oldest posted notes first against one chosen invoice,
valid amount bounded by account credit and invoice outstanding. Never claim that
this endpoint applies only the selected credit note. No new cash refund flow,
GL posting rules, schema migration or auto-allocation introduced.

Invoice choices use credit scope for creation (paid/open posted reviewed Sales
NGN invoices) and customer-specific open scope for application. More/retry controls
avoid silent100-record truncation. Token-keyed workspace and request generations
prevent stale replies; failed list reads clear old rows. Customer choices have
loading/retry/more. Selecting an invoice clears unrelated customer; more choices
preserve an already-reviewed amount. Original invoice/PDF snapshots unaffected.

Verification complete: server3,770 passed/11 optional skips; local credit-workspace,
saved-invoice and invoice-return Mongo integrations all passed. Changed-file lint
clean; type359 existing diagnostics with no new errors. Full admin2,835 passed across344 files.
Disposable databases dropped; temporary Mongo27192 stopped cleanly, exit0. No live
business data writes, imports, commits, push, deployment or browser bypass.

Local single-agent review complete; CodeRabbit unavailable. Browser access remains restricted; no alternate workaround attempted.
