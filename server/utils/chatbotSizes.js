// Only plain volume labels are equivalent; pack and descriptive labels stay distinct.
const sizeKey = (label) => {
  const text = String(label || '').trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(ml|cl|l)$/);
  if (!match) return text;
  const ml = Number(match[1]) * { ml: 1, cl: 10, l: 1000 }[match[2]];
  return `${Math.round(ml * 1000) / 1000}ml`;
};

const sizeLabel = (size) => {
  if (typeof size?.size === 'string' && size.size.trim()) return size.size.trim();
  const ml = Number(size?.volumeMl);
  if (!Number.isFinite(ml) || ml <= 0) return null;
  return ml >= 1000 && ml % 1000 === 0 ? `${ml / 1000}L` : `${ml / 10}cl`;
};

// Resolve a proposed bottle and price together. Do not attach another size's
// minimum price to a named variant or silently guess between multiple sizes.
const resolveCartSize = (product, requested) => {
  const wanted = typeof requested === 'string' && requested.trim() ? requested.trim() : null;
  if (!product.sizes?.length) return { label: wanted, price: product.minPrice || 0 };
  const variants = product.sizes.map(size => ({
    label: size.label || sizeLabel(size) || size.name,
    price: size.price ?? size.pricing?.websitePrice ?? size.pricing?.sellingPrice,
  })).filter(size => size.label && Number.isFinite(size.price) && size.price > 0);
  const candidates = wanted
    ? variants.filter(size => sizeKey(size.label) === sizeKey(wanted))
    : variants;
  if (!candidates.length) return null;
  if (!wanted && new Set(candidates.map(size => sizeKey(size.label))).size > 1) return null;
  return candidates.reduce((best, size) => size.price < best.price ? size : best);
};

module.exports = { sizeKey, sizeLabel, resolveCartSize };
