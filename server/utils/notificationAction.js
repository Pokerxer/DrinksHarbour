const CHILDREN = new Set([
  'stock',
  'warehouses',
  'performance',
  'forecasts',
  'restock',
  'vendor-orders',
  'products',
  'expiry',
]);
function safeNotificationAction(value) {
  if (typeof value !== 'string' || value.length > 500) return false;
  if (
    /^\/(?:inventory\/stock|sub-products(?:\/[a-f\d]{24})?|ecommerce\/reviews|products\/pending)\/?$/.test(
      value,
    )
  )
    return true;
  if (!value.startsWith('/notifications/')) return false;
  const [path, query, ...rest] = value.split('?');
  if (
    rest.length ||
    !CHILDREN.has(path.slice('/notifications/'.length)) ||
    value.includes('#')
  )
    return false;
  const params = new URLSearchParams(query || '');
  const seen = new Set();
  for (const [name, id] of params) {
    if (
      !['warehouseId', 'subProductId', 'sizeId'].includes(name) ||
      seen.has(name) ||
      !/^[a-f\d]{24}$/i.test(id)
    )
      return false;
    seen.add(name);
  }
  return true;
}
module.exports = { safeNotificationAction };
