// CKay one-off import: default preflight, --commit for authorized writes, --verify read-only.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
for (const file of fs.readdirSync(path.join(__dirname, '../models'))) {
  if (file.endsWith('.js')) require(path.join(__dirname, '../models', file));
}
const Tenant = require('../models/Tenant');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Warehouse = require('../models/Warehouse');
const User = require('../models/User');
const { normalizeProductName } = require('../services/subProductImport.service');
const { skuBudgetFor } = require('../middleware/plan.middleware');
const outputDir = path.resolve(__dirname, '../../outputs/01a0c4d2-inventory-import');
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {maxPoolSize:2,serverSelectionTimeoutMS:12000});
  const tenant = await Tenant.findOne({slug:'ckay'}).lean();
  if (!tenant || String(tenant._id)!=='6aabec2b9294f4afed5ce61f') throw new Error('CKay tenant identity mismatch');
  const [products, subs, warehouses, user, budget] = await Promise.all([
    Product.find({}).select('_id name type status').lean(),
    SubProduct.find({tenant:tenant._id}).select('_id product sku status costPrice baseSellingPrice totalStock').lean(),
    Warehouse.find({tenant:tenant._id,isActive:true}).select('_id name type isDefault').lean(),
    User.findOne({_id:tenant.admin,tenant:tenant._id}).select('_id role tenant').lean(),
    skuBudgetFor(tenant),
  ]);
  const rows = JSON.parse(fs.readFileSync(path.join(outputDir,'exported-rows.json'),'utf8'));
  if(process.argv.includes('--commit') || process.argv.includes('--verify')) {
    await require('./ckay-product-import-run.cjs')({tenant,user,budget,warehouses,rows,outputDir,subs,products});
    return;
  }
  const matches = rows.map(row=>{
    const matching = products.filter(p=>normalizeProductName(p.name)===normalizeProductName(row.productName));
    return {name:row.productName,missingPrice:row.sizePrice===null,missingQty:row.openingQty===null,products:matching,subproducts:subs.filter(s=>matching.some(p=>String(p._id)===String(s.product)))};
  });
  const candidates=products.filter(p=>/jack\s*dan|j[aä]ger|decanter|baylis|fuzzy|brew company|cashew|estella|starbucks|stanley|conundrum|vgr/i.test(p.name));
  const report = {database:mongoose.connection.name,tenant:{id:tenant._id,slug:tenant.slug,status:tenant.status,markupPercentage:tenant.markupPercentage,revenueModel:tenant.revenueModel},user,skuBudget:budget,existingSubProducts:subs.length,warehouses,matches,candidates};
  fs.writeFileSync(path.join(outputDir,'ckay-preflight.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,matches:matches.filter(x=>x.products.length||x.missingPrice||x.missingQty)},null,2));
}
main().catch(e=>{console.error(e.name+': '+e.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[connection redacted]'));process.exitCode=1;}).finally(()=>mongoose.disconnect());
