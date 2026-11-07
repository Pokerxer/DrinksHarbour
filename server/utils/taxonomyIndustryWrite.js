const { isBeverageType } = require('../constants/productTypes');
const { INDUSTRY_VALUES } = require('../constants/industries');
const { BEVERAGE_CATEGORY_SLUGS } = require('./beverageTaxonomyAssignment');
function badRequest(message) {
  const error = new Error(message); error.statusCode = 400; return error;
}
function validIndustry(value) {
  if (value && !INDUSTRY_VALUES.includes(value)) throw badRequest('Invalid business industry');
  return value || undefined;
}
function categoryIndustryForCreate(data) {
  return validIndustry(data.industry) || ((isBeverageType(data.type) || BEVERAGE_CATEGORY_SLUGS.has(data.slug)) ? 'beverage' : undefined);
}
function subcategoryIndustryForWrite(value, parent) {
  const explicit = validIndustry(value);
  if (!parent) throw badRequest('A valid parent category is required');
  if (explicit && parent.industry && explicit !== parent.industry) throw badRequest('Subcategory business must match its parent category');
  return parent.industry || explicit;
}
module.exports = { categoryIndustryForCreate, subcategoryIndustryForWrite, validIndustry };
