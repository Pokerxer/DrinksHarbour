'use strict';
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Tenant = require('../models/Tenant');
const { NotFoundError } = require('../utils/errors');
const id = (value) => String(value?._id || value || '');

async function getProductStock(productId, tenantId) {
  if (!(await Product.exists({ _id: productId })))
    throw new NotFoundError('Product not found');
  const listings = await SubProduct.find({
    product: productId,
    ...(tenantId ? { tenant: tenantId } : {}),
  })
    .select(
      '_id tenant sku status sizes totalStock reservedStock availableStock'
    )
    .lean();
  const owners = listings.filter((row) => row.sizes?.length && id(row.tenant));
  const linked = owners.flatMap((row) => row.sizes.map(id));
  const [sizes, tenants] = await Promise.all([
    linked.length
      ? Size.find({
          _id: { $in: linked },
          $or: owners.map((row) => ({
            subproduct: row._id,
            tenant: row.tenant,
          })),
        })
          .select(
            '_id subproduct tenant size displayName sku stock reservedStock availableStock availability'
          )
          .lean()
      : [],
    listings.length
      ? Tenant.find({
          _id: {
            $in: [
              ...new Set(listings.map((row) => id(row.tenant)).filter(Boolean)),
            ],
          },
        })
          .select('_id name')
          .lean()
      : [],
  ]);
  const tenantMap = new Map(
    tenants.map((row) => [id(row), { _id: row._id, name: row.name }])
  );
  const sizeMap = new Map(sizes.map((row) => [id(row), row]));
  return {
    _id: productId,
    subProducts: listings.map((listing) => {
      const refs = listing.sizes || [];
      const populated = refs.map((ref) => {
        const size = sizeMap.get(id(ref));
        if (
          !size ||
          id(size.tenant) !== id(listing.tenant) ||
          id(size.subproduct) !== id(listing)
        )
          return { _id: id(ref) };
        const {
          _id,
          size: name,
          displayName,
          sku,
          stock,
          reservedStock,
          availableStock,
          availability,
        } = size;
        return {
          _id,
          size: name,
          displayName,
          sku,
          stock,
          reservedStock,
          availableStock,
          availability,
        };
      });
      return {
        _id: listing._id,
        tenant: tenantMap.get(id(listing.tenant)) || null,
        sku: listing.sku,
        status: listing.status,
        sizes: populated,
        ...(!refs.length
          ? {
              totalStock: listing.totalStock,
              reservedStock: listing.reservedStock,
              availableStock: listing.availableStock,
            }
          : {}),
      };
    }),
  };
}
module.exports = { getProductStock };
