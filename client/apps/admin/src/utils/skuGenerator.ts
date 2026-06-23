// utils/skuGenerator.ts
// Client-side SKU generation matching server logic

/**
 * Generates SKU format: {PRODUCT_NAME_PREFIX}-{PRODUCT_ID_SUFFIX}-{TENANT_PREFIX}-{TIMESTAMP}
 * Example: "COCA-A7B3-T3N4-X7K9"
 */
export const generateSKU = (
  productId: string,
  tenantId: string,
  productName: string
): string => {
  // Extract first 4 chars of product name (letters only)
  const namePrefix = productName
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 4)
    .toUpperCase();
  
  // Extract last 4 chars of product ID
  const productSuffix = productId.slice(-4).toUpperCase();
  
  // Extract last 4 chars of tenant ID
  const tenantPrefix = tenantId.slice(-4).toUpperCase();
  
  // Timestamp: last 4 chars of base36 timestamp
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  
  // If product name is too short, pad with product ID chars
  const finalNamePrefix = namePrefix.length >= 3 
    ? namePrefix 
    : namePrefix + productId.slice(0, 4 - namePrefix.length).toUpperCase();
  
  return `${finalNamePrefix}-${productSuffix}-${tenantPrefix}-${timestamp}`;
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

export default generateSKU;
