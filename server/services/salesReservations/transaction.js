const mongoose = require('mongoose');
const { AppError, AuthorizationError, ValidationError } = require('../../utils/errors');
function requireIds(tenantId, orderId) {
  if (!tenantId) throw new AuthorizationError('Tenant not resolved');
  if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(orderId))
    throw new ValidationError('Invalid sales order reference');
}
function transactionFailure(error) {
  if (error.code === 20 || /Transaction numbers are only allowed|does not support retryable writes/i.test(error.message))
    return new AppError('Stock reservations require a transaction-capable database. Contact your administrator.',503,true);
  return error;
}
async function transaction(work) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } catch (error) {
    throw transactionFailure(error);
  } finally { await session.endSession(); }
}
module.exports = { transaction, requireIds, transactionFailure };
