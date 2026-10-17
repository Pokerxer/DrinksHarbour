# Wyn City business location — 2026-10-12

User provided 39 Gana Street, Abuja. Tenant wyncity
(699165839f3308b1baeca8fc) now has city Abuja, state Abuja, Nigeria, postcode
900001; formatted address 39 Gana St, Maitama, Abuja 900001, Federal Capital
Territory, Nigeria. GPS lat 9.0782337, lon 7.5004871, source google.

Google returned a non-partial ROOFTOP match, place ID
ChIJ57DWX0gKThARfLgZ_HTOCY4. Previously GPS was absent and postcode 42245632.
Applied transactionally with AuditLog 6accccdd4f716b4947dd5d44. Independent
database read confirmed persistence. All unrelated tenant fields were compared
and preserved; warehouses, stock, pricing and other tenants were not updated.
Product API verification returned Wyn City geographic distance 0 km when queried
from those business coordinates, confirming the saved GPS is used.

Tool: server/scripts/update-wyn-city-address.js (dry run by default, --apply
mutates). Details and recovery before-values in
../superpowers/specs/RESUME-wyn-city-address.md. No deployment required.
