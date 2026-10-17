// Match after public tenant/size lookups and before counting/pagination. Keep
// every condition on the same offer: mixed tenants must not combine flags.
function buildActiveSaleMatch(saleType, now = new Date(), onSale = false) {
  if (!saleType) {
    if (onSale !== true && onSale !== 'true') return null;
    return { $match: { $or: [
      { subProducts: { $elemMatch: {
        isOnSale: true,
        $and: [
          { $or: [{ saleStartDate: null }, { saleStartDate: { $lte: now } }] },
          { $or: [{ saleEndDate: null }, { saleEndDate: { $gte: now } }] },
        ],
      } } },
      { 'platformDiscount.value': { $gt: 0 },
        'platformDiscount.type': { $in: ['percentage', 'fixed'] },
        $and: [
          { $or: [{ 'platformDiscount.start': null }, { 'platformDiscount.start': { $lte: now } }] },
          { $or: [{ 'platformDiscount.end': null }, { 'platformDiscount.end': { $gte: now } }] },
        ],
      },
    ] } };
  }
  if (typeof saleType !== 'string') return { $match: { _id: { $exists: false } } };
  return {
    $match: { subProducts: { $elemMatch: {
      isOnSale: true,
      saleType,
      $and: [
        { $or: [{ saleStartDate: null }, { saleStartDate: { $lte: now } }] },
        { $or: [{ saleEndDate: null }, { saleEndDate: { $gte: now } }] },
      ],
    } } },
  };
}
module.exports = { buildActiveSaleMatch };
