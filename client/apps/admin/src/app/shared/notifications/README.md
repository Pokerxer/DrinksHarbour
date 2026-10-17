# Notifications inbox and shared UI

Main /notifications composes the recipient-scoped inbox hook, local filters,
groups, selection, summary and detail panel. Specialist child directories have
their own README rules. Do not bypass JWT/recipient authority or expose raw vendor,
customer, cost or protected report data in notices.

The inbox loads a bounded window of at most ten pages of 50 and deduplicates IDs.
Coverage must use actual loaded length, not the requested limit. Local search,
categories, priorities and chips apply only to that window; partial loads advise
retry, bounded windows advise narrowing the date range. Count scope is the
selected timeframe where provided. Do not imply that local filter counts describe
unloaded history.

Opening marks a notice read via the existing hook. Its details resolve from
loaded data and remain open when it leaves an Unread filter. Explicit filter
changes close the panel; actual row removal/identity changes clear it. Distinct
single reads may overlap; duplicate and bulk guards remain hook responsibilities.
Server/client safe-action allowlists must agree and reject external redirects,
tenant pivots and unknown query parameters.

Current work: docs/superpowers/specs/RESUME-notifications-inbox-functionality.md.

Low-stock alerts use saved automatic sales/transfer minimums. Recalculation runs
in the existing background job at 00:00 and 12:00 Africa/Lagos, never on inbox loads.
Display safe source/confidence/update facts and label unsupported history as a
configured fallback. Never recompute minimums in the client or expose private
policy demand/cost inputs. Server-side catch-up scans current stock using the saved policy. Planning page
reads use saved minimums and do not persist or recalculate them.
