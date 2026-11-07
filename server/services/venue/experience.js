'use strict';
const Config = require('../../models/VenueLocationProfile');
const Table = require('../../models/POSTable');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { keys, text, list, validateProfile, validateFloor } = require('./experience-validation');
const { priceVenueLines } = require('./pricing');
const { id } = require('./eligibility');
const { validateModifierGroups } = require('./menu-modifiers');
function configurationDTO(row) {
  return {id:id(row),locationId:id(row.location),version:row.version,profileVersion:row.profileVersion,
    publication:row.profile && row.reviewedAt && row.reviewedBy && row.reviewedProfileVersion === row.profileVersion ? 'reviewed':'draft',
    profile:row.profile,menu:row.menu,floor:row.floor};
}
async function getConfiguration(args) {
  await loadVenueContext({...args,action:'experience.read'});
  const row = await Config.findOne({tenant:args.tenantId,location:args.locationId}).lean();
  return row ? configurationDTO(row):{locationId:args.locationId,version:0,profileVersion:0,publication:'draft',profile:null,menu:{sections:[]},floor:{zones:[],tables:[]}};
}
function validateMenu(input) {
  if(input?.schemaVersion===2)return require('./menu-taxonomy').validateMenuV2(input);
  keys(input,['sections']); const seen = new Set();
  return {sections:list(input.sections,30).map(section=>{
    keys(section,['id','name','items']); const sid=text(section.id,'section ID',50);
    if(seen.has(sid)) fail('INVALID_INPUT','Sections must be distinct',400);seen.add(sid);
    const items=list(section.items,100).map(item=>{keys(item,['subProductId','sizeId','published','display','category','modifierGroups','pourMl']);requireId(item.subProductId);requireId(item.sizeId);
      if(typeof item.published!=='boolean')fail('INVALID_INPUT','Choose menu publication state',400);
      // Additive item fields are optional and assembled conditionally so legacy
      // payloads validate to objects without the new keys (no undefined leaks).
      const landed={subProductId:item.subProductId,sizeId:item.sizeId,published:item.published};
      if(item.display!==undefined)landed.display=text(item.display,'item display name',120);
      if(item.category!==undefined)landed.category=text(item.category,'item category',100);
      if(item.modifierGroups!==undefined)landed.modifierGroups=validateModifierGroups(item.modifierGroups);
      if(item.pourMl!==undefined){
        if(!Number.isInteger(item.pourMl)||item.pourMl<1||item.pourMl>2000)fail('INVALID_INPUT','pourMl is an integer from 1 to 2000',400);
        landed.pourMl=item.pourMl; // pour-serving config: absent key = sealed service
      }
      return landed;});
    if(new Set(items.map(i=>`${i.subProductId}:${i.sizeId}`)).size!==items.length)fail('INVALID_INPUT','Menu items must be distinct',400);
    return {id:sid,name:text(section.name,'section name',100),items};
  })};
}
async function saveConfiguration(args) {
  const {tenantId,locationId,actor,kind,expectedVersion,idempotencyKey}=args;
  if(!Number.isInteger(expectedVersion)||expectedVersion<0)fail('STATE_CHANGED','Configuration version required');
  const validate={profile:validateProfile,menu:validateMenu,floor:validateFloor}[kind];
  if(!validate)fail('INVALID_INPUT','Unknown configuration',400);
  const input=validate(args.input);
  const context=await loadVenueContext({...args,action:'experience.manage'});
  return runVenueOperation({targetType:'VenueLocationProfile',tenantId,locationId,actor:context.actor,operation:`experience.${kind}`,key:idempotencyKey,payload:{expectedVersion,input:kind==='menu'&&input.schemaVersion===2?args.input:input},execute:async({mongoSession})=>{
    const current=await loadVenueContext({...args,action:'experience.manage',mongoSession});
    let row=await Config.findOne({tenant:tenantId,location:locationId}).session(mongoSession);
    if((row?.version||0)!==expectedVersion)fail('STATE_CHANGED','Configuration changed; reload before saving');
    if(kind==='floor'){
      const count=await Table.countDocuments({_id:{$in:input.tables.map(t=>t.tableId)},tenant:tenantId,location:locationId}).session(mongoSession);
      if(count!==input.tables.length)fail('NOT_FOUND','Table not found at this location',404);
    }
    if(kind==='menu'&&input.schemaVersion===2)await require('./menu-references').validateMenuReferences({context:current,config:input,mongoSession});
    if(kind==='menu') for(const section of input.sections) for(const item of section.items) {
      if(item.published)await priceVenueLines({...current,lines:[{...item,quantity:1}],mongoSession});
      else {
        const subproduct=await require('../../models/SubProduct').findOne({_id:item.subProductId,tenant:tenantId}).select('product').populate('product','type catalogKind').session(mongoSession).lean();
        const size=await require('../../models/Size').exists({_id:item.sizeId,tenant:tenantId,subproduct:item.subProductId}).session(mongoSession);
        if(!subproduct||!size)fail('NOT_FOUND','Beverage or size not found',404);
        require('./pricing').assertVenueProduct(subproduct.product);
      }
    }
    if(!row)row=new Config({tenant:tenantId,location:locationId});
    row[kind]=input; row.version+=1;
    if(kind==='profile'){row.slug=input.slug;row.profileVersion+=1;}
    await row.save({session:mongoSession});
    return configurationDTO(row.toObject());
  }});
}
async function projectMenu({tenant,location,config,actor={permissions:[]},mongoSession=null},menu) {
  if(menu?.schemaVersion===2)return require('./menu-taxonomy').publicMenuV2({context:{tenant,location,actor,profile:config?.profile},config:menu,mongoSession});
  const sections=[];
  for(const section of menu?.sections||[]){
    const items=[];
    for(const item of section.items.filter(i=>i.published)){
      try {
        const [line]=await priceVenueLines({tenant,location,actor,lines:[{...item,quantity:1}],mongoSession});
        const stock=await require('../../models/WarehouseStock').findOne({tenant:tenant._id,warehouse:location._id,subProduct:item.subProductId,size:item.sizeId}).session(mongoSession).lean();
        const size=await require('../../models/Size').findOne({_id:item.sizeId,tenant:tenant._id,subproduct:item.subProductId}).select('size displayName volumeMl').session(mongoSession).lean();
        const product=await require('../../models/Product').findOne({_id:line.product}).select('name isAlcoholic abv status isPublished submittingTenant').session(mongoSession).lean();
        if(!product||!(product.status==='approved'&&product.isPublished===true||product.status==='pending'&&id(product.submittingTenant)===id(tenant)))continue;
        items.push({subProductId:item.subProductId,sizeId:item.sizeId,name:line.name,sizeLabel:size?.displayName||size?.size||'',unitPriceMinor:line.unitPriceMinor,taxMinor:line.taxMinor,currency:'NGN',alcoholic:!!product?.isAlcoholic,abv:product?.abv||0,available:!!stock&&stock.currentQuantity-stock.reservedQuantity>0,
          display:item.display,category:item.category,pourMl:item.pourMl,
          modifierGroups:(item.modifierGroups||[]).map((g)=>({id:g.id,name:g.name,required:g.required,minSelect:g.minSelect,maxSelect:g.maxSelect,incompatibleWith:g.incompatibleWith,options:g.options.map((o)=>({id:o.id,label:o.label,subProductId:o.subProductId,sizeId:o.sizeId}))}))});
      }catch(error){if(!['NOT_FOUND','VENUE_UNSUPPORTED_CART','INVALID_MONEY'].includes(error.code))throw error;}
    }
    if(items.length)sections.push({id:section.id,name:section.name,items});
  }
  return {sections};
}
async function readMenu(args) {
  const context=await loadVenueContext({...args,action:'experience.read'});
  const row=await Config.findOne({tenant:args.tenantId,location:args.locationId}).lean();
  return projectMenu(context,row?.menu);
}
async function workspace(args) {
  const context=await loadVenueContext({...args,action:'experience.read'});
  const config=await getConfiguration(args);
  const tables=await Table.find({tenant:args.tenantId,location:args.locationId}).select('_id name section seats status venueVersion').sort({sortOrder:1,_id:1}).lean();
  const visits=await require('../../models/VenueServiceSession').find({tenant:args.tenantId,location:args.locationId,state:{$ne:'closed'}}).select('_id state version booking tableIds businessDate').sort({openedAt:1}).limit(100).lean();
  const capacityEnabled=process.env.VENUE_CAPACITY_ENABLED==='true'&&!!await require('../../models/VenueCapacityPolicy').exists({tenant:args.tenantId,location:args.locationId,enabled:true});
  return {config,tables,visits,capacityEnabled,canBill:['tenant_owner','tenant_admin'].includes(context.actor.role)&&!context.actor.venueDeniedActions?.includes('bill.read'),canReview:require('./eligibility').resolveVenueEligibility({...context,action:'requests.review'}).allowed,canManage:require('./eligibility').resolveVenueEligibility({...context,action:'experience.manage'}).allowed,capabilities:context.location.venueServices?.capabilities||[],canonicalCheckoutEnabled:context.location.venueServices?.canonicalCheckoutEnabled===true,
    readiness:{profile:!!config.profile,publication:config.publication,menu:config.menu.sections.length>0,floor:config.floor.tables.length>0,staff:!!context.location.venueStaff?.length,canonicalCheckout:context.location.venueServices?.canonicalCheckoutEnabled===true}};
}
module.exports={menuCandidates: require('./menu-candidates').menuCandidates,getConfiguration,saveConfiguration,readMenu,projectMenu,workspace,configurationDTO,validateMenu};
