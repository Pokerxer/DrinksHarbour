> Current runtime policy (2026-10-31): Upstash/Redis is disconnected. No provider
> is required; optional caches read MongoDB directly and API/mail/auth request
> limits use local memory. Old Redis configuration cannot reactivate it. See
> [standalone operating notes](../docs/memory/standalone-without-upstash.md).

# Import the public key

## Shared warehouse identity safety

Warehouse records are shared tenant location identities, not product-owned storage
objects. Product create/edit may link only to an active warehouse owned by the
same tenant. Empty legacy storage-form objects preserve the current reference;
explicit null clears only the listing reference. Product forms must never create,
edit or delete physical locations. Manage bins on warehouse stock separately.

Application/model hard deletes of warehouses are prohibited. The legacy DELETE
route now deactivates the record, preserves stock/history rows, and refuses the
default location or a location with positive stock/reservations. Raw MongoDB
collection operations bypass Mongoose safeguards: restrict production database
write credentials and never use fixture cleanup against business databases.

Regression: `node --test __tests__/warehouseIdentity.test.js`. Incident/recovery:
`docs/superpowers/specs/RESUME-wh001-recovery-guard-2026-10-27.md`.

wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod  # auto-start on boot
sudo systemctl status mongod  # check status


# Start MongoDB
brew services start mongodb-community

# Restart MongoDB
brew services restart mongodb-community

# Stop MongoDB
brew services stop mongodb-community

# Check MongoDB status
brew services info mongodb-community

## Local semantic-search runtime

Local embeddings use maintained `@huggingface/transformers`3.8.1 with
`Xenova/all-MiniLM-L6-v2` (q8, mean pooling, normalized384-value vectors).
The scoped Sharp0.35.5 override is covered by real native image/inference checks.
Node22 is required. Models are downloaded on first use; no database reindex is
performed automatically. Browser caching is disabled in Node. The default model
cache is the OS temporary directory under `drinksharbour-embedding-models`;
set `EMBEDDING_CACHE_DIR` to a writable persistent directory when available.
Installed application bundles do not need to be writable.

After a clean install, `node scripts/verify-local-embeddings.js` checks real native
inference with synthetic text and disposes the model. It downloads the public
model if uncached, loads no .env and writes no business data. Ordinary unit tests
mock model loading. CI also runs this native check; its hosted result is required
before release. Remote model access and native packaging need deployment-specific
staging verification. See [migration evidence](../docs/operations/server-security-migration.md).

## Access-token boundaries

Normal API authentication accepts legacy untyped access JWTs or `type: access`.
MFA challenges, MFA step-up proofs and refresh JWTs cannot establish a session,
even when their signature verifies. The mixed POS guard admits `type: pos` only
through its tenant-checked POS path. Its admin path applies normal access-token
purpose and password-change invalidation checks. Preserve these boundaries when
adding a token issuer. See [regression evidence](../docs/audits/access-token-purpose-2026-10-23.md).

## Public navigation counts

Category/subcategory lists read published metadata live. Product count labels
use a batched approved-product aggregation. The former Redis cache is disabled.
Prices, stock, tenants, checkout and product responses are not cached here. See docs/performance/navigation-redis-images.md.

## Typed-sale pagination

Product search with `saleType` matches an active offer and valid dates before count/pagination, after public tenant and size gates. Typed-sale counts are exact unless price filters also apply. Untyped `onSale` retains its pricing-based post-filter. Local disposable fixture: `node scripts/performance-load/flash-sale-check.js` (localhost Mongo only, no .env). See `docs/memory/flash-sale-speed.md`.

## Admin report reads

Reports use live authenticated handlers, with user, tenant and permission checks
on every request. The former Redis cache is disabled. Historical implementation:
[operating notes](../docs/performance/admin-redis.md) and the disposable local
`scripts/performance-load/admin-report-cache-check.js` benchmark.

SubProduct list/detail/edit reads separately cache summary counts and catalog
reference labels in the historical implementation. All those reads now use
authoritative loaders; the Redis cache is disabled. See [SubProduct cache notes](../docs/performance/sub-product-redis.md).

## Marketplace proximity

Public product requests accept an optional x-shopping-location header containing
JSON with finite numeric lat/lon values. Invalid supplied pairs return 400;
omission keeps the existing catalogue path. All responses vary on that header;
personalized responses are private/no-store. This preference never determines
Tenant authorization. Existing public eligibility and resolved Tenant scoping
continue to apply.

For personalized queries, price and offer eligibility resolve across the entire
matching catalogue before sorting/pagination. shoppingOffer identifies the
qualifying SubProduct/Size, customer-visible price and approximate geographic
distance. Filtered card offers/stock reflect matching sizes; detail responses
retain all eligible seller alternatives. Representative selection never
replaces a sold-out price-filter match with a nonmatching purchasable variant.

A disposable local integration/latency check is available at
scripts/performance-load/marketplace-proximity-check.js. It requires a separate
local MongoDB on 127.0.0.1:27028, creates only a process-specific test database,
never loads .env and drops that test database afterward. Initial personalized
queries price all candidates; monitor latency as catalogue size grows. Roll out
backend support before or together with platform changes.
# Private product stock read

`GET /api/products/admin/:id/stock` is authenticated for platform admins and
tenant owners/admins, with tenant resolution after authentication. JWT tenant
authority scopes listings; platform admins without a target can read all.
Linked size IDs must match listing and tenant. Response includes stock, reserved
and available quantities, SKU/status and tenant name; no costs/supplier/contact
data. Responses are private/no-store. Size rows take precedence over legacy
listing aggregates, which apply only to sizeless listings. Public product reads
do not gain reservation fields. This route is read-only; existing order and
warehouse reservation rollups remain authoritative.

## Private product sales history

`GET /api/products/admin/:id/sales` uses the same protected read roles and JWT
Tenant authority as stock. Its private/no-store report reconciles paid POS receipts,
delivered online orders and posted paid Sales fulfillments, including overlapping
returns, without counting linked records twice. Buyer names and IDs are returned;
contacts, costs and payment details are excluded. Missing evidence is disclosed.
Reads exceeding 20,000 Order or SalesOrder documents return explicit 422.
See [Sold history rules](../docs/memory/product-sold-history.md).

## Sub-Product review approvals

The existing admin-status operation validates reviewed normal/pack prices against
fresh canonical pricing before writes. Size overrides are bound to listing and
tenant, tenant callers cannot review another tenant, and listing publication now
tracks approval/decline. Clean-hundred NGN overrides, sale-adjusted payout floors
and real pack savings are enforced. See [review operating notes](../docs/memory/subproduct-review-pricing.md).

## Revenue agreements

Commission is a fixed agreed percentage of final discounted merchandise, without
an extra platform markup. Markup retains the agreed cost-plus payout. New order
splits/coupon allocations are frozen with policy merchandise-v2. Delivery/tax/fees
stay outside that gross split. Explicit commission marketplace price overrides are
additive schema fields, separate from markup percentages. Rollout/history/refund
limitations: [revenue policy notes](../docs/memory/revenue-agreement-pricing.md).

Selling-price markup adds a third agreement using current tenant retail plus
Tenant.sellingPriceMarkupPercentage. Listing/Size percentage overrides inherit
when null; platform review can restore inheritance. No commission, cost-based
markup or automatic pack discount is added. Payout stays retail and order/refund
snapshots remain fixed. See [selling-price markup](../docs/memory/selling-price-markup.md).

## Runtime service failures

The Redis quota incident is historical. The user subsequently required operation
without Upstash; local memory limits and authoritative reads replace the external
runtime dependency. Historical details: [incident notes](../docs/memory/runtime-service-errors.md).

`GET /realtime-status` advertises whether this process actually attached Socket.IO,
without querying MongoDB or Redis. Vercel instances report false. POS/KDS clients
probe before connecting and continue REST polling when unavailable. Deploy this
endpoint before or alongside the admin socket guard.

## Standalone operation without Upstash

Upstash/Redis is disconnected. Optional caches use authoritative MongoDB reads.
API/mail/auth request limits use process-local memory at their existing thresholds;
they reset on restart and are not shared across server instances. Redis settings
cannot reactivate external caching. See docs/memory/standalone-without-upstash.md.
