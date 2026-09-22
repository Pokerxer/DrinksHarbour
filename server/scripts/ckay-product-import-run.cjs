const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const WarehouseStock = require('../models/WarehouseStock');
const InventoryMovement = require('../models/InventoryMovement');
const service = require('../services/subProductImport.service');
const subService = require('../services/subproduct.service');
const warehouseService = require('../services/warehouse.service');
const inventoryService = require('../services/inventory.service');
const {logAudit} = require('../utils/auditLog');
const reference = 'ckay-extracted-products-20260921';

module.exports = async function run(context) {
  const {tenant,user,budget,warehouses,rows,outputDir,subs,products} = context;
  assert.equal(String(user.tenant),String(tenant._id));
  assert.equal(warehouses.length,1);
  const warehouseId=warehouses[0]._id;
  assert.equal(String(warehouseId),'6aac1540739aed42cba07329');
  const complete=rows.filter(r=>r.sizePrice>0 && Number.isInteger(r.openingQty) && r.openingQty>=0).map(r=>({
    ...r, productName:r.productName==='Jack Daniels Old No. 7 Brand'?"Jack Daniel's Old No. 7":r.productName,
    costPrice:r.sellingPrice,sizeCostPrice:r.sizePrice,
  }));
  assert.equal(complete.length,88);
  const file=path.join(outputDir,'ckay-import-results.json');
  const results=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
  const save=()=>{
    fs.writeFileSync(file,JSON.stringify(results,null,2));
    fs.writeFileSync(path.join(outputDir,'ckay-import-progress.md'),
      '# CKay import progress\n\nTemporary cost equals selling price, authorized by user.\n\n'+
      results.map(r=>`- ${r.name}: ${r.subProductId}, ${r.quantity} units, NGN ${r.price}, verified.`).join('\n')+'\n');
  };
  async function verify(row) {
    const product=await Product.findOne({name:row.productName}).lean();
    assert.ok(product,`Product missing: ${row.productName}`);
    const sp=await SubProduct.findOne({tenant:tenant._id,product:product._id}).lean();
    assert.ok(sp,`SubProduct missing: ${row.productName}`);
    assert.equal(sp.costPrice,row.costPrice);
    assert.equal(sp.baseSellingPrice,row.sellingPrice);
    assert.equal(sp.isPublished,true);
    assert.equal(sp.status,'active');
    assert.equal(sp.totalStock,row.openingQty);
    const sizes=await Size.find({tenant:tenant._id,subproduct:sp._id}).lean();
    assert.equal(sizes.length,1);
    const size=sizes[0];
    assert.equal(size.size,row.size);
    assert.equal(size.costPrice,row.sizeCostPrice);
    assert.equal(size.sellingPrice,row.sizePrice);
    assert.equal(size.stock,row.openingQty);
    assert.equal(size.availableStock,row.openingQty);
    assert.equal(size.unitsPerPack,1);
    const stock=await WarehouseStock.findOne({tenant:tenant._id,warehouse:warehouseId,subProduct:sp._id,size:size._id}).lean();
    assert.equal(stock?.currentQuantity,row.openingQty);
    const moves=await InventoryMovement.find({tenant:tenant._id,subProduct:sp._id,reference}).lean();
    assert.equal(moves.length,1);
    assert.equal(moves[0].quantity,row.openingQty);
    const alcohol=['whiskey','liqueur'].includes(row.productType);
    if(row.productName!=="Jack Daniel's Old No. 7") {
      assert.equal(product.isAlcoholic,alcohol);
      assert.equal(product.status,'pending');
    }
    return {name:row.productName,productId:String(product._id),subProductId:String(sp._id),sizeId:String(size._id),quantity:row.openingQty,price:row.sizePrice};
  }
  if(process.argv.includes('--verify')) {
    for(const row of complete) await verify(row);
    const before=JSON.parse(fs.readFileSync(path.join(outputDir,'ckay-before.json'),'utf8'));
    for(const old of before) {
      const current=await SubProduct.findOne({_id:old._id,tenant:tenant._id}).select('_id product sku status costPrice baseSellingPrice totalStock').lean();
      assert.deepEqual(JSON.parse(JSON.stringify(current)),old);
    }
    console.log(JSON.stringify({verified:complete.length,units:complete.reduce((n,r)=>n+r.openingQty,0),tenantSubProducts:await SubProduct.countDocuments({tenant:tenant._id}),originalListingsUnchanged:before.length}));
    return;
  }
  assert.ok(budget===null || budget>=complete.length-results.length,'SKU budget insufficient');
  if(!fs.existsSync(path.join(outputDir,'ckay-before.json'))) {
    fs.writeFileSync(path.join(outputDir,'ckay-before.json'),JSON.stringify(subs,null,2));
  }
  const enrich=async name=>({name,type:complete.find(r=>r.productName===name)?.productType});
  const deps={enrich,getProductNames:async()=>products.map(p=>p.name),getCategoryOptions:async()=>({categories:[],subcategories:{}})};
  const preview=await service.validateImport(complete,{warehouseId},tenant._id,deps);
  assert.equal(preview.ok,true,JSON.stringify(preview));
  for(const row of complete) {
    if(results.some(r=>r.name===row.productName)){await verify(row);continue;}
    const product=await Product.findOne({name:row.productName}).select('_id').lean();
    if(product && await SubProduct.exists({tenant:tenant._id,product:product._id})) {
      throw new Error(`Existing listing requires reconciliation before retry: ${row.productName}`);
    }
    const alcohol=['whiskey','liqueur'].includes(row.productType);
    const rowDeps={...deps,
      createSubProduct:async(data,tid,actor)=>subService.createSubProduct({
        ...data,markupPercentage:0,roundUp:'none',isPublished:true,
        tenantNotes:`${reference}. Temporary cost equals selling price per owner instruction. Source size is one listed item/set; no bottle volume inferred.`,
        shipping:{requiresAgeVerification:alcohol},
        ...(data.newProductData?{newProductData:{...data.newProductData,isAlcoholic:alcohol}}:{}),
        sizes:data.sizes.map(s=>({...s,markupPercentage:0,roundUp:'none',unitsPerPack:1,unitType:'count_unit',requiresAgeVerification:alcohol})),
      },tid,actor),
      adjustStock:(data,uid,tid)=>warehouseService.adjustStock({...data,recordHistory:false,notes:reference,unitCost:row.costPrice},uid,tid),
      recordReceiptMovement:data=>inventoryService.recordReceiptMovement({...data,reference,notes:'Opening stock from extracted product list. Temporary cost equals selling price.'}),
    };
    const log=console.log;
    let outcome;
    try {
      console.log=()=>{};
      outcome=await service.commitImport([row],{warehouseId,skuBudget:1},tenant._id,user,rowDeps);
    } finally {console.log=log;}
    if(outcome.errors.length) throw new Error(JSON.stringify(outcome));
    assert.equal(outcome.createdSubProducts,1);
    const checked=await verify(row);
    results.push(checked);save();
    console.log(`Verified ${results.length}/88: ${row.productName}`);
  }
  await logAudit({action:'SUBPRODUCT_IMPORT',actionCategory:'bulk',actorRole:'system',targetType:'Tenant',targetId:tenant._id,targetTenantId:tenant._id,
    justification:'User requested CKay import and explicitly set temporary cost equal to selling price. Two rows missing prices excluded.',
    changes:{after:{reference,warehouseId,created:results.length,subProductIds:results.map(r=>r.subProductId)}},fireAndForget:false});
  console.log('Imported and verified all 88 complete products.');
};
