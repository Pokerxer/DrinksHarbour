// Test script to send sample emails
const mongoose = require('mongoose');
require('dotenv').config();

// Mock order data for testing - Correct totals
const mockOrder = {
  _id: new mongoose.Types.ObjectId(),
  orderNumber: 'DH-TEST-001',
  status: 'pending',
  paymentStatus: 'pending',
  subtotal: 9500,
  discountTotal: 0,
  shippingFee: 0,
  totalAmount: 9500,
  platformCommissionTotal: 1000,
  currency: 'NGN',
  paymentMethod: 'cash_on_delivery',
  placedAt: new Date(),
  shippingAddress: {
    fullName: 'John Doe',
    email: 'jrwaldehzx@gmail.com',
    phone: '+234 801 234 5678',
    addressLine1: '123 Victoria Island',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    postalCode: '101241',
  },
  items: [
    {
      product: {
        name: 'Johnnie Walker Black Label',
        slug: 'johnnie-walker-black-label',
        images: [{ url: 'https://via.placeholder.com/60' }],
      },
      subproduct: { name: '750ml Bottle', sku: 'JW-BL-750' },
      size: { name: '750ml' },
      tenant: {
        name: 'Premium Spirits Ltd',
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
      },
      quantity: 2,
      priceAtPurchase: 4000,
      itemSubtotal: 8000,
      discountAmount: 0,
      tenantRevenueShare: 3600,  // 90% of 4000 (10% commission)
      platformCommission: 400,    // 10% of 4000
      tenantRevenueModel: 'commission',
      tenantCommissionPercentage: 10,
      tenantMarkupPercentage: 40,
    },
    {
      product: {
        name: 'Hennessy VSOP',
        slug: 'hennessy-vsop',
        images: [{ url: 'https://via.placeholder.com/60' }],
      },
      subproduct: { name: '700ml Bottle', sku: 'HV-VSOP-700' },
      size: { name: '700ml' },
      tenant: {
        name: 'African Wines & Spirits',
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439022'),
      },
      quantity: 1,
      priceAtPurchase: 1500,
      itemSubtotal: 1500,
      discountAmount: 0,
      tenantRevenueShare: 1071,  // 1500 / 1.4 = ~1071 (40% markup)
      platformCommission: 429,    // 1500 - 1071 = ~429
      tenantRevenueModel: 'markup',
      tenantCommissionPercentage: 10,
      tenantMarkupPercentage: 40,
    },
  ],
};

const mockCustomer = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'jrwaldehzx@gmail.com',
  phone: '+234 801 234 5678',
};

const mockTenant = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Premium Spirits Ltd',
  email: 'jrwaldehzx@gmail.com',
  revenueModel: 'commission',
  commissionPercentage: 10,
  markupPercentage: 40,
};

const mockAdmin = {
  email: 'jrwaldehzx@gmail.com',
};

async function sendTestEmails() {
  try {
    // Initialize email service first
    console.log('🚀 Starting email test...\n');

    // Import email service
    const {
      sendOrderConfirmationToCustomer,
      sendNewOrderNotificationToTenant,
      sendNewOrderNotificationToAdmin,
    } = require('./services/email.service');

    console.log('📧 1. Sending customer order confirmation...');
    const customerResult = await sendOrderConfirmationToCustomer(mockOrder, mockCustomer);
    console.log('✅ Customer email sent:', customerResult.messageId || 'dev mode');

    console.log('\n📧 2. Sending vendor notification...');
    const vendorResult = await sendNewOrderNotificationToTenant(mockOrder, mockTenant, mockCustomer);
    console.log('✅ Vendor email sent:', vendorResult.messageId || 'dev mode');

    console.log('\n📧 3. Sending admin notification...');
    const adminResult = await sendNewOrderNotificationToAdmin(mockOrder, mockCustomer);
    console.log('✅ Admin email sent:', adminResult.messageId || 'dev mode');

    console.log('\n✨ All test emails sent successfully!');
    console.log('\n📋 Order Summary:');
    console.log(`   Order Number: ${mockOrder.orderNumber}`);
    console.log(`   Total: ₦${mockOrder.totalAmount.toLocaleString()}`);
    console.log(`   Items: ${mockOrder.items.length}`);
    console.log(`   Platform Commission: ₦${mockOrder.platformCommissionTotal.toLocaleString()}`);
    console.log('\n📧 Breakdown by Vendor:');
    mockOrder.items.forEach(item => {
      const earnings = item.tenantRevenueShare * item.quantity;
      const commission = item.platformCommission * item.quantity;
      console.log(`   ${item.tenant.name}:`);
      console.log(`     - Model: ${item.tenantRevenueModel} (${item.tenantRevenueModel === 'commission' ? item.tenantCommissionPercentage + '% commission' : item.tenantMarkupPercentage + '% markup'})`);
      console.log(`     - Earnings: ₦${earnings.toLocaleString()}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error sending emails:', error);
    process.exit(1);
  }
}

sendTestEmails();
