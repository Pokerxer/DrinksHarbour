const { createHash } = require('node:crypto');
const Operation = require('../../models/SalesOrderOperation');
const { ValidationError, ConflictError } = require('../../utils/errors');
function identity({tenantId,orderId,kind,requestId}, payload) {
  if (typeof requestId!=='string' || !/^[\w:.-]{8,128}$/.test(requestId))
    throw new ValidationError('A stable requestId (8–128 characters) is required.');
  return {key:{tenant:tenantId,salesOrder:orderId,kind,requestId},
    fingerprint:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
}
async function beginOperation(operation,session) {
  const previous=await Operation.findOne(operation.key).session(session).lean();
  if(previous){
    if(previous.fingerprint!==operation.fingerprint)throw new ConflictError('This requestId was used with different contents.');
    if(previous.state!=='settled')throw new ConflictError('This operation is pending or needs review. Do not submit another charge.');
    return {previous:previous.result};
  }
  const [doc]=await Operation.create([{...operation.key,fingerprint:operation.fingerprint}],{session});
  return {doc};
}
async function finishOperation(doc,result,session){doc.state='settled';doc.result=result;await doc.save({session});}
module.exports={identity,beginOperation,finishOperation};
