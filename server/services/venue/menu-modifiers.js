'use strict';
// Owned priced add-ons and effect-free instructions. V1 payload/identity stays
// compatible; v2 quantities are normalized before validation and acceptance.
const { fail, requireId } = require('./errors');
const { keys, text, list } = require('./experience-validation');
function whole(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) fail('INVALID_INPUT', `Invalid ${name}`, 400);
  return value;
}
// Escape only identity delimiters, preserving ordinary historical choice keys.
function choiceIdentity(groupId, optionId) {
  const escape = value => String(value).replace(/[%:|]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${escape(groupId)}:${escape(optionId)}`;
}
function optionV2(option) {
  keys(option, ['id','label','type','subProductId','sizeId','servingVersion','allowedSizeIds','defaultQuantity','componentRole','acceptedRecipeVersionId']);
  const out={id:text(option.id,'option id',50),label:text(option.label,'option label',120),type:option.type||'addon',
    defaultQuantity:whole(option.defaultQuantity??0,0,10,'default quantity')};
  if(!['addon','instruction'].includes(out.type))fail('INVALID_INPUT','Unsupported choice type',400);
  if(option.allowedSizeIds!==undefined)out.allowedSizeIds=[...new Set(list(option.allowedSizeIds,100).map(requireId))];
  if(out.type==='instruction') {
    if(['subProductId','sizeId','servingVersion','componentRole','acceptedRecipeVersionId'].some(k=>option[k]!==undefined))fail('INVALID_INPUT','Instructions cannot create stock or price effects',400);
  } else {
    if(option.componentRole!==undefined&&option.componentRole!=='extra')fail('CHOICE_INCOMPATIBLE','Included recipe components cannot also be issued as extras',400);
    out.subProductId=requireId(option.subProductId);out.sizeId=requireId(option.sizeId);
    out.servingVersion=whole(option.servingVersion,0,Number.MAX_SAFE_INTEGER,'option serving version');
    out.componentRole='extra';
    if(option.acceptedRecipeVersionId!==undefined)out.acceptedRecipeVersionId=requireId(option.acceptedRecipeVersionId);
  }
  return out;
}
function validateModifierGroups(groups, schemaVersion=1) {
  const seenGroups=new Set();
  return list(groups, 6).map(group=>{
    keys(group,['id','name','required','minSelect','maxSelect','incompatibleWith','options','version']);
    const id=text(group.id,'group id',50);
    if(seenGroups.has(id))fail('INVALID_INPUT','Modifier groups must be distinct',400);seenGroups.add(id);
    if(group.required!==undefined&&typeof group.required!=='boolean')fail('INVALID_INPUT','Choose a required flag',400);
    const required=group.required===undefined?true:group.required;
    const minSelect=group.minSelect===undefined?(required?1:0):group.minSelect;
    const maxSelect=group.maxSelect===undefined?1:group.maxSelect;
    whole(minSelect,0,schemaVersion===2?120:Number.MAX_SAFE_INTEGER,'minimum selection');whole(maxSelect,1,schemaVersion===2?120:Number.MAX_SAFE_INTEGER,'maximum selection');
    if(minSelect>maxSelect)fail('INVALID_INPUT','Minimum selection exceeds maximum',400);
    if(required&&minSelect<1)fail('INVALID_INPUT','Required groups need at least one selection',400);
    const seen=new Set();
    const options=list(group.options,12).map(option=>{
      let out;
      if(schemaVersion===2)out=optionV2(option);
      else {keys(option,['id','label','subProductId','sizeId']);out={id:text(option.id,'option id',50),label:text(option.label,'option label',120),subProductId:requireId(option.subProductId),sizeId:requireId(option.sizeId)};}
      if(seen.has(out.id))fail('INVALID_INPUT','Modifier options must be distinct',400);seen.add(out.id);return out;
    });
    if(!options.length)fail('INVALID_INPUT','Modifier groups need options',400);
    const out={id,name:text(group.name,'group name',100),required,minSelect,maxSelect,incompatibleWith:list(group.incompatibleWith||[],6).map(v=>text(v,'incompatible group',50)),options};
    if(schemaVersion===2)out.version=whole(group.version??0,0,Number.MAX_SAFE_INTEGER,'modifier version');
    else if(group.version!==undefined)fail('INVALID_INPUT','Unsupported input field',400);
    return out;
  });
}
function groupsOf(menuItem) {return validateModifierGroups(menuItem?.modifierGroups||[],menuItem?.modifierSchemaVersion||1);}
function assertValidSelection(menuItem,selections) {
  const groups=groupsOf(menuItem);const v2=menuItem?.modifierSchemaVersion===2;
  if(selections!==undefined&&!Array.isArray(selections))fail('INVALID_INPUT','Invalid list',400);
  const inputs=selections===undefined&&v2?groups.flatMap(g=>g.options.filter(o=>o.defaultQuantity>0).map(o=>({groupId:g.id,optionId:o.id,quantity:o.defaultQuantity}))):selections||[];
  list(inputs,120);
  if(!groups.length&&inputs.length)fail('INVALID_INPUT','This item has no modifier choices',400);
  const byId=new Map(groups.map(g=>[g.id,g])); const counts=new Map();const chosen=[];const normalized=new Map();
  for(const selection of inputs){
    keys(selection,v2?['groupId','optionId','quantity']:['groupId','optionId']);
    const group=byId.get(text(selection.groupId,'group id',50));
    const option=group&&group.options.find(o=>o.id===text(selection.optionId,'option id',50));
    if(!group||!option||v2&&option.allowedSizeIds&&!option.allowedSizeIds.includes(String(menuItem.sizeId)))fail('CHOICE_NOT_OFFERED','Selection is not an offered choice for this portion',400);
    const quantity=v2?whole(selection.quantity??1,1,10,'option quantity'):1;
    counts.set(group.id,(counts.get(group.id)||0)+quantity);
    if(v2){const k=choiceIdentity(group.id,option.id); const prior=normalized.get(k);if(prior)prior.quantity=whole(prior.quantity+quantity,1,10,'option quantity');else normalized.set(k,{groupId:group.id,optionId:option.id,quantity});}
    else chosen.push({groupId:group.id,optionId:option.id});
  }
  for(const group of groups){const count=counts.get(group.id)||0;if((group.required||v2)&&count<group.minSelect)fail('CHOICE_REQUIRED',`choose a ${group.name}`,400);if(count>group.maxSelect)fail('INVALID_INPUT',`${group.name} allows at most ${group.maxSelect} selections`,400);}
  for(const group of groups)if(counts.get(group.id))for(const otherId of group.incompatibleWith)if(counts.get(otherId))fail('CHOICE_INCOMPATIBLE',`${group.name} cannot combine with ${otherId}`,400);
  return v2?[...normalized.values()]:chosen;
}
function assertInvalid(menuItem,name,selections){void name;try{assertValidSelection(menuItem,selections);return null;}catch(error){return error.code;}}
function choiceSignature(choices){
  if(!(choices||[]).some(c=>c.quantity!==undefined))return(choices||[]).map(c=>choiceIdentity(c.groupId,c.optionId)).sort().join('|');
  const quantities=new Map();for(const c of choices||[]){const k=choiceIdentity(c.groupId,c.optionId);quantities.set(k,(quantities.get(k)||0)+(c.quantity??1));}
  return [...quantities].map(([k,q])=>`${k}:${q}`).sort().join('|');
}
function publicGroups(groups){return groups.map(g=>({id:g.id,name:g.name,required:g.required,minSelect:g.minSelect,maxSelect:g.maxSelect,incompatibleWith:g.incompatibleWith,...(g.version!==undefined?{version:g.version}:{}),options:g.options.map(o=>({id:o.id,label:o.label,...(o.type?{type:o.type,defaultQuantity:o.defaultQuantity}:{}),...(o.subProductId?{subProductId:o.subProductId,sizeId:o.sizeId}:{}),...(o.allowedSizeIds?{allowedSizeIds:o.allowedSizeIds}:{}),...(o.servingVersion!==undefined?{servingVersion:o.servingVersion}:{})}))}));}
module.exports={validateModifierGroups,assertValidSelection,assertInvalid,choiceIdentity,choiceSignature,groupsOf,publicGroups};
