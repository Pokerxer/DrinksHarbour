// services/email.service.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// Email sending status
let emailServiceReady = false;
let transporter = null;

// Check if Google OAuth credentials are properly configured
const hasGoogleOAuth = process.env.MAILING_SERVICE_CLIENT_ID && 
                      process.env.MAILING_SERVICE_CLIENT_SECRET &&
                      process.env.MAILING_REFRESH_TOKEN &&
                      !process.env.MAILING_SERVICE_CLIENT_ID?.includes('your-');

// Check if simple SMTP credentials are configured
const hasSimpleSMTP = process.env.MAIL_PASSWORD && 
                     !process.env.MAIL_PASSWORD?.includes('your-');

// Initialize email service
const initializeEmailService = async () => {
  // Try simple SMTP first (with app password)
  if (hasSimpleSMTP) {
    try {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SENDER_EMAIL_ADDRESS,
          pass: process.env.MAIL_PASSWORD,
        },
      });

      // Test connection
      await transporter.verify();
      emailServiceReady = true;
      console.log('✅ Email service initialized (Simple SMTP)');
      return;
    } catch (error) {
      console.log('⚠️  Simple SMTP failed:', error.message);
    }
  }

  // Fall back to Google OAuth2
  if (hasGoogleOAuth) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.MAILING_SERVICE_CLIENT_ID,
        process.env.MAILING_SERVICE_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.MAILING_REFRESH_TOKEN,
      });

      // Try to get access token
      await oauth2Client.getAccessToken();

      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.SENDER_EMAIL_ADDRESS,
          clientId: process.env.MAILING_SERVICE_CLIENT_ID,
          clientSecret: process.env.MAILING_SERVICE_CLIENT_SECRET,
          refreshToken: process.env.MAILING_REFRESH_TOKEN,
          accessToken: oauth2Client.getAccessToken(),
        },
      });

      emailServiceReady = true;
      console.log('✅ Email service initialized (Google OAuth2)');
      return;
    } catch (error) {
      console.log('⚠️  Google OAuth2 failed:', error.message);
    }
  }

  // No credentials configured
  console.log('⚠️  Mailing service not configured, using development mode');
  emailServiceReady = false;
};

// Initialize on module load
initializeEmailService();

// Helper function for formatting Nigerian Naira
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

// Helper function for date formatting
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Helper function for payment status badge
const getPaymentStatusBadge = (status) => {
  const styles = {
    pending: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    paid: { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
    failed: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
    refunded: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  };
  
  const style = styles[status?.toLowerCase()] || styles.pending;
  
  return `
    <span style="
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background-color: ${style.bg};
      color: ${style.text};
      border: 1px solid ${style.border};
      text-transform: capitalize;
    ">${status || 'Pending'}</span>
  `;
};

// Helper function for order status badge
const getOrderStatusBadge = (status) => {
  const styles = {
    pending: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    processing: { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa' },
    shipped: { bg: '#e0e7ff', text: '#3730a3', border: '#818cf8' },
    delivered: { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
    cancelled: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  };
  
  const style = styles[status?.toLowerCase()] || styles.pending;
  
  return `
    <span style="
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background-color: ${style.bg};
      color: ${style.text};
      border: 1px solid ${style.border};
      text-transform: capitalize;
    ">${status || 'Pending'}</span>
  `;
};

// Helper function to calculate vendor totals for an order
const calculateVendorTotals = (order, tenantId) => {
  const vendorItems = order.items?.filter(item => {
    const itemTenantId = item.tenant?._id?.toString() || item.tenant?.toString();
    return itemTenantId === tenantId?.toString();
  }) || order.items || [];
  
  // Use the actual stored tenantRevenueShare (already calculated correctly in order controller)
  const customerSubtotal = vendorItems.reduce((sum, item) => sum + (item.itemSubtotal || 0), 0);
  const vendorEarnings = vendorItems.reduce((sum, item) => sum + (item.tenantRevenueShare || 0), 0);
  const platformCommission = vendorItems.reduce((sum, item) => sum + (item.platformCommission || 0), 0);
  const itemDiscounts = vendorItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  const itemCount = vendorItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // Verify: customerSubtotal should equal vendorEarnings + platformCommission + itemDiscounts
  const verification = customerSubtotal - vendorEarnings - platformCommission - itemDiscounts;
  
  return {
    items: vendorItems,
    customerSubtotal,
    vendorEarnings,
    platformCommission,
    itemDiscounts,
    itemCount,
    verification, // Should be 0
  };
};

// Helper function to calculate overall order breakdown
const calculateOrderBreakdown = (order) => {
  const totalCustomerPaid = order.items?.reduce((sum, item) => sum + (item.itemSubtotal || 0), 0) || 0;
  const totalVendorEarnings = order.items?.reduce((sum, item) => sum + (item.tenantRevenueShare || 0), 0) || 0;
  const totalDiscounts = order.items?.reduce((sum, item) => sum + (item.discountAmount || 0), 0) || 0;
  // Use the actual stored platform commission
  const platformCommission = order.platformCommissionTotal || order.items?.reduce((sum, item) => sum + (item.platformCommission || 0), 0) || 0;
  const totalCommissionFromItems = order.items?.reduce((sum, item) => sum + (item.platformCommission || 0), 0) || 0;
  
  // Group items by tenant for admin view
  const itemsByTenant = {};
  order.items?.forEach(item => {
    const tenantId = item.tenant?._id?.toString() || item.tenant?.toString() || 'no-tenant';
    if (!itemsByTenant[tenantId]) {
      itemsByTenant[tenantId] = {
        items: [],
        customerTotal: 0,
        vendorEarnings: 0,
        platformCommission: 0,
      };
    }
    itemsByTenant[tenantId].items.push(item);
    itemsByTenant[tenantId].customerTotal += item.itemSubtotal || 0;
    itemsByTenant[tenantId].vendorEarnings += item.tenantRevenueShare || 0;
    itemsByTenant[tenantId].platformCommission += item.platformCommission || 0;
  });
  
  // Verify totals
  const verification = totalCustomerPaid - totalVendorEarnings - platformCommission - totalDiscounts;
  
  return {
    totalCustomerPaid,
    totalVendorEarnings,
    totalDiscounts,
    platformCommission,
    totalCommissionFromItems,
    itemsByTenant,
    itemCount: order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    verification, // Should be 0
  };
};

// Email styles
const styles = {
  container: `
    max-width: 680px;
    margin: 0 auto;
    padding: 0;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #1f2937;
    background-color: #f9fafb;
  `,
  header: `
    background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%);
    padding: 40px 50px;
    text-align: center;
  `,
  headerLogo: `
    font-size: 28px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.5px;
  `,
  headerSubtitle: `
    font-size: 14px;
    color: #9ca3af;
    margin: 8px 0 0 0;
  `,
  content: `
    padding: 40px 50px;
    background-color: #ffffff;
  `,
  section: `
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid #e5e7eb;
  `,
  sectionLast: `
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  `,
  sectionTitle: `
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  `,
  sectionTitleIcon: `
    width: 24px;
    height: 24px;
    color: #4f46e5;
  `,
  orderNumber: `
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: #ffffff;
    padding: 16px 24px;
    border-radius: 12px;
    text-align: center;
    margin-bottom: 24px;
  `,
  orderNumberLabel: `
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.9;
    margin: 0 0 4px 0;
  `,
  orderNumberValue: `
    font-size: 24px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 1px;
  `,
  infoGrid: `
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  `,
  infoItem: `
    padding: 12px 16px;
    background-color: #f9fafb;
    border-radius: 8px;
  `,
  infoLabel: `
    font-size: 12px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 4px 0;
  `,
  infoValue: `
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  `,
  table: `
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
  `,
  tableHead: `
    background-color: #f9fafb;
  `,
  tableHeader: `
    padding: 12px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 2px solid #e5e7eb;
  `,
  tableHeaderCenter: `
    text-align: center;
  `,
  tableHeaderRight: `
    text-align: right;
  `,
  tableCell: `
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
  `,
  productImage: `
    width: 60px;
    height: 60px;
    border-radius: 8px;
    object-fit: cover;
    background-color: #f3f4f6;
  `,
  productName: `
    font-weight: 600;
    color: #111827;
    margin: 0 0 4px 0;
  `,
  productMeta: `
    font-size: 13px;
    color: #6b7280;
    margin: 0;
  `,
  quantity: `
    display: inline-block;
    background-color: #f3f4f6;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  `,
  price: `
    font-weight: 700;
    font-size: 15px;
    color: #111827;
  `,
  totalRow: `
    background-color: #f9fafb;
  `,
  totalCell: `
    padding: 16px;
    text-align: right;
  `,
  totalLabel: `
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 4px 0;
  `,
  totalValue: `
    font-size: 24px;
    font-weight: 800;
    color: #111827;
    margin: 0;
  `,
  shippingAddress: `
    background-color: #f9fafb;
    padding: 20px;
    border-radius: 12px;
    border-left: 4px solid #4f46e5;
  `,
  addressName: `
    font-weight: 700;
    color: #111827;
    margin: 0 0 8px 0;
  `,
  addressText: `
    font-size: 14px;
    color: #4b5563;
    margin: 0 0 4px 0;
    line-height: 1.5;
  `,
  ctaButton: `
    display: inline-block;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: #ffffff;
    padding: 16px 32px;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 600;
    font-size: 15px;
    text-align: center;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3);
  `,
  ctaSection: `
    text-align: center;
    padding: 32px 0 0 0;
  `,
  footer: `
    padding: 32px 50px;
    text-align: center;
    background-color: #111827;
  `,
  footerText: `
    font-size: 13px;
    color: #9ca3af;
    margin: 0 0 8px 0;
  `,
  footerLink: `
    color: #9ca3af;
    text-decoration: underline;
  `,
  socialLinks: `
    margin-top: 16px;
  `,
  socialLink: `
    display: inline-block;
    margin: 0 8px;
    color: #9ca3af;
    text-decoration: none;
  `,
  divider: `
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, #e5e7eb 50%, transparent 100%);
    margin: 24px 0;
  `,
};

/**
 * Send email helper
 */
const sendEmail = async (options) => {
  try {
    if (!emailServiceReady) {
      console.log('\n📧 ========== EMAIL (Development Mode) ==========');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Preview: Check server logs for full email content\n');
      return { success: true, message: 'Email logged (dev mode)', messageId: 'dev-mode' };
    }

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'DrinksHarbour'}" <${process.env.SENDER_EMAIL_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send order confirmation email to customer
 */
const sendOrderConfirmationToCustomer = async (order, customer) => {
  // Helper function to safely get image URL
  const getProductImage = (item) => {
    // Check product.images first
    if (item.product?.images?.length > 0) {
      const img = item.product.images.find(img => img?.url) || item.product.images[0];
      if (img?.url) return img.url;
    }
    // Fallback to subproduct images
    if (item.subproduct?.images?.length > 0) {
      const img = item.subproduct.images.find(img => img?.url) || item.subproduct.images[0];
      if (img?.url) return img.url;
    }
    return 'https://via.placeholder.com/80x80/f3f4f6/9ca3af?text=No+Image';
  };

  // Helper function to get product name
  const getProductName = (item) => {
    return item.product?.name || item.subproduct?.name || 'Product';
  };

  // Helper function to get size name
  const getSizeName = (item) => {
    return item.size?.name || item.subproduct?.name || '';
  };

  // Helper function to get vendor name
  const getVendorName = (item) => {
    return item.tenant?.name || '';
  };

  const itemsList = order.items?.map((item) => `
    <tr>
      <td style="${styles.tableCell}">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right: 16px; vertical-align: top;">
              <img 
                src="${getProductImage(item)}" 
                alt="${getProductName(item)}"
                style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; background: #f3f4f6;"
              />
            </td>
            <td style="vertical-align: top;">
              <p style="${styles.productName}; margin: 0 0 4px 0;">${getProductName(item)}</p>
              ${getSizeName(item) ? `<p style="${styles.productMeta}; margin: 0 0 4px 0;">${getSizeName(item)}</p>` : ''}
              ${getVendorName(item) ? `<p style="${styles.productMeta}; margin: 0; color: #f97316;">${getVendorName(item)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
      <td style="${styles.tableCell}; text-align: center; vertical-align: middle;">
        <span style="${styles.quantity}">${item.quantity}</span>
      </td>
      <td style="${styles.tableCell}; text-align: right; vertical-align: middle;">
        <span style="${styles.price}">${formatCurrency(item.priceAtPurchase * item.quantity)}</span>
      </td>
    </tr>
  `).join('') || '';

  const couponRow = order.coupon ? `
    <tr>
      <td colspan="2" style="${styles.totalCell}; text-align: right;">
        <p style="${styles.totalLabel}">Coupon (${order.coupon.code})</p>
      </td>
      <td style="${styles.totalCell}; text-align: right;">
        <p style="${styles.totalLabel}; color: #059669;">-${formatCurrency(order.discountTotal)}</p>
      </td>
    </tr>
  ` : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - DrinksHarbour</title>
</head>
<body style="${styles.container}; margin: 0;">
  <!-- Header -->
  <div style="${styles.header}">
    <h1 style="${styles.headerLogo}">🍾 DrinksHarbour</h1>
    <p style="${styles.headerSubtitle}">Premium Beverage Shopping Experience</p>
  </div>

  <!-- Content -->
  <div style="${styles.content}">
    <!-- Thank You Message -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="font-size: 28px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">
        🎉 Order Confirmed!
      </h2>
      <p style="font-size: 16px; color: #6b7280; margin: 0;">
        Thank you for your order, ${customer.firstName}! We're getting it ready.
      </p>
    </div>

    <!-- Order Number -->
    <div style="${styles.orderNumber}">
      <p style="${styles.orderNumberLabel}">Order Number</p>
      <p style="${styles.orderNumberValue}">#${order.orderNumber}</p>
    </div>

    <!-- Order Details -->
    <div style="${styles.section}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
        </svg>
        Order Details
      </h3>
      <div style="${styles.infoGrid}">
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Order Date</p>
          <p style="${styles.infoValue}">${formatDate(order.placedAt)}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Status</p>
          <p style="${styles.infoValue}">${getOrderStatusBadge(order.status)}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Payment</p>
          <p style="${styles.infoValue}">${getPaymentStatusBadge(order.paymentStatus)}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Items</p>
          <p style="${styles.infoValue}">${order.items?.length || 0} item(s)</p>
        </div>
      </div>
    </div>

    <!-- Items Ordered -->
    <div style="${styles.section}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
        </svg>
        Items Ordered
      </h3>
      <table style="${styles.table}">
        <thead style="${styles.tableHead}">
          <tr>
            <th style="${styles.tableHeader}">Product</th>
            <th style="${styles.tableHeader}; ${styles.tableHeaderCenter}">Qty</th>
            <th style="${styles.tableHeader}; ${styles.tableHeaderRight}">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="${styles.totalCell}; text-align: right;">
              <p style="${styles.totalLabel}">Subtotal</p>
            </td>
            <td style="${styles.totalCell}; text-align: right;">
              <p style="${styles.totalLabel}">${formatCurrency(order.subtotal)}</p>
            </td>
          </tr>
          ${couponRow}
          <tr>
            <td colspan="2" style="${styles.totalCell}; text-align: right;">
              <p style="${styles.totalLabel}">Shipping</p>
            </td>
            <td style="${styles.totalCell}; text-align: right;">
              <p style="${styles.totalLabel}; ${order.shippingFee === 0 ? 'color: #059669;' : ''}">
                ${order.shippingFee === 0 ? 'FREE' : formatCurrency(order.shippingFee)}
              </p>
            </td>
          </tr>
          <tr style="${styles.totalRow}">
            <td colspan="2" style="${styles.totalCell}; text-align: right;">
              <p style="${styles.totalLabel}; font-size: 16px;">Total</p>
            </td>
            <td style="${styles.totalCell}; text-align: right;">
              <p style="${styles.totalValue}">${formatCurrency(order.totalAmount)}</p>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Shipping Address -->
    <div style="${styles.sectionLast}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        Shipping Address
      </h3>
      <div style="${styles.shippingAddress}">
        <p style="${styles.addressName}">${order.shippingAddress?.fullName || `${customer.firstName} ${customer.lastName}`}</p>
        <p style="${styles.addressText}">${order.shippingAddress?.addressLine1}</p>
        <p style="${styles.addressText}">
          ${order.shippingAddress?.city}, ${order.shippingAddress?.state} ${order.shippingAddress?.postalCode}
        </p>
        <p style="${styles.addressText}">${order.shippingAddress?.country}</p>
        <p style="${styles.addressText}; margin-top: 8px;">
          📞 ${order.shippingAddress?.phone || customer.phone}
        </p>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="${styles.ctaSection}">
      <a href="${process.env.FRONTEND_URL}/order-confirmation?orderId=${order._id}" style="${styles.ctaButton}">
        View Order Details →
      </a>
    </div>

    <!-- Help Section -->
    <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px 0;">
        Have questions about your order?
      </p>
      <p style="font-size: 14px; color: #111827; margin: 0;">
        Contact us at <a href="mailto:support@drinksharbour.com" style="color: #4f46e5;">support@drinksharbour.com</a>
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="${styles.footer}">
    <p style="${styles.footerText}">Thank you for shopping with DrinksHarbour!</p>
    <p style="${styles.footerText}">
      <a href="${process.env.FRONTEND_URL}" style="${styles.footerLink}">www.drinksharbour.com</a>
    </p>
    <div style="${styles.socialLinks}">
      <span style="font-size: 12px; color: #6b7280;">Follow us on social media for exclusive offers</span>
    </div>
    <p style="${styles.footerText}; margin-top: 24px; opacity: 0.6;">
      © ${new Date().getFullYear()} DrinksHarbour. All rights reserved.
    </p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: customer.email,
    subject: `🎉 Order Confirmed! #${order.orderNumber} - DrinksHarbour`,
    html,
  });
};

/**
 * Send new order notification to tenant
 */
const sendNewOrderNotificationToTenant = async (order, tenant, customer) => {
  const totals = calculateVendorTotals(order, tenant._id);
  
  // Get the revenue model from one of the items
  const sampleItem = totals.items[0];
  const revenueModel = sampleItem?.tenantRevenueModel || tenant.revenueModel || 'platform_markup';
  const platformMarkupPercentage = sampleItem?.platformMarkupPercentage || tenant.platformMarkupPercentage || 15;
  
  const itemsList = totals.items.map(item => `
    <tr>
      <td style="${styles.tableCell}">
        <p style="${styles.productName}">${item.product?.name || 'Product'}</p>
        <p style="${styles.productMeta}">${item.size ? `Size: ${item.size.name}` : ''}</p>
      </td>
      <td style="${styles.tableCell}; text-align: center;">
        <span style="${styles.quantity}">${item.quantity}</span>
      </td>
      <td style="${styles.tableCell}; text-align: right;">
        <span style="${styles.price}">${formatCurrency(item.itemSubtotal)}</span>
      </td>
    </tr>
  `).join('') || '';

  const modelLabel = revenueModel === 'platform_markup' 
    ? `${platformMarkupPercentage}% Platform Markup`
    : `${sampleItem?.tenantCommissionPercentage || 0}% Commission`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order - DrinksHarbour</title>
</head>
<body style="${styles.container}; margin: 0;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%); padding: 40px 50px; text-align: center;">
    <h1 style="font-size: 28px; font-weight: 800; color: #ffffff; margin: 0;">🍾 DrinksHarbour</h1>
    <p style="font-size: 14px; color: #d1fae5; margin: 8px 0 0 0;">Partner Dashboard</p>
  </div>

  <!-- Content -->
  <div style="${styles.content}">
    <!-- Alert Message -->
    <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
      <h2 style="font-size: 24px; font-weight: 700; color: #065f46; margin: 0 0 8px 0;">
        🛒 New Order Received!
      </h2>
      <p style="font-size: 16px; color: #047857; margin: 0;">
        You have a new order to fulfill. Log in to your dashboard to process it.
      </p>
    </div>

    <!-- Order Number -->
    <div style="${styles.orderNumber}">
      <p style="${styles.orderNumberLabel}">Order Number</p>
      <p style="${styles.orderNumberValue}">#${order.orderNumber}</p>
    </div>

    <!-- Order Info -->
    <div style="${styles.section}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        </svg>
        Order Information
      </h3>
      <div style="${styles.infoGrid}">
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Order Date</p>
          <p style="${styles.infoValue}">${formatDate(order.placedAt)}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Items to Fulfill</p>
          <p style="${styles.infoValue}">${totals.itemCount} item(s)</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Payment Method</p>
          <p style="${styles.infoValue}">${order.paymentMethod?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Revenue Model</p>
          <p style="${styles.infoValue}; color: #6b7280; font-size: 13px;">${modelLabel}</p>
        </div>
      </div>
    </div>

    <!-- Your Earnings Breakdown -->
    <div style="${styles.section}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Your Earnings Breakdown
      </h3>
      
      <!-- Items Sold -->
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 12px 0;">Items Sold</h4>
        <table style="${styles.table}">
          <thead style="${styles.tableHead}">
            <tr>
              <th style="${styles.tableHeader}">Product</th>
              <th style="${styles.tableHeader}; ${styles.tableHeaderCenter}">Qty</th>
              <th style="${styles.tableHeader}; ${styles.tableHeaderRight}">Price Paid</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
        </table>
      </div>
      
      <!-- Earnings Summary -->
      <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #059669;">
        <h4 style="font-size: 14px; font-weight: 600; color: #065f46; margin: 0 0 12px 0;">💰 Your Earnings Summary</h4>
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">Total Sales (Customer Paid)</td>
            <td style="padding: 6px 0; font-size: 14px; color: #374151; text-align: right;">${formatCurrency(totals.customerSubtotal)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Platform Markup (${platformMarkupPercentage}%)</td>
            <td style="padding: 6px 0; font-size: 14px; color: #6b7280; text-align: right;">-${formatCurrency(totals.platformCommission)}</td>
          </tr>
          ${totals.itemDiscounts > 0 ? `
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Item Discounts</td>
            <td style="padding: 6px 0; font-size: 14px; color: #6b7280; text-align: right;">-${formatCurrency(totals.itemDiscounts)}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #059669;">
            <td style="padding: 12px 0; font-size: 16px; font-weight: 700; color: #065f46;">Your Earnings</td>
            <td style="padding: 12px 0; font-size: 16px; font-weight: 700; color: #065f46; text-align: right;">${formatCurrency(totals.vendorEarnings)}</td>
          </tr>
        </table>
      </div>
      
      <!-- Verification (debug info, hidden in production if needed) -->
      ${totals.verification !== 0 ? `
      <div style="margin-top: 12px; padding: 8px; background: #fef3c7; border-radius: 6px; font-size: 11px; color: #92400e;">
        ⚠️ Calculation verification: ${totals.verification.toFixed(2)} (should be 0)
      </div>
      ` : ''}
    </div>

    <!-- Customer Details -->
    <div style="${styles.sectionLast}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        Customer Details
      </h3>
      <div style="${styles.infoGrid}">
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Customer Name</p>
          <p style="${styles.infoValue}">${customer.firstName} ${customer.lastName}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Email</p>
          <p style="${styles.infoValue}">${customer.email}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Phone</p>
          <p style="${styles.infoValue}">${customer.phone}</p>
        </div>
      </div>

      <div style="${styles.shippingAddress}; margin-top: 16px;">
        <p style="${styles.addressName}">📦 Shipping Address</p>
        <p style="${styles.addressText}">${order.shippingAddress?.addressLine1}</p>
        <p style="${styles.addressText}">
          ${order.shippingAddress?.city}, ${order.shippingAddress?.state} ${order.shippingAddress?.postalCode}
        </p>
        <p style="${styles.addressText}">${order.shippingAddress?.country}</p>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="${styles.ctaSection}">
      <a href="${process.env.BACKEND_URL}/admin/orders/${order._id}" style="${styles.ctaButton}">
        Process Order →
      </a>
    </div>

    <!-- Urgent Message -->
    <div style="background: #fef3c7; padding: 20px; border-radius: 12px; text-align: center; margin-top: 32px; border-left: 4px solid #f59e0b;">
      <p style="font-size: 14px; font-weight: 600; color: #92400e; margin: 0;">
        ⚡ Please process this order as soon as possible to ensure timely delivery!
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="${styles.footer}">
    <p style="${styles.footerText}">This is an automated notification from DrinksHarbour</p>
    <p style="${styles.footerText}; margin-top: 16px; opacity: 0.6;">
      © ${new Date().getFullYear()} DrinksHarbour. All rights reserved.
    </p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: tenant.email,
    subject: `🛒 New Order #${order.orderNumber} - Your Earnings: ${formatCurrency(totals.vendorEarnings)}`,
    html,
  });
};

/**
 * Send new order notification to admin
 */
const sendNewOrderNotificationToAdmin = async (order, customer) => {
  const breakdown = calculateOrderBreakdown(order);
  
  // Group items by tenant for detailed breakdown
  const tenantBreakdowns = Object.entries(breakdown.itemsByTenant).map(([tenantId, data]) => {
    const isNoTenant = tenantId === 'no-tenant';
    const sampleItem = data.items[0];
    const revenueModel = sampleItem?.tenantRevenueModel || 'platform_markup';
    const platformMarkupPercentage = sampleItem?.platformMarkupPercentage || 15;
    
    return {
      tenantName: isNoTenant ? 'Unassigned Items' : (data.items[0]?.tenant?.name || 'Unknown Tenant'),
      items: data.items,
      customerTotal: data.customerTotal,
      vendorEarnings: data.vendorEarnings,
      platformCommission: data.platformCommission,
      platformMarkupPercentage,
      revenueModel,
      itemCount: data.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Platform Order - DrinksHarbour Admin</title>
</head>
<body style="${styles.container}; margin: 0;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%); padding: 40px 50px; text-align: center;">
    <h1 style="font-size: 28px; font-weight: 800; color: #ffffff; margin: 0;">🔐 DrinksHarbour</h1>
    <p style="font-size: 14px; color: #bfdbfe; margin: 8px 0 0 0;">Admin Dashboard</p>
  </div>

  <!-- Content -->
  <div style="${styles.content}">
    <!-- Alert Message -->
    <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
      <h2 style="font-size: 24px; font-weight: 700; color: #1e40af; margin: 0 0 8px 0;">
        🛍️ New Platform Order
      </h2>
      <p style="font-size: 16px; color: #1d4ed8; margin: 0;">
        A new order has been placed on the platform
      </p>
    </div>

    <!-- Order Number -->
    <div style="${styles.orderNumber}">
      <p style="${styles.orderNumberLabel}">Order Number</p>
      <p style="${styles.orderNumberValue}">#${order.orderNumber}</p>
    </div>

    <!-- Revenue Breakdown -->
    <div style="${styles.section}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        💰 Revenue Breakdown
      </h3>
      
      <!-- Overall Summary -->
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; font-size: 16px; font-weight: 700; color: #92400e;">💵 Total Customer Paid</td>
            <td style="padding: 8px 0; font-size: 16px; font-weight: 700; color: #92400e; text-align: right;">${formatCurrency(breakdown.totalCustomerPaid)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #78350f;">💸 Total to Vendors</td>
            <td style="padding: 8px 0; font-size: 14px; color: #78350f; text-align: right;">${formatCurrency(breakdown.totalVendorEarnings)}</td>
          </tr>
          ${breakdown.totalDiscounts > 0 ? `
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #78350f;">🏷️ Total Discounts</td>
            <td style="padding: 8px 0; font-size: 14px; color: #78350f; text-align: right;">${formatCurrency(breakdown.totalDiscounts)}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #f59e0b;">
            <td style="padding: 12px 0; font-size: 18px; font-weight: 800; color: #059669;">💵 Platform Revenue</td>
            <td style="padding: 12px 0; font-size: 18px; font-weight: 800; color: #059669; text-align: right;">${formatCurrency(breakdown.platformCommission)}</td>
          </tr>
        </table>
      </div>
      
      <!-- Verification -->
      ${breakdown.verification !== 0 ? `
      <div style="margin-bottom: 16px; padding: 12px; background: #fee2e2; border-radius: 8px; border-left: 4px solid #dc2626;">
        <p style="font-size: 13px; font-weight: 600; color: #991b1b; margin: 0;">
          ⚠️ Calculation Mismatch: ${breakdown.verification.toFixed(2)}
        </p>
        <p style="font-size: 11px; color: #7f1d1d; margin: 4px 0 0 0;">
          Expected: Customer (${breakdown.totalCustomerPaid}) = Vendors (${breakdown.totalVendorEarnings}) + Commission (${breakdown.platformCommission}) + Discounts (${breakdown.totalDiscounts})
        </p>
      </div>
      ` : `
      <div style="margin-bottom: 16px; padding: 12px; background: #d1fae5; border-radius: 8px; border-left: 4px solid #059669;">
        <p style="font-size: 12px; font-weight: 600; color: #065f46; margin: 0;">
          ✅ Calculations verified
        </p>
      </div>
      `}
    </div>

    <!-- Tenant Breakdowns -->
    <div style="${styles.section}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
        Vendor Breakdown
      </h3>
      
      ${tenantBreakdowns.map(tenantData => `
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-size: 14px; font-weight: 700; color: #374151; margin: 0;">${tenantData.tenantName}</h4>
            <span style="font-size: 11px; padding: 3px 8px; border-radius: 4px; background: #dbeafe; color: #1e40af;">
              ${tenantData.platformMarkupPercentage}% Platform Markup
            </span>
          </div>
          <table cellpadding="0" cellspacing="0" style="width: 100%; font-size: 13px;">
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Items</td>
              <td style="padding: 4px 0; text-align: right; color: #111827;">${tenantData.itemCount}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Customer Paid</td>
              <td style="padding: 4px 0; text-align: right; color: #111827;">${formatCurrency(tenantData.customerTotal)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Vendor Receives</td>
              <td style="padding: 4px 0; text-align: right; color: #059669; font-weight: 600;">${formatCurrency(tenantData.vendorEarnings)}</td>
            </tr>
            <tr style="border-top: 1px solid #e5e7eb;">
              <td style="padding: 4px 0; font-weight: 600; color: #374151;">Platform Markup</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #dc2626;">${formatCurrency(tenantData.platformCommission)}</td>
            </tr>
          </table>
        </div>
      `).join('')}
    </div>

    <!-- Order Stats -->
    <div style="${styles.section}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        Order Statistics
      </h3>
      <div style="${styles.infoGrid}">
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Total Items</p>
          <p style="${styles.infoValue}; font-size: 18px;">${breakdown.itemCount}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Payment Status</p>
          <p style="${styles.infoValue}">${getPaymentStatusBadge(order.paymentStatus)}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Payment Method</p>
          <p style="${styles.infoValue}">${order.paymentMethod?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Customer Type</p>
          <p style="${styles.infoValue}">${order.user ? 'Registered User' : 'Guest Checkout'}</p>
        </div>
      </div>
    </div>

    <!-- Customer Info -->
    <div style="${styles.sectionLast}">
      <h3 style="${styles.sectionTitle}">
        <svg style="${styles.sectionTitleIcon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        Customer Information
      </h3>
      <div style="${styles.infoGrid}">
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Name</p>
          <p style="${styles.infoValue}">${customer.firstName} ${customer.lastName}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Email</p>
          <p style="${styles.infoValue}">${customer.email}</p>
        </div>
        <div style="${styles.infoItem}">
          <p style="${styles.infoLabel}">Phone</p>
          <p style="${styles.infoValue}">${customer.phone}</p>
        </div>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="${styles.ctaSection}">
      <a href="${process.env.BACKEND_URL}/admin/orders/${order._id}" style="${styles.ctaButton}">
        View Full Order Details →
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="${styles.footer}">
    <p style="${styles.footerText}">Admin Notification - DrinksHarbour Platform</p>
    <p style="${styles.footerText}; margin-top: 16px; opacity: 0.6;">
      © ${new Date().getFullYear()} DrinksHarbour. All rights reserved.
    </p>
  </div>
</body>
</html>
  `;

  const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL_ADDRESS;
  
  if (!adminEmail) {
    console.log('⚠️  Admin email not configured, skipping admin notification');
    return { success: false, message: 'Admin email not configured' };
  }

  return sendEmail({
    to: adminEmail,
    subject: `🔔 [Admin] New Order #${order.orderNumber} - Revenue: ${formatCurrency(breakdown.totalCustomerPaid)} | Commission: ${formatCurrency(breakdown.platformCommission)}`,
    html,
  });
};

/**
 * Send email verification code to user
 * @param {Object} params
 * @param {string} params.email - User email
 * @param {string} params.code - Verification code
 * @param {string} params.firstName - User first name
 */
const sendVerificationCodeEmail = async ({ email, code, firstName }) => {
  if (!emailServiceReady) {
    console.log('⚠️  Email service not ready, cannot send verification code');
    return { success: false, message: 'Email service not configured' };
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - Drinksharbour</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          color: white;
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          color: rgba(255, 255, 255, 0.9);
          margin: 10px 0 0 0;
          font-size: 16px;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          color: #333;
          margin-bottom: 20px;
        }
        .code-container {
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          margin: 30px 0;
        }
        .code-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 15px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .code {
          font-size: 48px;
          font-weight: 700;
          color: #667eea;
          letter-spacing: 8px;
          font-family: 'Courier New', monospace;
        }
        .expiry {
          text-align: center;
          color: #666;
          font-size: 14px;
          margin-top: 20px;
        }
        .expiry strong {
          color: #e74c3c;
        }
        .footer {
          background: #f8f9fa;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        .footer p {
          color: #666;
          font-size: 14px;
          margin: 5px 0;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
        .warning {
          background: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning p {
          margin: 0;
          color: #856404;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Verify Your Email</h1>
          <p>Complete your registration to access your admin dashboard</p>
        </div>
        
        <div class="content">
          <p class="greeting">Hello ${firstName || 'there'},</p>
          
          <p style="color: #555; line-height: 1.6;">
            Thank you for registering as an administrator on Drinksharbour. To complete your account setup and ensure the security of your admin access, please verify your email address using the verification code below:
          </p>
          
          <div class="code-container">
            <div class="code-label">Your Verification Code</div>
            <div class="code">${code}</div>
          </div>
          
          <p class="expiry">
            ⏰ This code will expire in <strong>10 minutes</strong>
          </p>
          
          <div class="warning">
            <p>
              <strong>🔒 Security Notice:</strong> Never share this code with anyone. Our team will never ask for your verification code.
            </p>
          </div>
          
          <p style="color: #555; line-height: 1.6; margin-top: 30px;">
            If you didn't create an account on Drinksharbour, please ignore this email or contact our support team if you have concerns.
          </p>
        </div>
        
        <div class="footer">
          <p><strong>Drinksharbour Admin Portal</strong></p>
          <p>Need help? Contact us at <a href="mailto:support@drinksharbour.com">support@drinksharbour.com</a></p>
          <p style="margin-top: 15px; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} Drinksharbour. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: '🔐 Verify Your Email - Drinksharbour Admin Registration',
    html,
  });
};

module.exports = {
  sendEmail,
  sendOrderConfirmationToCustomer,
  sendNewOrderNotificationToTenant,
  sendNewOrderNotificationToAdmin,
  sendVerificationCodeEmail,
};
