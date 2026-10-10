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
