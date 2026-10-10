# Shared inventory history controls

Applies to Moves, Receipts, Deliveries, Internal, Adjustments and Scrap browsers.
Search alternatives separated by commas, semicolons or newlines match any
alternative; words within each alternative all have to match. Product IDs are
trimmed and match any selection; warehouse/status/source/supplier/route/date
filters narrow the same result set. Receipt-origin labels are searchable only
in receipt views. Original reference, order and receipt references remain searchable.

Sort all matching rows before pagination. Posted change is signed; warehouse
sorting follows the actual warehouse shown in the cell. Reference sorting is
natural (TRF-2 before TRF-10). Costs use finite recorded total or unit cost times
quantity; unknown cost remains distinct from zero and sorts last in either
direction. Ties use movement ID for deterministic page order. Missing source
groups as unknown, never invented Manual. Column and group controls are buttons.

Date/time bounds are local calendar times, end minute inclusive. Reject impossible
dates, invalid times and reversed bounds before fetching history. Date/time
controls must show the complete native time input. Clear all restores all filters,
grouping, date/time defaults, date-descending sorting and page one.

No outer inventory margins added; no stock mutations or tenant-query changes.
Plan: docs/superpowers/plans/2026-10-04-inventory-history-filters.md.
Handoff: docs/superpowers/specs/RESUME-inventory-history-filters.md.
