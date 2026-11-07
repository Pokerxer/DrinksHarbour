'use strict';
const { ConflictError } = require('../../../utils/errors'),
  { allocate, minor, id } = require('../../merchantFulfillment/allocation');
async function assertOriginal(child, parent, allocation, session) {
  if (
    (!parent.channelSnapshot &&
      parent.salesChannel &&
      parent.salesChannel !== 'DRINKSHARBOUR_NG') ||
    (parent.channelSnapshot && parent.channelSnapshot.kind !== 'marketplace') ||
    parent.channelSnapshot?.apiKey ||
    parent.channelSnapshot?.storefrontChannel
  )
    throw new ConflictError('Original marketplace channel required');
  const group = await require('../../../models/MerchantOrderSet')
    .findOne({ _id: parent._id, currency: parent.currency })
    .session(session || null)
    .lean();
  const allocated = allocate(parent),
    expected = allocated.find((r) => r._id === child._id);
  if (
    group &&
    JSON.stringify([...group.children].sort()) !==
      JSON.stringify(allocated.map((row) => row._id).sort())
  )
    throw new ConflictError('Original complete merchant responsibility set unavailable');
  if (
    !group ||
    !group.children.includes(child._id) ||
    group.totalMinor !== minor(parent.totalAmount) ||
    group.allocationPolicy !== child.allocationPolicy ||
    !expected ||
    [
      'shippingMinor',
      'taxMinor',
      'totalMinor',
      'merchandiseMinor',
      'grossMinor',
      'discountMinor',
      'tenantShareMinor',
      'commissionMinor',
    ].some((k) => expected[k] !== child[k]) ||
    expected.lines.length !== child.lines.length
  )
    throw new ConflictError('Original accepted merchant charge allocation does not reconcile');
  for (const saved of child.lines) {
    const original = expected.lines.find((r) => id(r.line) === id(saved.line));
    if (
      !original ||
      ['product', 'subproduct', 'size'].some((k) => id(original[k]) !== id(saved[k])) ||
      [
        'quantity',
        'grossMinor',
        'discountMinor',
        'merchandiseMinor',
        'tenantShareMinor',
        'commissionMinor',
      ].some((k) => original[k] !== saved[k])
    )
      throw new ConflictError('Original merchant line identity does not reconcile');
  }
  if (
    id(allocation.order) !== id(parent._id) ||
    !Array.isArray(allocation.lines) ||
    !allocation.lines.length ||
    new Set(allocation.lines.map((r) => id(r.line))).size !== allocation.lines.length
  )
    throw new ConflictError('Original shipment allocation identity does not reconcile');
  for (const selected of allocation.lines) {
    const line = child.lines.find((r) => id(r.line) === id(selected.line)),
      progress = child.quantityProgress?.find((r) => id(r.line) === id(selected.line));
    if (
      !line ||
      !progress ||
      !Number.isSafeInteger(selected.quantity) ||
      selected.quantity < 1 ||
      selected.quantity > line.quantity ||
      selected.quantity > progress.shipped ||
      !Array.isArray(selected.ranges) ||
      !selected.ranges.length
    )
      throw new ConflictError('Original shipped allocation quantities unavailable');
    const ranges = selected.ranges;
    require('../../merchantFulfillment/quantity/ranges').checked(
      line.quantity,
      ranges.map((r) => ({ ...r, action: 'consume' })),
    );
    const blocks = require('../../merchantFulfillment/quantity/ranges').checked(
      line.quantity,
      progress.financialBlocks || [],
    );
    if (
      ranges.some((range) =>
        blocks.some(
          (block) =>
            range.start < block.start + block.quantity &&
            block.start < range.start + range.quantity,
        ),
      )
    )
      throw new ConflictError(
        'Original units have reserved or refunded money; carrier creation requires review',
      );
    if (ranges.reduce((n, r) => n + r.quantity, 0) !== selected.quantity)
      throw new ConflictError('Original shipped unit ranges do not reconcile');
    const hold = await require('../../../models/OnlineStockReservation')
      .findOne({
        order: parent._id,
        merchantOrder: child._id,
        tenant: child.tenant,
        warehouse: child.location,
        fulfillmentLineId: id(line.line),
        reservationVersion: 2,
      })
      .session(session || null)
      .lean();
    if (
      !hold ||
      ['product', 'size'].some((k) => id(hold[k]) !== id(line[k])) ||
      id(hold.subProduct) !== id(line.subproduct) ||
      hold.quantity !== line.quantity ||
      hold.consumedQuantity !== progress.shipped ||
      ranges.some(
        (r) =>
          !(hold.unitDispositions || []).some(
            (d) =>
              d.action === 'consume' &&
              d.allocation === allocation._id &&
              d.start === r.start &&
              d.quantity === r.quantity,
          ),
      )
    )
      throw new ConflictError('Original shipped reservation evidence unavailable');
  }
}
module.exports = { assertOriginal };
