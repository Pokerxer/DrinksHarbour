const { ValidationError } = require('../../utils/errors');
const currencies = ['NGN', 'USD', 'EUR', 'GBP', 'ZAR', 'KES', 'GHS'];
const displayDefaults = {
  displayImages: true,
  displayTenantName: false,
  displayBrand: true,
  displaySize: true,
  displayStockStatus: true,
  displayStockQuantity: false,
  displayPromotions: true,
  displayDiscountPercentage: true,
  displayStoreName: true,
  displayBarcode: false,
  manualEntry: true,
  fullscreen: true,
};
const defaults = {
  ...displayDefaults,
  resetSeconds: 8,
  outOfStock: 'DISPLAY',
  theme: 'light',
  welcomeMessage: '',
  resultMessage: 'Ask a member of staff for assistance.',
  notFoundMessage: "We couldn't find this barcode. Please ask a member of staff for assistance.",
  logo: '',
  background: '',
  accent: '#b20202',
};
const fail = (message) => {
  throw new ValidationError(message);
};
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
function normalizeBarcode(value) {
  if (typeof value !== 'string') fail('Enter a barcode.');
  const code = value.trim();
  if (code.length < 5 || code.length > 128 || /[\x00-\x1f\x7f]/.test(code))
    fail('Enter a barcode of 5–128 characters.');
  return code;
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value))
    fail('Invalid record identifier.');
  return value;
}
function safeImage(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}
function validateSettings(input = {}) {
  if (!object(input)) fail('Invalid kiosk settings.');
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(key in defaults) || !Object.hasOwn(defaults, key)) fail('Unknown kiosk setting.');
    if (Object.hasOwn(displayDefaults, key)) {
      if (typeof value !== 'boolean') fail(`Invalid ${key}.`);
    } else if (key === 'resetSeconds') {
      if (!Number.isInteger(value) || value < 3 || value > 30)
        fail('Reset duration must be 3–30 seconds.');
    } else if (key === 'outOfStock') {
      if (!['DISPLAY', 'HIDE', 'STAFF_MESSAGE'].includes(value)) fail('Invalid stock behavior.');
    } else if (key === 'theme') {
      if (!['light', 'dark'].includes(value)) fail('Invalid theme.');
    } else {
      if (typeof value !== 'string' || value.length > (key === 'logo' ? 2048 : 300))
        fail(`Invalid ${key}.`);
      if (key === 'logo' && value && !safeImage(value)) fail('Logo must be an HTTPS image URL.');
      if (['background', 'accent'].includes(key) && value && !/^#[a-f0-9]{6}$/i.test(value))
        fail('Use a six-digit hex color.');
    }
    output[key] = value;
  }
  return output;
}
function validateKiosk(input, partial = false) {
  if (!object(input)) fail('Invalid kiosk.');
  const allowed = [
    'name',
    'internalId',
    'slug',
    'shopId',
    'location',
    'pricelist',
    'currency',
    'enabled',
    'mode',
    'settings',
  ];
  if (Object.keys(input).some((key) => !allowed.includes(key))) fail('Unknown kiosk field.');
  const output = {};
  for (const key of allowed) {
    if (input[key] === undefined) continue;
    const value = input[key];
    if (key === 'settings') output[key] = validateSettings(value);
    else if (key === 'location') output[key] = id(value);
    else if (key === 'pricelist') output[key] = value === null || value === '' ? null : id(value);
    else if (key === 'enabled') {
      if (typeof value !== 'boolean') fail('Invalid status.');
      output[key] = value;
    } else if (key === 'mode') {
      if (value !== 'STORE_ONLY') fail('Marketplace mode is not available.');
      output[key] = value;
    } else {
      if (typeof value !== 'string' || !value.trim() || value.length > 120) fail(`Invalid ${key}.`);
      output[key] = value.trim();
      if (key === 'currency' && !currencies.includes(value)) fail('Unsupported currency.');
      if (key === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
        fail('Use lowercase letters, numbers and hyphens for the URL.');
      if (key === 'shopId' && value !== 'retail') id(value);
    }
  }
  if (!partial)
    for (const key of ['name', 'internalId', 'slug', 'shopId', 'location'])
      if (!output[key]) fail(`${key} is required.`);
  return output;
}
module.exports = {
  defaults,
  displayDefaults,
  currencies,
  normalizeBarcode,
  validateSettings,
  validateKiosk,
  id,
  safeImage,
};
