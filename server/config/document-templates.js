const { ValidationError } = require('../utils/errors');
const TEMPLATE_IDS = ['classic', 'modern', 'editorial', 'ledger', 'signature', 'axis', 'atelier', 'blueprint'];
const FAMILIES = ['sales', 'purchases', 'pricelist', 'stock'];
const defaults = () => ({ version: 1, defaultTemplate: 'classic', families: {} });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function validatePreferences(value) {
  if (!object(value) || Object.keys(value).some(k => !['version', 'defaultTemplate', 'families'].includes(k)) ||
      (value.version !== undefined && value.version !== 1) || !TEMPLATE_IDS.includes(value.defaultTemplate)) {
    throw new ValidationError('Choose a valid document template');
  }
  const families = value.families ?? {};
  if (!object(families) || Object.entries(families).some(([key, id]) => !FAMILIES.includes(key) || !TEMPLATE_IDS.includes(id))) {
    throw new ValidationError('Choose a valid template for each document family');
  }
  return { version: 1, defaultTemplate: value.defaultTemplate, families: { ...families } };
}
module.exports = { TEMPLATE_IDS, FAMILIES, defaults, validatePreferences };
