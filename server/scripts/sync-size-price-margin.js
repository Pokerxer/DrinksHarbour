'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');

const MODELS = [
  'Brand','Category','Product','Size','SubProduct','Tenant','Warehouse','WarehouseStock',
];

const TENANT_ID = '699165839f3308b1baeca8fc';

async function main() {
  await connectDB();
  for (const m of MODELS) { try { require(`../models/${m}`); } catch (_) {} }

  const SubProduct = mongoose.model('SubProduct');
  const Size       = mongoose.model('Size');
  const tenantOid  = new mongoose.Types.ObjectId(TENANT_ID);

  const subProducts = await SubProduct.find({ tenant: tenantOid })
    .select('_id baseSellingPrice costPrice marginPercentage markupPercentage')
    .lean();

  console.log(`Found ${subProducts.length} sub-products\n`);

  let updatedSP = 0, updatedSizes = 0;

  for (const sp of subProducts) {
    const sell = sp.baseSellingPrice || 0;
    const cost = sp.costPrice || 0;

    // Round prices to nearest 100
    const sellR = Math.ceil(sell / 100) * 100 || sell;
    const costR = Math.min(Math.ceil(cost / 100) * 100 || cost, sellR);

    // Margin = (sell - cost) / sell * 100, rounded up; clamp to 0 minimum
    const rawMargin   = sellR > 0 ? ((sellR - costR) / sellR) * 100 : 0;
    const margin      = Math.max(0, Math.ceil(rawMargin));

    // Markup = (sell - cost) / cost * 100, rounded up; clamp to 0 minimum
    const rawMarkup   = costR > 0 ? ((sellR - costR) / costR) * 100 : 0;
    const markup      = Math.max(0, Math.ceil(rawMarkup));

    await SubProduct.updateOne(
      { _id: sp._id },
      { $set: { baseSellingPrice: sellR, costPrice: costR, marginPercentage: margin, markupPercentage: markup } }
    );
    updatedSP++;

    // Sync all linked sizes: sellingPrice = rounded SubProduct.baseSellingPrice
    const result = await Size.updateMany(
      { subproduct: sp._id },
      { $set: { sellingPrice: sellR, costPrice: costR } }
    );
    updatedSizes += result.modifiedCount;
  }

  console.log(`✅ SubProducts updated: ${updatedSP}`);
  console.log(`✅ Sizes synced:        ${updatedSizes}`);

  await disconnectDB();
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
