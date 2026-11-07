'use strict';

const normalizeColor = color => typeof color === 'string' ? color.trim().toLowerCase() || null : null;
const variantOptionKey = (color, option) => {
  const normalized = normalizeColor(color);
  const named = normalizeColor(option);
  return normalized || named ? JSON.stringify([normalized, named]) : null;
};
const variantIdentity = (size, color, option) =>
  JSON.stringify([String(size || '').trim().toLowerCase(), variantOptionKey(color, option)]);
function variantColorFields(data) {
  if (data.optionName != null && (typeof data.optionName !== 'string' || data.optionName.trim().length > 100)) {
    throw new (require('./errors').ValidationError)('Variant option must be text up to 100 characters');
  }
  return {
    colorName: typeof data.colorName === 'string' ? data.colorName.trim() : '',
    colorHexCode: data.colorHexCode || undefined,
    optionName: typeof data.optionName === 'string' ? data.optionName.trim() : '',
    variantColorKey: variantOptionKey(data.colorName, data.optionName),
  };
}
function variantImageFields(data) {
  const scope = data.imageScope === undefined ? {} : { imageScope: ['color', 'option'].includes(data.imageScope) ? data.imageScope : 'variant' };
  if (data.image === undefined) return scope;
  if (data.image === null) return { image: null, ...scope };
  const { ValidationError } = require('./errors');
  if (typeof data.image?.url !== 'string' || !/^https?:\/\//i.test(data.image.url)) {
    throw new ValidationError('Variant image requires an HTTP or HTTPS image URL');
  }
  return { image: { url: data.image.url, alt: typeof data.image.alt === 'string' ? data.image.alt : '' }, ...scope };
}
module.exports = { normalizeColor, variantOptionKey, variantIdentity, variantColorFields, variantImageFields };
