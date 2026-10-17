# Tenant navigation access — 2026-10-14

Categories (including sub-categories), Brands, and Live Carts are platform
functions and must not appear in `tenant-menu-items.tsx`. The shared Hydrogen
tenant definition feeds the sidebar and app/home launcher for tenant roles.
Keep these entries in the platform menu; tenant Products remain available.

Removed the entries and unused icons. Existing tenant navigation tests passed
(5/5), and whitespace checks passed. Backend permissions were unchanged.
Handoff: `docs/superpowers/specs/RESUME-tenant-menu-access.md`.
