// controllers/store.controller.js
//
// Public storefront ("vendors") endpoints consumed by the platform app:
//   GET /api/stores          — paginated, searchable directory of approved tenants
//   GET /api/stores/:slug     — single storefront + its published products
//
// A "store" is an approved Tenant. These routes are public (no auth) and only
// ever expose approved, non-system tenants.

const asyncHandler = require('../utils/asyncHandler');
const Tenant = require('../models/Tenant');
const SubProduct = require('../models/SubProduct');
const productService = require('../services/product.service');

// Fields safe to expose publicly for a storefront.
const PUBLIC_TENANT_FIELDS =
  'name slug logo primaryColor plan productCount address canonicalState contactEmail description';

/** Map a Tenant document to the flat shape the storefront UI expects. */
function toStoreCard(tenant) {
  return {
    _id: tenant._id,
    name: tenant.name,
    slug: tenant.slug,
    logo: tenant.logo,
    primaryColor: tenant.primaryColor,
    plan: tenant.plan,
    productCount: tenant.productCount || 0,
    city: tenant.address?.city,
    state: tenant.address?.state || tenant.canonicalState,
    description: tenant.description,
  };
}

/**
 * @route  GET /api/stores
 * @access Public
 * @query  page, limit, search, state, city
 */
exports.getStores = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 16));
  const skip = (page - 1) * limit;

  // Public visibility contract matches getTenantBySlug: approved tenants only.
  const filter = {
    status: 'approved',
  };

  if (req.query.search) {
    filter.name = { $regex: String(req.query.search).trim(), $options: 'i' };
  }

  if (req.query.state) {
    const rx = { $regex: String(req.query.state).trim(), $options: 'i' };
    filter.$or = [{ 'address.state': rx }, { canonicalState: rx }];
  }

  if (req.query.city) {
    filter['address.city'] = { $regex: String(req.query.city).trim(), $options: 'i' };
  }

  const [tenants, total] = await Promise.all([
    Tenant.find(filter)
      .select(PUBLIC_TENANT_FIELDS)
      .sort({ productCount: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Tenant.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      stores: tenants.map(toStoreCard),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

/** Map a searchProducts() result item to the storefront product-card shape. */
function toStoreProduct(p) {
  const min = p.priceRange?.min || 0;
  const max = p.priceRange?.max || 0;
  const originalMin = p.discount?.originalPrice ?? null;
  return {
    _id: p._id,
    name: p.name,
    slug: p.slug,
    primaryImage: p.primaryImage
      ? { url: p.primaryImage.url, alt: p.primaryImage.alt }
      : null,
    minWebsitePrice: min,
    maxWebsitePrice: max,
    originalMinPrice: originalMin && originalMin > min ? originalMin : null,
    isOnSale: !!p.discount,
    abv: p.abv ?? null,
    originCountry: p.originCountry ?? null,
    sizes: p.sizeVariants || [],
  };
}

/**
 * @route  GET /api/stores/:slug
 * @access Public
 */
exports.getStoreBySlug = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findOne({
    slug: req.params.slug,
    status: 'approved',
  })
    .select(PUBLIC_TENANT_FIELDS)
    .lean();

  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Store not found' });
  }

  // productCount should reflect the number of individual subproduct listings
  // this vendor offers — not the stale denormalized Tenant.productCount field
  // (which tracks total stock and drifts out of sync).
  const productCount = await SubProduct.countDocuments({ tenant: tenant._id });

  const store = {
    ...toStoreCard(tenant),
    productCount,
    address: tenant.address,
    email: tenant.contactEmail,
  };

  let products = [];
  try {
    const result = await productService.searchProducts({
      tenantId: String(tenant._id),
      page: 1,
      limit: 60,
      inStock: false, // storefront lists all published products, in stock or not
    });
    products = (result.products || []).map(toStoreProduct);
  } catch (err) {
    // A storefront should still render even if product loading fails.
    req.log?.error?.({ err }, 'getStoreBySlug: product load failed');
  }

  res.status(200).json({
    success: true,
    data: { store, products },
  });
});
