const { ConflictError } = require('../utils/errors');

// ── SubProduct deletion history guard ────────────────────────────────────────
// A SubProduct with any transactional footprint (orders, sales, inventory
// ledgers, purchases, reviews, venue servings…) must never be hard-deleted:
// its id and its Size ids are embedded in immutable documents, and deleting
// them dangles those references. Such a SubProduct must be ARCHIVED instead
// (PATCH /api/subproducts/:id/archive) — archiving keeps every reference
// resolvable and is reversible via /restore.
//
// Collections that may span tenants (marketplace orders/carts) are queried
// without a tenant scope; size/subProduct identity is already authoritative
// through the parent. Every other collection is scoped to the tenant.
//
// Deliberately NOT here: PriceHistory / Pricelist / Shipping /
// IngredientProfile / Notification — derived or ephemeral records that are
// cleaned up (or safely unset) during an allowed deletion, not blockers.
const REFERENCES = [
  // Inventory & warehouse ledgers
  ['InventoryMovement', ['subProduct']],
  ['WarehouseMovement', ['subProduct']],
  ['StockMovement', ['subproduct']],
  ['WarehouseBatch', ['subProduct']],
  // WarehouseStock is NOT a blocker here: zero-quantity leftover lines are
  // cleaned up during an allowed deletion, and nonzero quantities are refused
  // by the dedicated stock check in deleteSubProduct.
  // Commerce
  ['Order', ['items.subproduct']],
  ['SalesOrder', ['items.subproduct']],
  ['CustomerInvoice', ['items.subproduct']],
  ['Sales', ['subproduct']],
  ['Sale', ['subproducts']],
  ['Cart', ['items.subproduct']],
  ['Wishlist', ['items.addedFromSubproduct']],
  ['Review', ['subproduct']],
  ['KioskScan', ['subProduct']],
  // Purchasing & inventory operations
  ['PurchaseOrder', ['items.subProductId']],
  ['StockTransfer', ['items.subProductId']],
  ['VendorBill', ['items.subProductId']],
  ['VendorReturn', ['items.subProductId']],
  ['PurchaseAgreement', ['items.subProductId']],
  ['ReorderRule', ['subProduct']],
  // Catalog configuration that embeds the id
  ['POSCombo', ['choiceLines.items.subProduct', 'choiceLines.products']],
  ['Promotion', ['subProducts', 'excludedSubProducts', 'bundleItems.subProduct']],
  ['SubProduct', ['bundleDeals.products']],
  // Venue vertical
  ['OpenedBottle', ['source.subProduct']],
  ['VenueConsumptionEvent', ['items.subProduct']],
  ['VenueEventPackage', ['packageSubProduct', 'components.subProduct']],
  ['VenuePackageCommitment', ['packageSnapshot.packageLine.subProduct', 'packageSnapshot.components.subProduct', 'stockReservations.subProduct']],
  ['RecipeVersion', ['output.subProduct']],
];

/**
 * Assess whether a SubProduct can be hard-deleted.
 * @param {Object} subProduct - loaded SubProduct doc (lean or document)
 * @param {string|ObjectId} tenantId
 * @returns {Promise<{allowed: boolean, blockers: Array<{collection: string, count: number}>, reason: string|null}>}
 */
async function assessSubProductDeletionHistory(subProduct, tenantId) {
  const id = subProduct._id;
  const blockers = [];

  for (const [name, paths] of REFERENCES) {
    const Model = require(`../models/${name}`);
    const scope = Model.schema.path('tenant') ? { tenant: tenantId } : {};
    const filter = {
      ...scope,
      $or: paths.map((path) => ({ [path]: id })),
    };
    const count = await Model.countDocuments(filter);
    if (count > 0) blockers.push({ collection: name, count });
  }

  if (blockers.length > 0) {
    const summary = blockers
      .slice(0, 4)
      .map((b) => `${b.count} ${b.collection}`)
      .join(', ');
    const more = blockers.length > 4 ? ` and ${blockers.length - 4} more` : '';
    return {
      allowed: false,
      blockers,
      reason: `This product has order/inventory history (${summary}${more}) and cannot be deleted. Archive it instead — archived products keep their history and can be restored.`,
    };
  }

  return { allowed: true, blockers: [], reason: null };
}

/**
 * Assert the SubProduct has no history; throws ConflictError otherwise.
 */
async function assertSubProductDeletable(subProduct, tenantId) {
  const status = await assessSubProductDeletionHistory(subProduct, tenantId);
  if (!status.allowed) {
    const err = new ConflictError(status.reason);
    err.details = { reason: 'subproduct_has_history', blockers: status.blockers };
    throw err;
  }
  return status;
}

module.exports = { REFERENCES, assessSubProductDeletionHistory, assertSubProductDeletable };
