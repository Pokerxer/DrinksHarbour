'use strict';
const { getTenantId } = require('../utils/tenantContext');
const { ForbiddenError, ValidationError } = require('../utils/errors');
const PLATFORM = ['super_admin', 'admin'];
const FIELDS = ['title', 'subtitle', 'description', 'image', 'mobileImage', 'type', 'placement', 'displayOrder', 'priority',
  'ctaText', 'ctaLink', 'ctaStyle', 'linkType', 'imageClickable', 'targetProduct', 'targetCategory', 'targetBrand', 'targetCollection',
  'backgroundColor', 'textColor', 'overlayOpacity', 'textAlignment', 'contentPosition', 'imageFit', 'gradientIntensity', 'blurIntensity',
  'startDate', 'endDate', 'isScheduled', 'isActive', 'status', 'visibleTo', 'deviceTargeting', 'animation', 'popupSettings', 'tags', 'notes'];
function adminScope(req) {
  if (!PLATFORM.includes(req.user?.role) && !req.user?.tenant) throw new ForbiddenError('Your account must belong to a tenant');
  const tenant = getTenantId(req, { required: !PLATFORM.includes(req.user?.role) });
  return tenant ? { tenant } : {};
}
function safeLink(value) {
  if (!value) return true;
  if (typeof value !== 'string' || /[\\\u0000-\u0020]/.test(value)) return false;
  if (/^\/(?!\/)/.test(value) || /^#[\w-]*$/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function bannerInput(req, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Invalid banner data');
  const scope = adminScope(req), data = {};
  for (const field of FIELDS) if (body[field] !== undefined) data[field] = body[field];
  if (data.ctaLink != null && !safeLink(data.ctaLink)) throw new ValidationError('Use a store path or HTTPS URL for the banner link');
  for (const field of ['image', 'mobileImage']) {
    if (data[field] != null) {
      const image = data[field];
      if (typeof image !== 'object' || Array.isArray(image)) throw new ValidationError('Invalid banner image');
      if (image.url) {
        let url;
        try { url = new URL(image.url); } catch { throw new ValidationError('Invalid image URL'); }
        if (url.protocol !== 'https:' || url.username || url.password) throw new ValidationError('Banner images require HTTPS URLs');
      }
      data[field] = Object.fromEntries(['url', 'publicId', 'alt', 'width', 'height'].filter(k => image[k] != null).map(k => [k, image[k]]));
    }
  }
  for (const field of ['startDate', 'endDate']) if (data[field] === '') data[field] = null;
  if (scope.tenant) { data.tenant = scope.tenant; data.isGlobal = false; }
  else if (PLATFORM.includes(req.user?.role)) {
    if (body.tenant) data.tenant = body.tenant;
    if (body.isGlobal !== undefined) data.isGlobal = Boolean(body.isGlobal);
    if (data.tenant) data.isGlobal = false;
  }
  return data;
}
const publicScope = req => req.tenant?._id ? { $or: [{ tenant: req.tenant._id }, { tenant: null, isGlobal: true }] } : { tenant: null };
module.exports = { adminScope, bannerInput, publicScope, safeLink };
