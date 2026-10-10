// Match after public tenant/size lookups and before counting/pagination. Keep
// every condition on the same offer: mixed tenants must not combine flags.
function buildActiveSaleMatch(saleType, now = new Date()) {
  if (!saleType) return null;
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
