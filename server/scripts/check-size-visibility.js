// One-off: simulate the API's size population for the barcode listing. Read-only.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { SUBPRODUCT_LIST_FIELDS, SIZE_LIST_FIELDS } = require('../services/subproduct-list-fields');

const SP_ID = '6a68c7c3355794d325e87490';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const SubProduct = require('../models/SubProduct');
  require('../models/Size');

  // Detail endpoint shape
  const detail = await SubProduct.findById(SP_ID).populate('sizes').lean();
  console.log('DETAIL sizes:', (detail.sizes || []).map(s => ({
    id: String(s._id), size: s.size, sku: s.sku, barcode: s.barcode,
    status: s.status, availability: s.availability, stock: s.stock,
  })));

  // List endpoint (view=list) shape
  const listDoc = await SubProduct.findById(SP_ID)
    .populate({ path: 'sizes', select: SIZE_LIST_FIELDS })
    .select(SUBPRODUCT_LIST_FIELDS)
    .lean();
  console.log('LIST sizes:', (listDoc.sizes || []).map(s => ({
    id: String(s._id), size: s.size, sku: s.sku, barcode: s.barcode, stock: s.stock,
  })));

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
