const { freshMinimum } = require('./restock/minimum');
function minimumNoticeFields(stock, now = new Date()) {
  const policy = freshMinimum(stock.automaticMinimum, now);
  if (!policy || policy.status !== 'active' || policy.units !== stock.threshold)
    return { minimumSource: 'configured' };
  return {
    minimumSource: 'automatic',
    minimumConfidence: policy.confidence,
    minimumUpdatedAt: policy.calculatedAt,
  };
}
module.exports = { minimumNoticeFields };
