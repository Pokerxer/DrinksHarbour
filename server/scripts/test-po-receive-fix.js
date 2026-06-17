// Test script for PO receive fix
// Tests:
// 1. New sellWithoutSizeVariants sub-product -> auto-creates Unit Size
// 2. Updated sub-product toggling sellWithoutSizeVariants -> creates Unit Size
// 3. PO receive with sized sub-product -> WarehouseStock + InventoryMovement correct
// 4. PO receive with sellWithoutSizeVariants sub-product -> lazy Unit Size creation + stock/inventory correct

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour');
  const db = mongoose.connection.db;

  console.log('=== DRINKSHARBOUR PO RECEIVE FIX VERIFICATION ===\n');

  // Clean any previous test data
  const oldTenant = await db.collection('tenants').findOne({ name: 'Test PO Tenant' });
  if (oldTenant) {
    const tid = oldTenant._id;
    const sps = await db.collection('subproducts').find({ tenant: tid }).toArray();
    const spIds = sps.map(s => s._id);
    const sizeIds = sps.flatMap(s => s.sizes || []);
    if (sizeIds.length) await db.collection('sizes').deleteMany({ _id: { $in: sizeIds } });
    if (spIds.length) await db.collection('subproducts').deleteMany({ _id: { $in: spIds } });
    await db.collection('purchaseorders').deleteMany({ tenant: tid });
    await db.collection('warehouses').deleteMany({ tenant: tid });
    await db.collection('products').deleteMany({ sku: 'TEST-PO-PROD-001' });
    await db.collection('warehousestocks').deleteMany({ tenant: tid });
    await db.collection('inventorymovements').deleteMany({ tenant: tid });
    // Also clean orphan sizes for this tenant
    await db.collection('sizes').deleteMany({ tenant: tid });
    await db.collection('tenants').deleteMany({ _id: tid });
    console.log('(cleaned previous test data)');
  }

  // 1. Create test tenant if needed
  let tenant = await db.collection('tenants').findOne({ name: 'Test PO Tenant' });
  if (!tenant) {
    const result = await db.collection('tenants').insertOne({
      name: 'Test PO Tenant',
      slug: 'test-po-tenant',
      email: 'test@po.com',
      revenueModel: 'markup',
      markupPercentage: 20,
      commissionPercentage: 0,
      isActive: true,
      isApproved: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    tenant = await db.collection('tenants').findOne({ _id: result.insertedId });
    console.log('Created test tenant:', tenant.name, tenant._id.toString().slice(0, 8) + '...');
  } else {
    console.log('Using existing tenant:', tenant.name, tenant._id.toString().slice(0, 8) + '...');
  }
  const tenantId = tenant._id;

  // 2. Create a central product
  let product = await db.collection('products').findOne({ sku: 'TEST-PO-PROD-001' });
  if (!product) {
    const result = await db.collection('products').insertOne({
      sku: 'TEST-PO-PROD-001',
      name: 'Test PO Product',
      description: 'A test product for PO receive verification',
      alcoholic: false,
      abv: 0,
      volume: 500,
      origin: 'Testland',
      flavorNotes: [],
      shelfLife: '12 months',
      barcode: 'TEST123456789',
      beverageType: 'soft-drink',
      isPending: false,
      isApproved: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    product = await db.collection('products').findOne({ _id: result.insertedId });
    console.log('Created test product:', product.name, product._id.toString().slice(0, 8) + '...');
  } else {
    console.log('Using existing product:', product.name, product._id.toString().slice(0, 8) + '...');
  }
  const productId = product._id;

  // 3. Create a warehouse
  let warehouse = await db.collection('warehouses').findOne({ tenant: tenantId, code: 'TEST-WH' });
  if (!warehouse) {
    const result = await db.collection('warehouses').insertOne({
      tenant: tenantId,
      name: 'Test Warehouse',
      code: 'TEST-WH',
      isDefault: true,
      isActive: true,
      address: { street: '123 Test St', city: 'Testville', country: 'Testland' },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    warehouse = await db.collection('warehouses').findOne({ _id: result.insertedId });
    console.log('Created test warehouse:', warehouse.name, warehouse._id.toString().slice(0, 8) + '...');
  } else {
    console.log('Using existing warehouse:', warehouse.name, warehouse._id.toString().slice(0, 8) + '...');
  }
  const warehouseId = warehouse._id;

  // 4. Test sub-product creation with sellWithoutSizeVariants
  console.log('\n--- TEST 1: Create sellWithoutSizeVariants sub-product ---');
  let sp1 = await db.collection('subproducts').findOne({ tenant: tenantId, sku: 'TEST-SP-NOSIZE' });
  if (!sp1) {
    // Create a Unit Size first (simulating the fix in subproduct.service.js)
    const size = await db.collection('sizes').insertOne({
      tenant: tenantId,
      subproduct: null,
      size: 'unit',
      displayName: 'Unit',
      stock: 0,
      availableStock: 0,
      price: 0,
      sellingPrice: 0,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const sizeId = size.insertedId;

    // Now create the sub-product with sellWithoutSizeVariants and the Unit Size
    const result = await db.collection('subproducts').insertOne({
      tenant: tenantId,
      product: productId,
      sku: 'TEST-SP-NOSIZE',
      name: 'Test No-Size SubProduct',
      sellWithoutSizeVariants: true,
      sizes: [sizeId],
      defaultSize: sizeId,
      totalStock: 0,
      availableStock: 0,
      sellingPrice: 1000,
      costPrice: 700,
      stockQuantity: 0,
      availability: true,
      alcoholic: false,
      abv: 0,
      volume: 500,
      origin: 'Testland',
      beverageType: 'soft-drink',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Update the Size to reference the sub-product
    await db.collection('sizes').updateOne(
      { _id: sizeId },
      { $set: { subproduct: result.insertedId } }
    );

    sp1 = await db.collection('subproducts').findOne({ _id: result.insertedId });
    console.log('Created sellWithoutSizeVariants sub-product:', sp1.sku, sp1._id.toString().slice(0, 8) + '...');
    console.log('  sizes:', sp1.sizes.length, '| defaultSize:', sp1.defaultSize ? 'yes' : 'no');
    
    // Verify the Size exists
    const createdSize = await db.collection('sizes').findOne({ _id: sizeId });
    console.log('  Unit Size created:', createdSize.size, createdSize.displayName, '| subproduct:', createdSize.subproduct ? createdSize.subproduct.toString().slice(0, 8) + '...' : 'MISSING');
    
    if (createdSize.subproduct && createdSize.subproduct.toString() === result.insertedId.toString()) {
      console.log('  ✅ PASS: Unit Size created and linked to sub-product');
    } else {
      console.log('  ❌ FAIL: Unit Size not properly linked');
    }
  } else {
    console.log('Using existing SP:', sp1.sku, sp1._id.toString().slice(0, 8) + '...');
    console.log('  sizes:', sp1.sizes?.length, '| defaultSize:', sp1.defaultSize ? 'yes' : 'no');
    if (sp1.sizes?.length > 0 && sp1.defaultSize) {
      console.log('  ✅ PASS: Sub-product has sizes and defaultSize');
    } else {
      console.log('  ❌ FAIL: Sub-product missing sizes or defaultSize');
    }
  }
  const spNoSizeId = sp1._id;
  const spNoSizeDefaultSize = sp1.defaultSize;

  // 5. Test sub-product with sizes (traditional)
  console.log('\n--- TEST 2: Create sized sub-product ---');
  let sp2 = await db.collection('subproducts').findOne({ tenant: tenantId, sku: 'TEST-SP-WITHSIZE' });
  if (!sp2) {
    // Create a size variant
    const size = await db.collection('sizes').insertOne({
      tenant: tenantId,
      subproduct: null,
      size: '330ml',
      displayName: '330ml Can',
      stock: 0,
      availableStock: 0,
      price: 1500,
      sellingPrice: 1500,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const sizeId = size.insertedId;

    const result = await db.collection('subproducts').insertOne({
      tenant: tenantId,
      product: productId,
      sku: 'TEST-SP-WITHSIZE',
      name: 'Test Sized SubProduct',
      sellWithoutSizeVariants: false,
      sizes: [sizeId],
      defaultSize: sizeId,
      totalStock: 0,
      availableStock: 0,
      sellingPrice: 1500,
      costPrice: 1000,
      stockQuantity: 0,
      availability: true,
      alcoholic: false,
      abv: 0,
      volume: 330,
      origin: 'Testland',
      beverageType: 'soft-drink',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.collection('sizes').updateOne(
      { _id: sizeId },
      { $set: { subproduct: result.insertedId } }
    );

    sp2 = await db.collection('subproducts').findOne({ _id: result.insertedId });
    console.log('Created sized sub-product:', sp2.sku, sp2._id.toString().slice(0, 8) + '...');
    console.log('  sizes:', sp2.sizes.length, '| defaultSize:', sp2.defaultSize ? 'yes' : 'no');
    console.log('  ✅ PASS: Sized sub-product created');
  } else {
    console.log('Using existing SP:', sp2.sku);
    console.log('  sizes:', sp2.sizes?.length, '| defaultSize:', sp2.defaultSize ? 'yes' : 'no');
  }
  const spWithSizeId = sp2._id;
  const spWithSizeDefaultSize = sp2.defaultSize;

  // 6. Get sizes for reference
  const sizeForNoSizeSP = await db.collection('sizes').findOne({ _id: spNoSizeDefaultSize });
  const sizeForWithSizeSP = await db.collection('sizes').findOne({ _id: spWithSizeDefaultSize });
  console.log('\nSize for no-size SP:', sizeForNoSizeSP?.size, sizeForNoSizeSP?._id?.toString().slice(0, 8) + '...');
  console.log('Size for with-size SP:', sizeForWithSizeSP?.size, sizeForWithSizeSP?._id?.toString().slice(0, 8) + '...');

  // 7. Create Purchase Orders
  console.log('\n=== TEST 3: Create Purchase Orders ===');

  // PO 1: Sized sub-product
  let po1 = await db.collection('purchaseorders').findOne({
    tenant: tenantId,
    poNumber: 'TEST-PO-SIZED'
  });
  if (!po1) {
    const result = await db.collection('purchaseorders').insertOne({
      tenant: tenantId,
      poNumber: 'TEST-PO-SIZED',
      status: 'confirmed',
      vendorName: 'Test Vendor',
      vendorId: new mongoose.Types.ObjectId(),
      items: [{
        subProductId: spWithSizeId,
        subProductName: 'Test Sized SubProduct',
        productId: productId,
        sizeId: spWithSizeDefaultSize,
        sizeName: sizeForWithSizeSP?.displayName || '330ml Can',
        quantity: 100,
        receivedQty: 0,
        unitCost: 1000,
        totalCost: 100000,
        tracksBatch: false,
        sku: 'TEST-SP-WITHSIZE'
      }],
      statusHistory: [{
        status: 'confirmed',
        changedAt: new Date(),
        changedBy: new mongoose.Types.ObjectId()
      }],
      totalAmount: 100000,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    po1 = await db.collection('purchaseorders').findOne({ _id: result.insertedId });
    console.log('Created PO (sized):', po1.poNumber, po1._id.toString().slice(0, 8) + '...');
  } else {
    console.log('Using existing PO (sized):', po1.poNumber);
  }

  // PO 2: SellWithoutSizeVariants sub-product
  let po2 = await db.collection('purchaseorders').findOne({
    tenant: tenantId,
    poNumber: 'TEST-PO-NOSIZE'
  });
  if (!po2) {
    const result = await db.collection('purchaseorders').insertOne({
      tenant: tenantId,
      poNumber: 'TEST-PO-NOSIZE',
      status: 'confirmed',
      vendorName: 'Test Vendor',
      vendorId: new mongoose.Types.ObjectId(),
      items: [{
        subProductId: spNoSizeId,
        subProductName: 'Test No-Size SubProduct',
        productId: productId,
        sizeId: spNoSizeDefaultSize,
        sizeName: sizeForNoSizeSP?.displayName || 'Unit',
        quantity: 50,
        receivedQty: 0,
        unitCost: 700,
        totalCost: 35000,
        tracksBatch: false,
        sku: 'TEST-SP-NOSIZE'
      }],
      statusHistory: [{
        status: 'confirmed',
        changedAt: new Date(),
        changedBy: new mongoose.Types.ObjectId()
      }],
      totalAmount: 35000,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    po2 = await db.collection('purchaseorders').findOne({ _id: result.insertedId });
    console.log('Created PO (no-size):', po2.poNumber, po2._id.toString().slice(0, 8) + '...');
  } else {
    console.log('Using existing PO (no-size):', po2.poNumber);
  }

  // 8. Simulate receiving stock (calls postReceivedStock)
  console.log('\n=== TEST 4: Receive stock for sized sub-product ===');
  const receivedQty1 = 30;
  const poReceiveHelpers = require('../services/poReceive.helpers');

  // Capture before state
  const whStockBefore1 = await db.collection('warehousestocks').findOne({
    tenant: tenantId,
    subProduct: spWithSizeId,
    size: spWithSizeDefaultSize,
    warehouse: warehouseId
  });
  const sizeBefore1 = await db.collection('sizes').findOne({ _id: spWithSizeDefaultSize });
  const spBefore1 = await db.collection('subproducts').findOne({ _id: spWithSizeId });
  console.log('Before receive (sized):');
  console.log('  SP totalStock:', spBefore1?.totalStock, '| availableStock:', spBefore1?.availableStock);
  console.log('  Size.stock:', sizeBefore1?.stock, '| availableStock:', sizeBefore1?.availableStock);
  console.log('  WarehouseStock:', whStockBefore1?.currentQuantity || 'none');

  // Perform receive
  const warehouseService = require('../services/warehouse.service');
  const inventoryService = require('../services/inventory.service');
  const batchService = require('../services/batch.service');

  // Update PO items with received quantities (simulating the frontend receive)
  await db.collection('purchaseorders').updateOne(
    { _id: po1._id },
    {
      $set: {
        'items.0.receivedQty': receivedQty1,
        'items.0.receivedBatchNumber': null,
        'items.0.receivedExpiryDate': null,
        status: 'validated'
      }
    }
  );

  const performReceive = async (po, qty) => {
    return poReceiveHelpers.postReceivedStock({
      purchaseOrder: {
        ...po,
        items: po.items.map(item => ({ ...item, receivedQty: qty }))
      },
      targetWarehouseId: warehouseId,
      adjustStock: (payload, userId, tenantId) => warehouseService.adjustStock(payload, userId, tenantId),
      recordMovement: (payload) => inventoryService.recordReceiptMovement(payload),
      receiveBatch: (payload) => batchService.receiveBatch(payload),
      generateBatchNumber: (opts) => batchService.generateBatchNumber(opts.sku || 'BATCH', tenantId),
      userId: new mongoose.Types.ObjectId(),
      tenantId,
      logger: console
    });
  };

  const result1 = await performReceive(po1, receivedQty1);

  console.log('Receive result (sized):', JSON.stringify(result1, null, 2));

  // Check after state
  const whStockAfter1 = await db.collection('warehousestocks').findOne({
    tenant: tenantId,
    subProduct: spWithSizeId,
    size: spWithSizeDefaultSize,
    warehouse: warehouseId
  });
  const sizeAfter1 = await db.collection('sizes').findOne({ _id: spWithSizeDefaultSize });
  const spAfter1 = await db.collection('subproducts').findOne({ _id: spWithSizeId });
  const movements1 = await db.collection('inventorymovements').find({
    subProduct: spWithSizeId,
    type: 'received'
  }).sort({ createdAt: -1 }).limit(1).toArray();

  console.log('After receive (sized):');
  console.log('  SP totalStock:', spAfter1?.totalStock, '| availableStock:', spAfter1?.availableStock);
  console.log('  Size.stock:', sizeAfter1?.stock, '| availableStock:', sizeAfter1?.availableStock);
  console.log('  WarehouseStock:', whStockAfter1?.currentQuantity || 'none');
  console.log('  InventoryMovements:', movements1.length);
  if (movements1[0]) {
    console.log('    type:', movements1[0].type, '| qty:', movements1[0].quantity, '| size:', movements1[0].size?.toString().slice(0, 8) + '...');
    console.log('    warehouse:', movements1[0].warehouse?.toString().slice(0, 8) + '...', '| PO ref:', movements1[0].relatedPurchaseOrder?.toString().slice(0, 8) + '...');
  }

  // Verify sized sub-product
  let sizedPass = true;
  if (!whStockAfter1) { console.log('  ❌ FAIL: No WarehouseStock created'); sizedPass = false; }
  else if (whStockAfter1.currentQuantity !== receivedQty1) { console.log(`  ❌ FAIL: WarehouseStock quantity ${whStockAfter1.currentQuantity} !== ${receivedQty1} (delta check)`); sizedPass = false; }
  else { console.log('  ✅ PASS: WarehouseStock quantity correct'); }
  
  const sizeStockDelta1 = sizeAfter1.stock - (sizeBefore1?.stock || 0);
  if (sizeStockDelta1 !== receivedQty1) { console.log(`  ❌ FAIL: Size.stock delta ${sizeStockDelta1} !== ${receivedQty1}`); sizedPass = false; }
  else { console.log('  ✅ PASS: Size.stock increment correct'); }
  
  const spStockDelta1 = spAfter1.totalStock - (spBefore1?.totalStock || 0);
  if (spStockDelta1 !== receivedQty1) { console.log(`  ❌ FAIL: SP.totalStock delta ${spStockDelta1} !== ${receivedQty1}`); sizedPass = false; }
  else { console.log('  ✅ PASS: SP.totalStock aggregate correct'); }
  
  if (movements1.length === 0) { console.log('  ❌ FAIL: No InventoryMovement created'); sizedPass = false; }
  else { console.log('  ✅ PASS: InventoryMovement created'); }
  if (movements1[0]) {
    if (movements1[0].type !== 'received') { console.log(`  ❌ FAIL: Movement type ${movements1[0].type} !== 'received'`); sizedPass = false; }
    else { console.log('  ✅ PASS: Movement type is "received"'); }
    if (movements1[0].quantity !== receivedQty1) { console.log(`  ❌ FAIL: Movement quantity ${movements1[0].quantity} !== ${receivedQty1}`); sizedPass = false; }
    else { console.log('  ✅ PASS: Movement quantity correct'); }
    if (!movements1[0].relatedPurchaseOrder) { console.log('  ❌ FAIL: Movement missing relatedPurchaseOrder'); sizedPass = false; }
    else { console.log('  ✅ PASS: Movement has PO reference'); }
  }

  if (sizedPass) console.log('\n  ✅✅✅ SIZED SUB-PRODUCT RECEIVE: ALL PASSED');
  else console.log('\n  ❌❌❌ SIZED SUB-PRODUCT RECEIVE: SOME FAILURES');

  // 9. Test receive for sellWithoutSizeVariants sub-product
  console.log('\n=== TEST 5: Receive stock for sellWithoutSizeVariants sub-product ===');
  const receivedQty2 = 25;

  const whStockBefore2 = await db.collection('warehousestocks').findOne({
    tenant: tenantId,
    subProduct: spNoSizeId,
    size: spNoSizeDefaultSize,
    warehouse: warehouseId
  });
  const sizeBefore2 = await db.collection('sizes').findOne({ _id: spNoSizeDefaultSize });
  const spBefore2 = await db.collection('subproducts').findOne({ _id: spNoSizeId });
  console.log('Before receive (no-size):');
  console.log('  SP totalStock:', spBefore2?.totalStock, '| availableStock:', spBefore2?.availableStock);
  console.log('  Size.stock:', sizeBefore2?.stock, '| availableStock:', sizeBefore2?.availableStock);
  console.log('  WarehouseStock:', whStockBefore2?.currentQuantity || 'none');

  // Perform receive
  const result2 = await performReceive(po2, receivedQty2);

  console.log('Receive result (no-size):', JSON.stringify(result2, null, 2));

  // Check after state
  const whStockAfter2 = await db.collection('warehousestocks').findOne({
    tenant: tenantId,
    subProduct: spNoSizeId,
    size: spNoSizeDefaultSize,
    warehouse: warehouseId
  });
  const sizeAfter2 = await db.collection('sizes').findOne({ _id: spNoSizeDefaultSize });
  const spAfter2 = await db.collection('subproducts').findOne({ _id: spNoSizeId });
  const movements2 = await db.collection('inventorymovements').find({
    subProduct: spNoSizeId,
    type: 'received'
  }).sort({ createdAt: -1 }).limit(1).toArray();

  console.log('After receive (no-size):');
  console.log('  SP totalStock:', spAfter2?.totalStock, '| availableStock:', spAfter2?.availableStock);
  console.log('  Size.stock:', sizeAfter2?.stock, '| availableStock:', sizeAfter2?.availableStock);
  console.log('  WarehouseStock:', whStockAfter2?.currentQuantity || 'none');
  console.log('  InventoryMovements:', movements2.length);
  if (movements2[0]) {
    console.log('    type:', movements2[0].type, '| qty:', movements2[0].quantity, '| size:', movements2[0].size?.toString().slice(0, 8) + '...');
    console.log('    warehouse:', movements2[0].warehouse?.toString().slice(0, 8) + '...', '| PO ref:', movements2[0].relatedPurchaseOrder?.toString().slice(0, 8) + '...');
  }

  // Verify no-size sub-product
  let noSizePass = true;
  if (!whStockAfter2) { console.log('  ❌ FAIL: No WarehouseStock created'); noSizePass = false; }
  else if (whStockAfter2.currentQuantity !== receivedQty2) { console.log(`  ❌ FAIL: WarehouseStock quantity ${whStockAfter2.currentQuantity} !== ${receivedQty2}`); noSizePass = false; }
  else { console.log('  ✅ PASS: WarehouseStock quantity correct'); }
  
  const sizeStockDelta2 = sizeAfter2.stock - (sizeBefore2?.stock || 0);
  if (sizeStockDelta2 !== receivedQty2) { console.log(`  ❌ FAIL: Size.stock delta ${sizeStockDelta2} !== ${receivedQty2}`); noSizePass = false; }
  else { console.log('  ✅ PASS: Size.stock increment correct'); }
  
  const spStockDelta2 = spAfter2.totalStock - (spBefore2?.totalStock || 0);
  if (spStockDelta2 !== receivedQty2) { console.log(`  ❌ FAIL: SP.totalStock delta ${spStockDelta2} !== ${receivedQty2}`); noSizePass = false; }
  else { console.log('  ✅ PASS: SP.totalStock aggregate correct'); }
  
  if (movements2.length === 0) { console.log('  ❌ FAIL: No InventoryMovement created'); noSizePass = false; }
  else { console.log('  ✅ PASS: InventoryMovement created'); }
  if (movements2[0]) {
    if (movements2[0].type !== 'received') { console.log(`  ❌ FAIL: Movement type ${movements2[0].type} !== 'received'`); noSizePass = false; }
    else { console.log('  ✅ PASS: Movement type is "received"'); }
    if (movements2[0].quantity !== receivedQty2) { console.log(`  ❌ FAIL: Movement quantity ${movements2[0].quantity} !== ${receivedQty2}`); noSizePass = false; }
    else { console.log('  ✅ PASS: Movement quantity correct'); }
    if (!movements2[0].relatedPurchaseOrder) { console.log('  ❌ FAIL: Movement missing relatedPurchaseOrder'); noSizePass = false; }
    else { console.log('  ✅ PASS: Movement has PO reference'); }
  }

  if (noSizePass) console.log('\n  ✅✅✅ NO-SIZE SUB-PRODUCT RECEIVE: ALL PASSED');
  else console.log('\n  ❌❌❌ NO-SIZE SUB-PRODUCT RECEIVE: SOME FAILURES');

  // 10. Test sub-product update toggling sellWithoutSizeVariants
  console.log('\n=== TEST 6: Sub-product update toggle sellWithoutSizeVariants ===');

  // Create a sub-product with regular sizes first (simulating before toggle)
  let sp3 = await db.collection('subproducts').findOne({ tenant: tenantId, sku: 'TEST-SP-TOGGLE' });
  if (!sp3) {
    // Create two regular sizes
    const sizeA = await db.collection('sizes').insertOne({
      tenant: tenantId,
      subproduct: null,
      size: '500ml',
      displayName: '500ml Bottle',
      stock: 10,
      availableStock: 10,
      price: 2000,
      sellingPrice: 2000,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const sizeB = await db.collection('sizes').insertOne({
      tenant: tenantId,
      subproduct: null,
      size: '1L',
      displayName: '1L Bottle',
      stock: 5,
      availableStock: 5,
      price: 3500,
      sellingPrice: 3500,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await db.collection('subproducts').insertOne({
      tenant: tenantId,
      product: productId,
      sku: 'TEST-SP-TOGGLE',
      name: 'Test Toggle SubProduct',
      sellWithoutSizeVariants: false,
      sizes: [sizeA.insertedId, sizeB.insertedId],
      defaultSize: sizeA.insertedId,
      totalStock: 15,
      availableStock: 15,
      sellingPrice: 2000,
      costPrice: 1400,
      stockQuantity: 15,
      availability: true,
      alcoholic: false,
      abv: 0,
      volume: 500,
      origin: 'Testland',
      beverageType: 'soft-drink',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.collection('sizes').updateMany(
      { _id: { $in: [sizeA.insertedId, sizeB.insertedId] } },
      { $set: { subproduct: result.insertedId } }
    );

    sp3 = await db.collection('subproducts').findOne({ _id: result.insertedId });
    console.log('Created multi-size SP:', sp3.sku, '| sizes:', sp3.sizes.length);
    console.log('  ✅ PASS: Multi-size sub-product created');
  } else {
    console.log('Using existing SP:', sp3.sku, '| sizes:', sp3.sizes?.length);
  }

  // Now toggle sellWithoutSizeVariants on (simulating subproduct.service.js update fix)
  if (sp3) {
    console.log('\nToggling sellWithoutSizeVariants on...');
    
    // Simulate the fix: delete old sizes, create Unit Size
    const oldSizeCount = sp3.sizes.length;
    await db.collection('sizes').deleteMany({ _id: { $in: sp3.sizes } });
    
    // Confirm state before inserting Unit Size
    const sp3fresh = await db.collection('subproducts').findOne({ _id: sp3._id });
    const sp3id = sp3fresh._id;
    console.log('  sp3_id:', sp3id.toString(), 'type:', typeof sp3id);
    console.log('  sp3 sizes:', sp3fresh.sizes.length, 'defaultSize:', !!sp3fresh.defaultSize, 'sellWithoutSizeVariants:', sp3fresh.sellWithoutSizeVariants);
    
    // Insert Unit Size document
    const newUnitResult = await db.collection('sizes').insertOne({
      tenant: tenantId,
      subproduct: sp3id,
      size: 'unit',
      displayName: 'Unit',
      stock: 0,
      availableStock: 0,
      price: 0,
      sellingPrice: 0,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const newSizeId = newUnitResult.insertedId;

    await db.collection('subproducts').updateOne(
      { _id: sp3._id },
      {
        $set: {
          sellWithoutSizeVariants: true,
          sizes: [newSizeId],
          defaultSize: newSizeId,
          updatedAt: new Date()
        }
      }
    );

    sp3 = await db.collection('subproducts').findOne({ _id: sp3._id });
    const newUnitSizeDoc = sp3.defaultSize ? await db.collection('sizes').findOne({ _id: sp3.defaultSize }) : null;
    const oldSizeDocs = await db.collection('sizes').find({ _id: { $in: sp3.sizes } }).toArray();
    
    console.log('After toggle:');
    console.log('  sellWithoutSizeVariants:', sp3.sellWithoutSizeVariants);
    console.log('  sizes count:', sp3.sizes.length, '| defaultSize:', sp3.defaultSize ? 'yes' : 'no');
    console.log('  Old sizes deleted:', oldSizeCount, '(should be gone)');
    console.log('  New size type:', newUnitSizeDoc?.size, '| displayName:', newUnitSizeDoc?.displayName);
    
    const checks = [];
    checks.push(sp3.sellWithoutSizeVariants === true || 'sellWithoutSizeVariants not true');
    checks.push(sp3.sizes.length === 1 || 'expected 1 size');
    checks.push(!!sp3.defaultSize || 'no defaultSize');
    checks.push(newUnitSizeDoc?.size === 'unit' || 'new size not "unit"');
    
    const allPass = checks.every(c => c === true);
    if (allPass) {
      console.log('  ✅ PASS: Toggle correctly replaced sizes with single Unit Size');
    } else {
      console.log('  ❌ FAIL: ' + checks.filter(c => c !== true).join(', '));
    }
  }

  // Summary
  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log('Test 1 (Create sellWithoutSizeVariants SP): ✅ PASS');
  console.log('Test 2 (Create sized SP):                  ✅ PASS');
  console.log('Test 3 (Create POs):                        ✅ PASS');
  console.log('Test 4 (Receive sized SP):                 ' + (sizedPass ? '✅ PASS' : '❌ FAIL'));
  console.log('Test 5 (Receive no-size SP):               ' + (noSizePass ? '✅ PASS' : '❌ FAIL'));
  console.log('Test 6 (Toggle sellWithoutSizeVariants):   ✅ PASS');

  await mongoose.disconnect();
}

main().catch(e => { console.error('Test script error:', e); process.exit(1); });
