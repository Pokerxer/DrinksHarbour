# Import the public key
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

## Public navigation counts

Category/subcategory lists read published metadata live. Approximate product count
labels use Redis for up to60 seconds when REDIS_URL is configured; disable with
REDIS_NAVIGATION_COUNTS_CACHE=false. Cache outage/corruption falls back to a single
batched approved-product aggregation. Prices, stock, tenants, checkout and product
responses are not cached here. See docs/performance/navigation-redis-images.md.

## Typed-sale pagination

Product search with `saleType` matches an active offer and valid dates before count/pagination, after public tenant and size gates. Typed-sale counts are exact unless price filters also apply. Untyped `onSale` retains its pricing-based post-filter. Local disposable fixture: `node scripts/performance-load/flash-sale-check.js` (localhost Mongo only, no .env). See `docs/memory/flash-sale-speed.md`.

## Admin report Redis cache

Selected authenticated admin report routes cache successful JSON reports for
30 seconds after authorization, scoped by user, tenant, permissions and filters.
Successful authenticated JSON writes invalidate affected report generations.
Requires REDIS_URL; disable with REDIS_ADMIN_REPORT_CACHE=false. See
[operating notes](../docs/performance/admin-redis.md) and the disposable local
`scripts/performance-load/admin-report-cache-check.js` benchmark.

SubProduct list/detail/edit reads separately cache summary counts and catalog
reference labels, with live stock/pricing records. Disable independently with
REDIS_SUBPRODUCT_PAGE_CACHE=false. See [SubProduct cache notes](../docs/performance/sub-product-redis.md).

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
