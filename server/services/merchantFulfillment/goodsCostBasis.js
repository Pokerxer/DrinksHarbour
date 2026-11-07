"use strict";
const mongoose=require('mongoose');
const {ConflictError}=require('../../utils/errors');
const {id,hash,minor}=require('./allocation');
const Basis=require('../../models/MerchantGoodsCancellation');
const fail=()=>{throw new ConflictError('Original goods cost accounting requires reconciliation before cancellation');};

// Match original paid posting's aggregate rounding; freeze residual ownership once.
function costs(items,children){
  const lines=items.map(item=>{
    const owners=children.filter(child=>child.lines.some(line=>id(line.line)===id(item.fulfillmentLineId||item._id)));
    if(owners.length!==1)fail();
    const owner=owners[0], saved=owner.lines.find(line=>id(line.line)===id(item.fulfillmentLineId||item._id));
    if(id(owner.location)!==id(item.warehouse)||saved.quantity!==item.quantity||
      !Number.isSafeInteger(item.quantity)||item.quantity<1||
      ['product','subproduct','size'].some(key=>id(saved[key])!==id(item[key])))fail();
    const cost=item.vendorPriceAtPurchase;
    if(cost!==undefined&&(typeof cost!=='number'||!Number.isFinite(cost)||cost<0))fail();
    const raw=(cost||0)*item.quantity*100;
    if(!Number.isFinite(raw)||raw>Number.MAX_SAFE_INTEGER)fail();
    return {line:id(saved.line),merchantOrder:id(owner),raw,cost,quantity:item.quantity};
  });
  if(children.reduce((n,child)=>n+child.lines.length,0)!==lines.length||new Set(lines.map(line=>line.line)).size!==lines.length)fail();
  const total=Math.round(items.reduce((n,item)=>n+(item.vendorPriceAtPurchase||0)*item.quantity,0)*100);
  if(!Number.isSafeInteger(total)||total<0||(total>0&&lines.some(line=>line.cost===undefined)))fail();
  const allocated=lines.map(line=>({...line,costMinor:Math.floor(line.raw)}));
  let remaining=total-allocated.reduce((n,line)=>n+line.costMinor,0);
  if(remaining<0||remaining>allocated.length)fail();
  for(const line of [...allocated].sort((a,b)=>(b.raw-Math.floor(b.raw))-(a.raw-Math.floor(a.raw))||a.line.localeCompare(b.line))){
    if(!remaining)break;line.costMinor++;remaining--;
  }
  return {total,lines:allocated.sort((a,b)=>a.line.localeCompare(b.line))};
}
function exactJournal(row,total){
  if(!row||row.status!=='posted'||row.source!=='marketplace'||row.lines.length!==2)fail();
  const debit=row.lines.find(line=>line.account==='5000'), credit=row.lines.find(line=>line.account==='1200');
  if(!debit||!credit||minor(debit.debit)!==total||minor(debit.credit)!==0||minor(credit.credit)!==total||minor(credit.debit)!==0)fail();
}
async function basisFor(parent,child,session,version){
  const raw=await require('../../models/Order').collection.findOne({_id:parent._id},{session});
  if(!raw||raw.merchantFulfillmentVersion!==version||parent.merchantFulfillmentVersion!==version)fail();
  const items=raw.items.filter(line=>id(line.tenant)===id(child.tenant));
  const children=await require('../../models/MerchantOrder').find({order:parent._id,tenant:child.tenant}).session(session).lean();
  if(!children.some(row=>id(row)===id(child)))fail();
  const value=costs(items,children), Journal=require('../../models/JournalEntry');
  const journals=await Journal.find({tenant:child.tenant,refDoc:parent._id,entryType:'cogs'}).session(session).lean();
  if(value.total){if(journals.length!==1)fail();exactJournal(journals[0],value.total);}
  else if(journals.length)fail();
  const original=journals[0];
  if(original&&await Journal.exists({tenant:child.tenant,refDoc:original._id,entryType:'reversal'}).session(session))fail();
  const fingerprint=hash(JSON.stringify({journal:original?{id:id(original),lines:original.lines}:null,
    lines:value.lines.map(({line,merchantOrder,cost,quantity,costMinor})=>({line,merchantOrder,cost,quantity,costMinor}))}));
  const identity=hash(`${id(parent)}:${id(child.tenant)}:goods-cost-v${version}`);
  let basis=await Basis.findById(identity).session(session);
  if(basis&&basis.fingerprint!==fingerprint)fail();
  if(!basis)[basis]=await Basis.create([{_id:identity,order:parent._id,tenant:child.tenant,originalJournal:original?._id,
    originalCostMinor:value.total,fingerprint,lines:value.lines.map(({line,merchantOrder,costMinor})=>({line,merchantOrder,costMinor}))}],{session});
  return {basis,original};
}
async function postCost({basis,original,child,amount,journalRef,actor,session,evidence}){
  const Journal=require('../../models/JournalEntry');
  if(amount){
    const accounts=await require('../../models/Account').find({tenant:child.tenant,code:{$in:['1200','5000']},isActive:true}).session(session).lean();
    if(new Set(accounts.map(row=>row.code)).size!==2||original.lines.some(line=>line.accountId&&
      !accounts.some(account=>account.code===line.account&&id(account)===id(line.accountId))))fail();
    if(await Journal.exists({tenant:child.tenant,refDoc:journalRef}).session(session))fail();
    await require('../journalEntry.service').postJournalEntry({tenantId:child.tenant,refDoc:journalRef,refDocType:'MerchantGoodsCancellation',
      entryType:'inventory_adjust',source:'merchant_goods_cancel',postedBy:actor._id,session,
      lines:[{account:'1200',debit:amount/100,credit:0},{account:'5000',debit:0,credit:amount/100}],
      memo:'Never-shipped merchant goods cancellation; original accepted cost only'});
  }
  basis.cancellations.push({...evidence,merchantOrder:id(child),journalRef,costMinor:amount,actor:actor._id,cancelledAt:new Date()});
  basis.version++;await basis.save({session});
}
module.exports={basisFor,postCost};
