const SalesOrder = require('../../models/SalesOrder');
const Operation = require('../../models/SalesOrderOperation');
const Tenant = require('../../models/Tenant');
const { transaction, requireIds } = require('./transaction');
const { identity } = require('./operations');
const { ConflictError, NotFoundError, ValidationError } = require('../../utils/errors');

// One full-total payment slot per order, across all browser/request identities.
// The claim commits before tender side effects; no automatic retry can charge.
async function recordPayment({tenantId,orderId,actorId,payment,capture}) {
  requireIds(tenantId,orderId);
  if(!['cash','card','bank_transfer','mobile_money','pos_terminal','wallet','other'].includes(payment?.paymentMethod))
    throw new ValidationError('Choose a received payment method. Billing later does not record a payment.');
  const op=identity({tenantId,orderId,kind:'payment',requestId:'full-payment'},payment);
  const claim=await transaction(async session=>{
    const order=await SalesOrder.findOne({_id:orderId,tenant:tenantId}).session(session);
    if(!order)throw new NotFoundError('Sales order not found');
    const previous=await Operation.findOne(op.key).session(session);
    if(previous?.state==='settled') {
      if(previous.fingerprint!==op.fingerprint)throw new ConflictError('Payment already recorded with different contents.');
      return {duplicate:order.toObject()};
    }
    if(previous && previous.state!=='failed')throw new ConflictError('Payment is pending or needs review. Do not charge again.');
    if(order.docType!=='order'||!['confirmed','partially_fulfilled','fulfilled'].includes(order.orderStatus))
      throw new ConflictError('Confirm the order before recording payment.');
    if(order.amountPaid>0||['paid','partial'].includes(order.paymentStatus)||order.walletTxRef)
      throw new ConflictError('Payment is already recorded. Review the outstanding balance separately.');
    // Serialize this claim against a concurrent POS receipt/cancellation.
    order.markModified('items');order.$locals.skipSalesInvoiceSync=true;await order.save({session});
    const attempt=previous||new Operation({...op.key});
    attempt.state='pending';attempt.fingerprint=op.fingerprint;attempt.result=undefined;await attempt.save({session});
    return {order:order.toObject(),attemptId:attempt._id};
  });
  if(claim.duplicate)return claim.duplicate;
  let result;
  try {
    const tenant=await Tenant.findOne({_id:tenantId}).select('posSettings').lean();
    result=await (capture||require('../salesPayment.service').capturePayment)({salesOrder:claim.order,tenantId,
      ...payment,userId:actorId,posSettings:tenant?.posSettings||{}});
  } catch(error) {
    await Operation.updateOne({_id:claim.attemptId,tenant:tenantId},{$set:{state:'needs_review',result:{message:error.message}}});
    throw new ConflictError('Payment outcome needs review before another charge.');
  }
  if(!result.ok) {
    await Operation.updateOne({_id:claim.attemptId,tenant:tenantId},{$set:{state:result.uncertain?'needs_review':'failed',result:{message:result.message}}});
    throw new ConflictError(result.message||'Payment failed');
  }
  try {
    return await transaction(async session=>{
      const order=await SalesOrder.findOne({_id:orderId,tenant:tenantId}).session(session);
      if(!order||order.orderStatus==='cancelled'||order.amountPaid>0)throw new ConflictError('Order changed during payment.');
      order.paymentMethod=payment.paymentMethod;order.paymentStatus='paid';order.amountPaid=order.total;
      order.walletTxRef=result.walletTx?._id;order.loyaltyEarned=result.loyaltyEarned||0;
      order.loyaltyRedeemed=result.loyaltyRedeemed||0;order.pointsRedeemed=result.pointsRedeemed||0;
      order.$locals.skipSalesInvoiceSync=true;await order.save({session});
      await Operation.updateOne({_id:claim.attemptId,tenant:tenantId},{$set:{state:'settled',result:{orderId:order._id}}},{session});
      return order.toObject();
    });
  } catch(error) {
    // A committed settlement wins over an ambiguous response.
    const settled=await Operation.findOne({_id:claim.attemptId,tenant:tenantId,state:'settled'}).lean().catch(()=>null);
    if(settled)return SalesOrder.findOne({_id:orderId,tenant:tenantId}).lean();
    await Operation.updateOne({_id:claim.attemptId,tenant:tenantId,state:'pending'},{$set:{state:'needs_review'}}).catch(()=>{});
    throw new ConflictError('Payment was attempted; settlement needs review. Do not charge again.');
  }
}
module.exports={recordPayment};
