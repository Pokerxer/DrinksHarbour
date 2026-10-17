# Sales catalogue fills the viewport

2026-10-16. User requested full width and full height. SalesCatalogModal uses
h-[100dvh] w-full max-w-none; overlay uses p-0 at every breakpoint. Keep square
viewport edges, no desktop height cap or outer spacing, and retain the internal
results scroller with header/footer. Fresh existing modal tests passed 8.
No backend/database/release changes.

[Session handoff](../superpowers/specs/RESUME-catalogue-modal-width.md).
