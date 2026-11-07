'use strict';
const mongoose=require('mongoose');
const {ConflictError}=require('../../utils/errors');
const fail=()=>{throw new ConflictError('Managed merchant journals require domain reconciliation; manual reversal refused');};
// Saved business identities own these postings; a source label alone has no authority.
async function assertManualReversalAllowed(entry,session){
  let current=entry;const seen=new Set();
  while(current?.refDoc){
    // All protected business references are ObjectIds; unrelated legacy references cannot match.
    if(!mongoose.isObjectIdOrHexString(current.refDoc))return;
    if(['sales_revenue','cogs'].includes(current.entryType)&&
      await require('../../models/Order').exists({_id:current.refDoc,merchantFulfillmentVersion:{$in:[1,2]},'items.tenant':current.tenant}).session(session||null))fail();
    if(current.entryType==='refund'&&
      await require('../../models/MerchantRefundAllocation').exists({_id:current.refDoc,tenant:current.tenant}).session(session||null))fail();
    if(current.entryType==='inventory_adjust'&&
      await require('../../models/MerchantGoodsCancellation').exists({tenant:current.tenant,'cancellations.journalRef':current.refDoc}).session(session||null))fail();
    if(current.entryType!=='reversal')return;
    const identity=String(current._id);if(seen.has(identity))throw new ConflictError('Journal reversal ancestry requires reconciliation');seen.add(identity);
    current=await require('../../models/JournalEntry').findOne({_id:current.refDoc,tenant:current.tenant}).session(session||null).lean();
  }
}
module.exports={assertManualReversalAllowed};
