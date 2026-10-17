# Vendor payments runtime Event rejection

2026-10-14. User supplies [object Event] unhandled-rejection overlay on localhost
/accounting/payments?side=vendor (Next15.5.19/Webpack). Page confirmed; immediate
load versus clicked action still pending. Supplied stack points to reporting code
and gives no original failing operation/resource.

Payment and vendor directory request loaders catch errors. Shared page-shell/POS
identity/document export code read; no proven rejection origin. Native resource
loaders in Next/React can reject with Event but this remains unproven. No global
error suppression, framework patch, runtime/financial change, UI workaround or
token extraction. Browser unavailable under prior restriction; no app terminal.

Resume docs/superpowers/specs/RESUME-vendor-runtime-event.md. Next: obtain exact
trigger, then original failing request/resource or console event target evidence.
Record payment metadata task remains pending (user says purchases already paid,
no actual method/date/amount/business scope supplied).
