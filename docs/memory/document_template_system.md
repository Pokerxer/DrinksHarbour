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

2026-09-08 design correction: user asked to use the original document design.
Historical reference is pdf-render.ts at 3c78f3fc. All eight choices now share the
original slanted header, badges, party/reference cards, compact bordered table,
rounded totals/notes and muted signatures. Palettes and saved IDs are retained;
Classic uses the original red/gold. Replaces prior eight different compositions.
Gallery thumbnails and sample PDFs refreshed. Print suite: 57 tests passed;
all eight catalogue pages visually compared with the historical PDF.

Cloud Bay preview requested: docs/document-templates/cloudbay-pricelist-preview.pdf
and .png use nine saved snapshot products through the actual pricelist builder
and Classic renderer. Explicitly labelled sample; no live pricing/discount/stock
verification. One-page generation checked; temporary generator removed.

Unit-price alignment follow-up: header and secondary price text now use the
column alignment, with matching horizontal padding. Right-aligned amounts and
was-prices share an edge in all PDF templates. Screenshot values rendered in
docs/document-templates/cloudbay-alignment-preview.pdf/.png; visually checked.
Print suite plus temporary preview check: 58 passed; preview harness removed.

2026-09-09 commit verification: all 57 current print tests across eight files
passed. Includes refreshed sample PDFs and Cloud Bay previews in the commit.
No push or deployment requested.
