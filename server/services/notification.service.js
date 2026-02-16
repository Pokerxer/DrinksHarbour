// services/notification.service.js

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Product = require('../models/Product');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { sendEmail } = require('./email.service');

const {
  NotFoundError,
  ValidationError,
} = require('../utils/errors');

const PLATFORM_URL = process.env.PLATFORM_URL || 'https://drinksharbour.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL_ADDRESS || 'admin@drinksharbour.com';

/**
 * Get all super-admin users
 */
const getSuperAdmins = async () => {
  return User.find({ role: 'super_admin', status: 'active' }).select('_id name email').lean();
};

/**
 * Create in-app notification(s) for super-admins
 */
const createNotification = async (data) => {
  const {
    type,
    title,
    message,
    shortMessage,
    product,
    subProduct,
    tenant,
    user,
    priority,
    actionUrl,
    actionLabel,
    metadata,
    recipients,
  } = data;

  const notificationData = {
    type,
    title,
    message,
    shortMessage: shortMessage || message.substring(0, 200),
    product,
    subProduct,
    tenant,
    user,
    priority: priority || 'normal',
    actionUrl,
    actionLabel,
    metadata: metadata || {},
  };

  if (recipients && recipients.length > 0) {
    notificationData.recipients = recipients;
    const createdNotifications = await Notification.insertMany(
      recipients.map(recipient => ({
        ...notificationData,
        recipient,
      }))
    );
    return createdNotifications;
  }

  const notification = new Notification(notificationData);
  await notification.save();
  return notification;
};

/**
 * Send email to super-admins about new pending product
 */
const sendEmailToSuperAdmins = async (product, tenant) => {
  const superAdmins = await getSuperAdmins();
  
  if (!superAdmins || superAdmins.length === 0) {
    console.log('⚠️ No super-admins found for notification');
    return { success: false, error: 'No super-admins found' };
  }

  const tenantName = tenant?.name || 'Unknown Tenant';
  const tenantSlug = tenant?.slug || '';
  const productName = product?.name || 'Unnamed Product';
  const productType = product?.type || 'Unknown Type';
  const productBrand = product?.brand?.name || product?.brand || 'Unknown Brand';
  
  const approvalUrl = `${PLATFORM_URL}/admin/products/pending`;
  const productUrl = `${PLATFORM_URL}/admin/products/${product?._id || product}`;

  const emailSubject = `📋 New Product Pending Approval - ${productName}`;
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Product Pending Approval</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
            <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0;">New Product Pending Approval</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 8px;">DrinksHarbour Admin Notification</p>
          </div>

          <!-- Content -->
          <div style="margin-bottom: 24px;">
            <p style="color: #374151; font-size: 16px; margin-bottom: 16px;">
              A new product has been submitted and is waiting for your approval.
            </p>

            <!-- Product Details Card -->
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">Product Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Product Name</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${productName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Type</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px;">${productType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Brand</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px;">${productBrand}</td>
                </tr>
                ${product?.volumeMl ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Volume</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px;">${product.volumeMl}ml</td>
                </tr>
                ` : ''}
                ${product?.abv ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">ABV</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px;">${product.abv}%</td>
                </tr>
                ` : ''}
                ${product?.originCountry ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Origin</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px;">${product.originCountry}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <!-- Tenant Details -->
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">Submitted By</h2>
              <p style="color: #374151; font-size: 14px; margin: 0;">
                <strong>Tenant:</strong> ${tenantName}<br>
                ${tenantSlug ? `<strong>Slug:</strong> ${tenantSlug}<br>` : ''}
                <strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${approvalUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-right: 12px;">
              View Pending Products
            </a>
            <a href="${productUrl}" style="display: inline-block; background-color: #ffffff; color: #2563eb; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #2563eb;">
              View Product
            </a>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">This is an automated notification from DrinksHarbour</p>
            <p style="margin: 8px 0 0 0;">
              <a href="${PLATFORM_URL}" style="color: #2563eb; text-decoration: none;">${PLATFORM_URL}</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const emailRecipients = superAdmins.map(admin => admin.email).join(',');

  const result = await sendEmail({
    to: emailRecipients,
    subject: emailSubject,
    html: emailHtml,
  });

  return result;
};

/**
 * Send notification when a new product is created with pending status
 * This is called from the SubProduct service when a tenant creates a new product
 */
const sendNewProductPendingNotification = async (productId, tenantId) => {
  try {
    const product = await Product.findById(productId).lean();
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const tenant = await Tenant.findById(tenantId).lean();
    
    const superAdmins = await getSuperAdmins();
    const recipientIds = superAdmins.map(admin => admin._id);

    const notificationMessage = `New product "${product.name}" (${product.type}) submitted by ${tenant?.name || 'Unknown tenant'} is pending approval.`;

    const notification = await createNotification({
      type: 'new_product_pending',
      title: 'New Product Pending Approval',
      message: notificationMessage,
      shortMessage: `New product "${product.name}" pending your review`,
      product: product._id,
      tenant: tenantId,
      priority: 'high',
      actionUrl: `/admin/products/pending`,
      actionLabel: 'Review Product',
      metadata: {
        productName: product.name,
        productType: product.type,
        tenantName: tenant?.name,
        tenantSlug: tenant?.slug,
      },
      recipients: recipientIds,
    });

    const emailResult = await sendEmailToSuperAdmins(product, tenant);

    await Product.findByIdAndUpdate(productId, {
      adminNotificationSent: true,
      adminNotificationSentAt: new Date(),
    });

    return {
      success: true,
      notification,
      emailSent: emailResult.success,
    };
  } catch (error) {
    console.error('❌ Error sending new product notification:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send notification when a product is approved
 */
const sendProductApprovedNotification = async (productId, approvedBy) => {
  try {
    const product = await Product.findById(productId).lean();
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const notification = await createNotification({
      type: 'product_approved',
      title: 'Product Approved',
      message: `Your product "${product.name}" has been approved and is now visible on the marketplace.`,
      product: product._id,
      tenant: product.submittingTenant,
      priority: 'normal',
      actionUrl: `/products/${product.slug}`,
      actionLabel: 'View Product',
    });

    return { success: true, notification };
  } catch (error) {
    console.error('❌ Error sending product approved notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification when a product is rejected
 */
const sendProductRejectedNotification = async (productId, rejectedBy, reason) => {
  try {
    const product = await Product.findById(productId).lean();
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const notification = await createNotification({
      type: 'product_rejected',
      title: 'Product Rejected',
      message: `Your product "${product.name}" has been rejected. Reason: ${reason || 'Not specified'}`,
      product: product._id,
      tenant: product.submittingTenant,
      priority: 'normal',
      actionUrl: `/dashboard/products`,
      actionLabel: 'View Products',
      metadata: {
        rejectionReason: reason,
      },
    });

    return { success: true, notification };
  } catch (error) {
    console.error('❌ Error sending product rejected notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get notifications for a user
 */
const getNotifications = async (userId, options = {}) => {
  return Notification.getNotifications(userId, options);
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  return notification.markAsRead(userId);
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId, notificationIds) => {
  return Notification.markAllAsRead(userId, notificationIds);
};

/**
 * Get unread notification count
 */
const getUnreadCount = async (userId) => {
  return Notification.getUnreadCount(userId);
};

module.exports = {
  createNotification,
  sendNewProductPendingNotification,
  sendProductApprovedNotification,
  sendProductRejectedNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getSuperAdmins,
};
