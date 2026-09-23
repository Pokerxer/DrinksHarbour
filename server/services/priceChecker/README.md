# Customer price checker boundary

Only PriceCheckerKiosk supplies tenant, shop, location and pricelist authority.
Never trust scan payload scope. Exact Size.barcode preserves leading zeros.
WarehouseStock determines branch availability; never use global Size stock.
Retail/pricelist rules match POS; website discounts/markup are excluded.
Public JSON is allowlisted and respects hidden quantity settings.
Attendance kiosk credentials never authorize this module or vice versa.
Analytics writes are awaited, idempotent by request ID and contain no customer PII.
Store mode only; marketplace activation is rejected until implemented.

Design: ../../../docs/superpowers/specs/2026-09-22-customer-price-checker-design.md

Runtime: MongoDB replica-set transactions are mandatory for scan event/counter
atomicity. Provision the schema unique indexes before accepting kiosk traffic.
PRICE_CHECKER_SESSION_SECRET optionally overrides JWT_SECRET as key material;
session.js derives a separate purpose key. Display tax settings never change the
retail selling amount or add tax a second time.

Operations and verification: ../../../docs/superpowers/specs/RESUME-customer-price-checker.md
