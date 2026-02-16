// Final test script to send all 3 emails to jrwaldehzx@gmail.com
require('dotenv').config();

const nodemailer = require('nodemailer');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const mockOrder = {
  orderNumber: 'DH-TEST-001',
  subtotal: 9500,
  discountTotal: 0,
  shippingFee: 0,
  totalAmount: 9500,
  platformCommissionTotal: 1000,
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
      product: { name: 'Johnnie Walker Black Label', images: [{ url: 'https://via.placeholder.com/60' }] },
      size: { name: '750ml' },
      tenant: { name: 'Premium Spirits Ltd', _id: '507f1f77bcf86cd799439011' },
      quantity: 2,
      priceAtPurchase: 4000,
      itemSubtotal: 8000,
      tenantRevenueShare: 3600,
      platformCommission: 400,
      tenantRevenueModel: 'commission',
      tenantCommissionPercentage: 10,
    },
    {
      product: { name: 'Hennessy VSOP', images: [{ url: 'https://via.placeholder.com/60' }] },
      size: { name: '700ml' },
      tenant: { name: 'African Wines & Spirits', _id: '507f1f77bcf86cd799439022' },
      quantity: 1,
      priceAtPurchase: 1500,
      itemSubtotal: 1500,
      tenantRevenueShare: 1071,
      platformCommission: 429,
      tenantRevenueModel: 'markup',
      tenantMarkupPercentage: 40,
    },
  ],
};

const customer = { firstName: 'John', lastName: 'Doe', email: 'jrwaldehzx@gmail.com', phone: '+234 801 234 5678' };

async function sendEmails() {
  console.log('🚀 Sending sample emails to jrwaldehzx@gmail.com...\n');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SENDER_EMAIL_ADDRESS,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  // 1. CUSTOMER EMAIL
  const customerEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Order Confirmation</title>
</head>
<body style="font-family: 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 40px; text-align: center;">
    <h1 style="color: #fff; margin: 0;">🍾 DrinksHarbour</h1>
    <p style="color: #9ca3af; margin: 8px 0 0;">Premium Beverage Shopping</p>
  </div>
  
  <div style="padding: 40px; background: #fff;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="font-size: 28px; color: #111827; margin: 0 0 8px;">🎉 Order Confirmed!</h2>
      <p style="color: #6b7280;">Thank you for your order, ${customer.firstName}!</p>
    </div>
    
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #fff; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 12px; text-transform: uppercase;">Order Number</p>
      <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold;">#${mockOrder.orderNumber}</p>
    </div>
    
    <h3 style="color: #111827;">Items Ordered</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px; text-align: left;">Product</th>
          <th style="padding: 12px; text-align: center;">Qty</th>
          <th style="padding: 12px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${mockOrder.items.map(item => `
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
              <strong>${item.product.name}</strong><br>
              <span style="color: #6b7280; font-size: 13px;">${item.size.name} • ${item.tenant.name}</span>
            </td>
            <td style="padding: 16px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <span style="background: #f3f4f6; padding: 4px 12px; border-radius: 6px;">${item.quantity}</span>
            </td>
            <td style="padding: 16px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold;">
              ${formatCurrency(item.priceAtPurchase * item.quantity)}
            </td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 16px; text-align: right;">Subtotal</td>
          <td style="padding: 16px; text-align: right;">${formatCurrency(mockOrder.subtotal)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 16px; text-align: right;">Shipping</td>
          <td style="padding: 16px; text-align: right;">FREE</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td colspan="2" style="padding: 16px; text-align: right; font-weight: bold;">Total</td>
          <td style="padding: 16px; text-align: right; font-weight: bold; font-size: 20px;">${formatCurrency(mockOrder.totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
    
    <div style="margin-top: 24px; padding: 20px; background: #f9fafb; border-radius: 12px; border-left: 4px solid #4f46e5;">
      <strong>Shipping Address</strong><br>
      ${mockOrder.shippingAddress.fullName}<br>
      ${mockOrder.shippingAddress.addressLine1}<br>
      ${mockOrder.shippingAddress.city}, ${mockOrder.shippingAddress.state} ${mockOrder.shippingAddress.postalCode}
    </div>
  </div>
  
  <div style="background: #111827; padding: 32px; text-align: center; color: #9ca3af;">
    <p>Thank you for shopping with DrinksHarbour!</p>
    <p style="opacity: 0.6;">© 2025 DrinksHarbour. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  // 2. VENDOR EMAIL
  const vendorItem = mockOrder.items[0];
  const vendorEarnings = vendorItem.tenantRevenueShare * vendorItem.quantity;
  const vendorCommission = vendorItem.platformCommission * vendorItem.quantity;
  
  const vendorEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>New Order - Vendor</title>
</head>
<body style="font-family: 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px; text-align: center;">
    <h1 style="color: #fff; margin: 0;">🍾 DrinksHarbour</h1>
    <p style="color: #d1fae5; margin: 8px 0 0;">Partner Dashboard</p>
  </div>
  
  <div style="padding: 40px; background: #fff;">
    <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
      <h2 style="color: #065f46; margin: 0 0 8px;">🛒 New Order Received!</h2>
      <p style="color: #047857; margin: 0;">You have a new order to fulfill</p>
    </div>
    
    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #059669;">
      <h3 style="color: #065f46; margin: 0 0 16px;">💰 Your Earnings Summary</h3>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0;">Total Sales (Customer Paid)</td>
          <td style="padding: 8px 0; text-align: right;">${formatCurrency(vendorItem.itemSubtotal)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Platform Commission (${vendorItem.tenantCommissionPercentage}%)</td>
          <td style="padding: 8px 0; text-align: right; color: #6b7280;">-${formatCurrency(vendorCommission)}</td>
        </tr>
        <tr style="border-top: 2px solid #059669;">
          <td style="padding: 12px 0; font-weight: bold; color: #065f46;">Your Earnings</td>
          <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #065f46;">${formatCurrency(vendorEarnings)}</td>
        </tr>
      </table>
    </div>
    
    <div style="margin-top: 24px;">
      <h3>Customer Details</h3>
      <p><strong>${customer.firstName} ${customer.lastName}</strong></p>
      <p>${customer.email}</p>
      <p>${customer.phone}</p>
    </div>
  </div>
</body>
</html>
  `;

  // 3. ADMIN EMAIL
  const totalVendorEarnings = mockOrder.items.reduce((sum, item) => sum + (item.tenantRevenueShare * item.quantity), 0);
  
  const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>New Order - Admin</title>
</head>
<body style="font-family: 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px; text-align: center;">
    <h1 style="color: #fff; margin: 0;">🔐 DrinksHarbour</h1>
    <p style="color: #bfdbfe; margin: 8px 0 0;">Admin Dashboard</p>
  </div>
  
  <div style="padding: 40px; background: #fff;">
    <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
      <h2 style="color: #1e40af; margin: 0 0 8px;">🛍️ New Platform Order</h2>
      <p style="color: #1d4ed8; margin: 0;">#${mockOrder.orderNumber}</p>
    </div>
    
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #f59e0b;">
      <h3 style="color: #92400e; margin: 0 0 16px;">💰 Revenue Breakdown</h3>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold;">Total Customer Paid</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${formatCurrency(mockOrder.totalAmount)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Total to Vendors</td>
          <td style="padding: 8px 0; text-align: right;">${formatCurrency(totalVendorEarnings)}</td>
        </tr>
        <tr style="border-top: 2px solid #f59e0b;">
          <td style="padding: 12px 0; font-weight: bold; color: #059669;">Platform Revenue</td>
          <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #059669;">${formatCurrency(mockOrder.platformCommissionTotal)}</td>
        </tr>
      </table>
    </div>
    
    <h3 style="margin-top: 24px;">Vendor Breakdown</h3>
    ${mockOrder.items.map(item => `
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
        <strong>${item.tenant.name}</strong>
        <span style="float: right; background: ${item.tenantRevenueModel === 'commission' ? '#dbeafe' : '#d1fae5'}; color: ${item.tenantRevenueModel === 'commission' ? '#1e40af' : '#065f46'}; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
          ${item.tenantRevenueModel === 'commission' ? item.tenantCommissionPercentage + '% commission' : item.tenantMarkupPercentage + '% markup'}
        </span>
        <div style="margin-top: 8px; font-size: 13px; color: #6b7280;">
          Customer: ${formatCurrency(item.itemSubtotal)} | Earnings: ${formatCurrency(item.tenantRevenueShare * item.quantity)}
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;

  try {
    // Send Customer Email
    console.log('📧 1. Sending CUSTOMER order confirmation...');
    await transporter.sendMail({
      from: `"DrinksHarbour" <${process.env.SENDER_EMAIL_ADDRESS}>`,
      to: customer.email,
      subject: `🎉 Order Confirmed! #${mockOrder.orderNumber} - DrinksHarbour`,
      html: customerEmailHtml,
    });
    console.log('   ✅ Sent to:', customer.email);

    // Send Vendor Email
    console.log('\n📧 2. Sending VENDOR notification...');
    await transporter.sendMail({
      from: `"DrinksHarbour" <${process.env.SENDER_EMAIL_ADDRESS}>`,
      to: customer.email, // Sending to same for demo
      subject: `🛒 New Order #${mockOrder.orderNumber} - Your Earnings: ${formatCurrency(vendorEarnings)}`,
      html: vendorEmailHtml,
    });
    console.log('   ✅ Sent to:', customer.email);

    // Send Admin Email
    console.log('\n📧 3. Sending ADMIN notification...');
    await transporter.sendMail({
      from: `"DrinksHarbour" <${process.env.SENDER_EMAIL_ADDRESS}>`,
      to: process.env.ADMIN_EMAIL || customer.email,
      subject: `🔔 [Admin] New Order #${mockOrder.orderNumber} - Revenue: ${formatCurrency(mockOrder.totalAmount)} | Commission: ${formatCurrency(mockOrder.platformCommissionTotal)}`,
      html: adminEmailHtml,
    });
    console.log('   ✅ Sent to:', process.env.ADMIN_EMAIL || customer.email);

    console.log('\n✨ All 3 emails sent successfully to jrwaldehzx@gmail.com!');
    console.log('\n📊 Order Summary:');
    console.log(`   Order: ${mockOrder.orderNumber}`);
    console.log(`   Total: ${formatCurrency(mockOrder.totalAmount)}`);
    console.log(`   Platform Commission: ${formatCurrency(mockOrder.platformCommissionTotal)}`);
    console.log('\n💰 Revenue by Vendor:');
    mockOrder.items.forEach(item => {
      const earnings = item.tenantRevenueShare * item.quantity;
      console.log(`   ${item.tenant.name}: ${formatCurrency(earnings)} (${item.tenantRevenueModel})`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendEmails();
