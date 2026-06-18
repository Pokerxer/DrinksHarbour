// Migration: Backfill tenant field on Size documents and create per-tenant barcode index
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';

async function migrateSizeTenant() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Step 1: Backfill tenant on sizes that don't have it
    const sizesMissingTenant = await Size.find({
      $or: [
        { tenant: { $exists: false } },
        { tenant: null },
      ],
    }).lean();

    console.log(`Found ${sizesMissingTenant.length} sizes missing tenant field`);

    let backfilled = 0;
    for (const size of sizesMissingTenant) {
      const subProduct = await SubProduct.findById(size.subproduct).select('tenant').lean();
      if (subProduct?.tenant) {
        await Size.updateOne(
          { _id: size._id },
          { $set: { tenant: subProduct.tenant } }
        );
        backfilled++;
        if (backfilled % 50 === 0) {
          console.log(`Backfilled ${backfilled} sizes...`);
        }
      } else {
        console.warn(`⚠ SubProduct ${size.subproduct} not found or has no tenant for Size ${size._id}`);
      }
    }
    console.log(`Backfilled ${backfilled} sizes with tenant`);

    // Step 2: Drop the old global barcode index if it exists
    try {
      await Size.collection.dropIndex('barcode_1');
      console.log('Dropped old global barcode index');
    } catch (e) {
      if (e.code === 27) {
        console.log('No old barcode index to drop (index not found)');
      } else {
        console.warn('Could not drop old barcode index:', e.message);
      }
    }

    // Step 3: Create the new per-tenant barcode index
    try {
      await Size.collection.createIndex(
        { tenant: 1, barcode: 1 },
        {
          unique: true,
          partialFilterExpression: { barcode: { $gt: '' } },
          background: true,
        }
      );
      console.log('Created per-tenant barcode index');
    } catch (e) {
      if (e.code === 85) {
        // Index already exists with different options, try dropping and recreating
        console.log('Index already exists, attempting to drop and recreate...');
        await Size.collection.dropIndex('tenant_1_barcode_1');
        await Size.collection.createIndex(
          { tenant: 1, barcode: 1 },
          {
            unique: true,
            partialFilterExpression: { barcode: { $gt: '' } },
            background: true,
          }
        );
        console.log('Recreated per-tenant barcode index');
      } else {
        console.warn('Could not create per-tenant barcode index:', e.message);
      }
    }

    // Verify
    const indexes = await Size.collection.indexes();
    const barcodeIndex = indexes.find(i =>
      i.key && i.key.tenant === 1 && i.key.barcode === 1
    );
    console.log('\nIndex verification:', barcodeIndex ? '✅ Per-tenant barcode index exists' : '❌ Per-tenant barcode index not found');

    const sample = await Size.findOne({}).lean();
    console.log('\nSample size after migration:');
    console.log(JSON.stringify(sample, null, 2));

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrateSizeTenant();
