const Size = require('../../models/Size');
const SubProduct = require('../../models/SubProduct');
const Product = require('../../models/Product');
const WarehouseStock = require('../../models/WarehouseStock');
const { normalizeBarcode, defaults } = require('./validation');
const { resolvePrice, stockState } = require('./pricing');
const { publicProduct } = require('./serialization');
async function lookup(context, input) {
  const barcode = normalizeBarcode(input);
  const { kiosk, pricelist, tenant } = context;
  const settings = { ...defaults, ...kiosk.settings };
  const sizes = await Size.find({ tenant: kiosk.tenant, barcode })
    .select(
      '_id subproduct size displayName barcode sellingPrice costPrice wholesalePrice currency status'
    )
    .limit(2)
    .lean();
  if (!sizes.length) return { outcome: 'UNKNOWN' };
  if (sizes.length !== 1) return { outcome: 'AMBIGUOUS' };
  const size = sizes[0];
  if (!['active', 'seasonal', 'limited_edition'].includes(size.status))
    return { outcome: 'UNAVAILABLE' };
  const subProduct = await SubProduct.findOne({
    _id: size.subproduct,
    tenant: kiosk.tenant,
    isPublished: true,
    visibleInPOS: { $ne: false },
    status: { $in: ['active', 'low_stock', 'out_of_stock'] },
  })
    .select('_id product baseSellingPrice basePriceBeforePricelist costPrice currency')
    .lean();
  if (!subProduct) return { outcome: 'UNAVAILABLE' };
  const product = await Product.findOne({
    _id: subProduct.product,
    status: 'approved',
    isPublished: true,
  })
    .select('_id name brand images isAlcoholic')
    .populate('brand', 'name')
    .lean();
  if (!product) return { outcome: 'UNAVAILABLE' };
  const inventory = await WarehouseStock.findOne({
    tenant: kiosk.tenant,
    warehouse: kiosk.location,
    subProduct: subProduct._id,
    size: size._id,
  })
    .select('currentQuantity reservedQuantity minStockLevel')
    .lean();
  const stock = stockState(inventory);
  const record = {
    product: product._id,
    subProduct: subProduct._id,
    size: size._id,
    productName: product.name,
    availability: stock.availability,
    availableQuantity: stock.quantity,
  };
  if (settings.outOfStock === 'HIDE' && stock.quantity <= 0) return { outcome: 'HIDDEN', record };
  let pricing;
  try {
    pricing = resolvePrice({
      size,
      subProduct,
      pricelist,
      currency: kiosk.currency,
      tenant,
    });
  } catch (error) {
    if (error.statusCode === 400) return { outcome: 'PRICE_UNAVAILABLE', record };
    throw error;
  }
  return {
    outcome: 'FOUND',
    record: {
      ...record,
      priceDisplayed: pricing.price,
      currency: pricing.currency,
    },
    product: publicProduct({ product, size, pricing, stock, settings }),
  };
}
module.exports = { lookup };
