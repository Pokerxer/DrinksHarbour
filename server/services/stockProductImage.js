// Tenant-specific imagery takes precedence over the central catalogue.
function stockProductImage(subProduct = {}) {
  for (const source of [subProduct.imagesOverride, subProduct.product?.images]) {
    const images = Array.isArray(source) ? source.filter(image => typeof image?.url === 'string' && image.url.trim()) : [];
    const image = images.find(image => image.isPrimary) || images[0];
    if (image) return image.url.trim();
  }
  return null;
}
module.exports = { stockProductImage };
