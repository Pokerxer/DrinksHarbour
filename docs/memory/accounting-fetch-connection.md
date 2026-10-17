# Accounting fetch connection —2026-10-14

User reports persistent Failed to fetch at localhost3000/accounting/payments.
Verified backend5001 healthy/DBConnected, localhost CORS/preflight succeeds,
direct anonymous payments401 and compiled client APIURL5001 correct. Exact browser
rejection unknown; earlier browser restrictions respected, no session extraction.
Resume: docs/superpowers/specs/RESUME-accounting-fetch-connection.md.

Corrected ArAp transport to same-origin /api/accounting. Next catch-all forwards
only Accounting namespace to configured backend, preserves auth/tenant/MFA/CSRF
headers, query, write body and status. No cookies, redirects or write retries.
Reads unavailable503; ambiguous write failures ask for record refresh before retry.
Original payment/source/refund/invoice/credit/journal services unchanged. Local
same-origin route401 confirms backend auth still mandatory. Reload page and Retry.

Full admin2,852 passed across351 files; focused transport/payment11 pass. Type359
existing errors/no new diagnostics; changed-file lint and diff clean. Express
financial code unchanged; previous server3,779 pass/12 skips recorded separately.
No live writes/imports/financial replays/commits/deploy. Rules:
client/apps/admin/src/app/api/accounting/README.md. If browser failure persists,
obtain authorized actual request evidence; do not claim unobserved CORS root cause.
