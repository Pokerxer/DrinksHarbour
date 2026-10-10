const id = (value) => String(value?._id || value || "");
function assignmentPlan({
  tenantId,
  warehouse,
  manifest,
  products,
  sizes,
  stocks,
}) {
  const tenant = id(tenantId),
    location = id(warehouse);
  if (
    !location ||
    id(warehouse.tenant) !== tenant ||
    warehouse.isActive === false
  )
    throw Error("Destination warehouse must be active and belong to tenant");
  const defaults = [],
    stock = [],
    seen = new Set();
  for (const productId of new Set(manifest.map((row) => row.productId))) {
    const product = products.find((p) => id(p) === productId);
    if (!product || id(product.tenant) !== tenant)
      throw Error("Manifest product missing from tenant");
    if (product.warehouse && id(product.warehouse) !== location)
      throw Error("Existing product warehouse changed");
    if (!product.warehouse) defaults.push(product);
  }
  for (const row of manifest.filter((row) => row.stock)) {
    const identity = `${row.productId}:${row.sizeId}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const product = products.find((p) => id(p) === row.productId);
    const size = sizes.find((s) => id(s) === row.sizeId);
    if (
      !size ||
      id(size.tenant) !== tenant ||
      id(size.subproduct) !== row.productId
    )
      throw Error("Stock variant does not belong to tenant product");
    const existing = stocks.filter(
      (s) => id(s.subProduct) === row.productId && id(s.size) === row.sizeId,
    );
    if (
      existing.some(
        (s) => id(s.tenant) !== tenant || id(s.warehouse) !== location,
      )
    )
      throw Error(
        "Existing variant warehouse changed; preserve assigned stock",
      );
    if (existing.length > 1)
      throw Error("Duplicate warehouse stock rows require reconciliation");
    if (existing.length) continue;
    if (
      size.stock !== 0 ||
      (size.reservedStock ?? 0) !== 0 ||
      (product.availableStock ?? 0) !== 0
    )
      throw Error(
        "Only verified zero aggregate stock can receive a zero warehouse row",
      );
    stock.push({
      tenant: tenantId,
      warehouse: warehouse._id,
      subProduct: product._id,
      size: size._id,
      currentQuantity: 0,
      reservedQuantity: 0,
      minStockLevel: 0,
    });
  }
  return { defaults, stock };
}
module.exports = { assignmentPlan };
