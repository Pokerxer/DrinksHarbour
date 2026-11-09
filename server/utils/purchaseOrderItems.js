// utils/purchaseOrderItems.js
//
// Shared normalisation for purchase-order line payloads coming from the
// create/edit forms. Lines are discriminated by `lineType`:
//   'product'  — a catalog-linked purchase line (SubProduct reference)
//   'section'  — a titled heading with no qty/price (create form "Add a section")
//   'note'     — standalone free-text (create form "Add a note")
// Product lines keep the exact legacy normalisation; presentation lines carry
// no catalog reference and must be neutralised so they can never affect
// receiving, posting, or billing (they always quantity to 0).

const { ValidationError } = require('./errors');

function lineTypeOf(item) {
  return item && item.lineType && item.lineType !== 'product'
    ? item.lineType
    : 'product';
}

/** Map of presentation lineType → required payload field. */
const PRESENTATION_FIELD = { section: 'name', note: 'description' };

/**
 * Normalise the wire format of a PO's items array in place (creates + updates).
 * Throws ValidationError for malformed lines. Returns the same array reference
 * (mutated) so callers keep their existing aliasing expectations.
 */
function sanitizePurchaseOrderLines(items) {
  if (!Array.isArray(items)) {
    throw new ValidationError("Required fields missing");
  }
  if (items.some((item) => !item)) {
    throw new ValidationError("Each item must be an object");
  }

  for (const item of items) {
    const type = lineTypeOf(item);
    if (type === 'product') {
      // Legacy contract: product lines carry a catalog reference.
      if (!item.subProductId) {
        throw new ValidationError("Each item must have subProductId");
      }
      if (!item.subProductName && item.productName) {
        item.subProductName = item.productName;
      }
      if (item.unitCost === undefined || item.unitCost === null) {
        item.unitCost = item.unitPrice ?? 0;
      }
      if (item.packagingQty === undefined || item.packagingQty === null) {
        item.packagingQty = item.packSize ?? 1;
      }
      continue;
    }

    // Section/note: a title or body is the line's whole point — reject empties
    // so a half-typed presentation line never persists as a blank row.
    const field = PRESENTATION_FIELD[type];
    if (!field || !String(item[field] || '').trim()) {
      throw new ValidationError(
        `${type === 'section' ? 'Section lines' : 'Note lines'} require a ${
          field ?? 'valid lineType'
        }`
      );
    }
    // Presentation lines carry no catalog link or money of their own: strip
    // empty catalog refs (an id string here would fail the ObjectId cast) and
    // zero every counter so receiving/billing totals skip them.
    delete item.subProductId;
    delete item.sizeId;
    item.quantity = 0;
    item.receivedQty = 0;
    item.postedQty = 0;
    item.unitCost = 0;
    item.unitPrice = 0;
    item.packPrice = 0;
    item.packQty = 0;
    item.packSize = 1;
    item.packagingQty = 1;
    item.totalCost = 0;
    item.lineType = type;
  }
  return items;
}

module.exports = { sanitizePurchaseOrderLines, lineTypeOf, PRESENTATION_FIELD };
