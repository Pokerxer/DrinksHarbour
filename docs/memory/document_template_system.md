---
name: Tenant document template system
description: Eight integrated PDF layouts, scoped defaults and shared export UI; live acceptance check pending tenant login.
type: project
---

The user approved eight styles on 2026-09-07: Classic, Modern, Editorial, Ledger,
Signature, Axis, Atelier, Blueprint. Implemented under Settings → Document
templates; persists Tenant.documentTemplates through own-tenant GET/PUT endpoints
with settings:write authorization. Missing preferences resolve to Classic.

Existing sales, purchases, price-list, stock, A4 invoice, movement-history and
legacy direct-print outputs now use a common preview/export dialog. Selection is
explicit per PDF; no global palette or tenant localStorage. Thermal receipts/CSV
unchanged. Generic issuer enrichment must never relabel the platform address as
a tenant address or replace a selected warehouse's letterhead.

Server suite: 2,744 passed after allowing local HTTP sockets. Admin suite: 1,780 passed across 108 files.
Actual PDFs for all eight styles inspected and supplied in docs/document-templates.
Unrelated project TypeScript failures remain; touched template files are clean.

User authorized using the displayed local test account, but login rejected its
credentials. A working tenant session is needed for final save/reload browser
acceptance; do not reset passwords. See [resume](../superpowers/specs/RESUME-document-template-system.md)
for exact coverage and next actions. No commits or pushes.

2026-09-08 navigation follow-up: centralized routes.documentTemplates and added
an administrator/owner shortcut in the tenant menu/launcher. Settings brand goes
to General; only the most specific tab is active, with accessible link labels.
Manage defaults closes the export dialog and uses Next navigation. Password/MFA
sign-in now honors a validated same-origin callbackUrl, and stale-session redirects
preserve print query options. Regression/auth checks: 66 tests across 10 files
passed. Live authenticated acceptance still requires a working tenant account.
