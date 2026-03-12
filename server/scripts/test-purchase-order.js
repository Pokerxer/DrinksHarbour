// Test script for purchase order functionality with inventory
require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour');
  
  const Tenant = require('../models/tenant');
  const User = require('../models/User');
  const SubProduct = require('../models/SubProduct');
  const Size = require('../models/Size');
  const PurchaseOrder = require('../models/PurchaseOrder');
  const Vendor = require('../models/Vendor');
  const jwt = require('jsonwebtoken');

  // Create or find test tenant
  let tenant = await Tenant.findOne({ name: 'Test Bar' });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Test Bar',
      slug: 'testbar',
      email: 'test@test.com',
      phone: '1234567890',
      address: 'Test Address',
      subscription: { plan: 'professional', status: 'active' }
    });
    console.log('Created tenant:', tenant.name);
  }

  // Create or find test vendor
  let vendor = await Vendor.findOne({ name: 'Test Vendor', tenant: tenant._id });
  if (!vendor) {
    vendor = await Vendor.create({
      name: 'Test Vendor',
      tenant: tenant._id,
      email: 'vendor@test.com',
      phone: '1234567890',
      status: 'active'
    });
    console.log('Created vendor:', vendor.name);
  }

  // Note: Warehouse creation is skipped - inventory service will work without warehouse
  // If you have a proper warehouse setup, uncomment below:
  /*
  let warehouse = await Warehouse.findOne({ tenant: tenant._id, isDefault: true });
  if (!warehouse) {
    warehouse = await Warehouse.create({
      name: 'Main Warehouse',
      tenant: tenant._id,
      isDefault: true,
      status: 'active'
    });
    console.log('Created warehouse:', warehouse.name);
  }
  */

  // Create or find test user
  let user = await User.findOne({ email: 'testbar@admin.com' });
  if (!user) {
    user = await User.create({
      email: 'testbar@admin.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'tenant_admin',
      tenant: tenant._id,
      status: 'active'
    });
    console.log('Created user:', user.email);
  }

  // Find or create test product (required for subProduct)
  const Product = require('../models/Product');
  let product = await Product.findOne({ name: 'Test Beer Product' });
  if (!product) {
    product = await Product.create({
      name: 'Test Beer Product',
      slug: 'test-beer-product',
      type: 'beer',
      alcoholic: true,
      status: 'approved'
    });
    console.log('Created product:', product.name);
  }

  // Find or create test subproduct
  let subProduct = await SubProduct.findOne({ tenant: tenant._id, sku: 'TEST-BEER-001' });
  if (!subProduct) {
    subProduct = await SubProduct.create({
      name: 'Test Beer',
      sku: 'TEST-BEER-001',
      tenant: tenant._id,
      product: product._id,
      baseSellingPrice: 500,
      costPrice: 300,
      sellingPrice: 500,
      stockQuantity: 0,
      totalStock: 0,
      status: 'active'
    });
  }
  console.log('Using subProduct:', subProduct.name, 'stock:', subProduct.totalStock);

  // Find or create test size
  let size = await Size.findOne({ subproduct: subProduct._id, size: 'bottle-500ml' });
  if (!size) {
    size = await Size.create({
      subproduct: subProduct._id,
      size: 'bottle-500ml',
      volume: 500,
      ml: 500,
      stock: 0,
      currentStock: 0,
      status: 'active'
    });
  }
  console.log('Using size:', size.size, 'stock:', size.currentStock);

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, tenant: tenant._id },
    process.env.JWT_SECRET || 'test-secret-key',
    { expiresIn: '7d' }
  );

  console.log('\n--- Test Token ---');
  console.log(token);

  const { default: fetch } = await import('node-fetch');

  // Step 1: Create PO
  console.log('\n=== Step 1: Create PO ===');
  const poData = {
    poNumber: `PO-${Date.now()}`,
    vendor: vendor._id,
    vendorName: vendor.name,
    items: [
      {
        subProductId: subProduct._id.toString(),
        sizeId: size._id.toString(),
        quantity: 10,
        unitCost: 300,
        totalCost: 3000
      }
    ],
    expectedArrival: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };

  let poResponse = await fetch('http://localhost:5001/api/purchase-orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(poData)
  });
  
  let poResult = await poResponse.json();
  console.log('Create PO:', poResult.success ? '✅ Success' : '❌ Failed', poResult.message || '');
  
  if (!poResult.success || !poResult.data?._id) {
    console.log('Failed to create PO. Response:', JSON.stringify(poResult, null, 2));
    process.exit(1);
  }
  
  const poId = poResult.data._id;
  console.log('PO ID:', poId, 'Status:', poResult.data.status);

  // Step 2: Approve PO
  console.log('\n=== Step 2: Approve PO ===');
  let approveResponse = await fetch(`http://localhost:5001/api/purchase-orders/${poId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ notes: 'Approved for testing' })
  });
  
  let approveResult = await approveResponse.json();
  console.log('Approve PO:', approveResult.success ? '✅ Success' : '❌ Failed', approveResult.message || '');
  console.log('PO Status after approve:', approveResult.data?.approvalStatus);

  // Step 3: Confirm PO
  console.log('\n=== Step 3: Confirm PO ===');
  let confirmResponse = await fetch(`http://localhost:5001/api/purchase-orders/${poId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'confirmed' })
  });
  
  let confirmResult = await confirmResponse.json();
  console.log('Confirm PO:', confirmResult.success ? '✅ Success' : '❌ Failed', confirmResult.message || '');
  console.log('PO Status after confirm:', confirmResult.data?.status);

  // Step 4: Receive items
  console.log('\n=== Step 4: Receive Items ===');
  let receiveResponse = await fetch(`http://localhost:5001/api/purchase-orders/${poId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      status: 'received',
      receivedItems: [
        { itemId: poResult.data.items[0]._id, receivedQty: 10 }
      ]
    })
  });
  
  let receiveResult = await receiveResponse.json();
  console.log('Receive PO:', receiveResult.success ? '✅ Success' : '❌ Failed', receiveResult.message || '');
  console.log('PO Status after receive:', receiveResult.data?.status);
  console.log('Item receivedQty:', receiveResult.data?.items?.[0]?.receivedQty);

  // Check stock BEFORE validation
  subProduct = await SubProduct.findById(subProduct._id);
  size = await Size.findById(size._id);
  console.log('\n📊 Stock BEFORE validation:');
  console.log('  SubProduct totalStock:', subProduct.totalStock);
  console.log('  Size currentStock:', size.currentStock);

  // Step 5: Validate PO (THIS SHOULD ADD INVENTORY)
  console.log('\n=== Step 5: Validate PO (Add Inventory) ===');
  let validateResponse = await fetch(`http://localhost:5001/api/purchase-orders/${poId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'validated' })
  });
  
  let validateResult = await validateResponse.json();
  console.log('Validate PO:', validateResult.success ? '✅ Success' : '❌ Failed', validateResult.message || '');
  console.log('PO Status after validate:', validateResult.data?.status);

  // Check stock AFTER validation - re-fetch from DB
  const finalSubProduct = await SubProduct.findById(subProduct._id);
  const sizeDoc = await Size.findById(size._id);
  
  console.log('\n📊 Stock AFTER validation:');
  console.log('  SubProduct totalStock:', finalSubProduct.totalStock);
  console.log('  Size collection currentStock:', sizeDoc?.currentStock, sizeDoc?.currentStock === 10 ? '✅' : '❌');
  console.log('  Size collection stock:', sizeDoc?.stock);

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});