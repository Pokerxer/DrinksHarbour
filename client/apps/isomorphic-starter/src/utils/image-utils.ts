export const isValidImageUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return url.startsWith('/');
  }
};

export const getValidImageUrl = (url: string | undefined | null, fallback = '/images/placeholder.jpg'): string => {
  if (!url) return fallback;
  
  if (isValidImageUrl(url)) {
    return url;
  }
  
  return fallback;
};

export const getPrimaryImage = (product: {
  images?: Array<{ url: string; isPrimary?: boolean }>;
  primaryImage?: { url: string };
}): string | undefined => {
  if (!product) return undefined;
  
  const primaryImage = product.images?.find(img => img.isPrimary);
  if (primaryImage?.url) return primaryImage.url;
  
  if (product.primaryImage?.url) return product.primaryImage.url;
  
  if (product.images && product.images.length > 0) {
    return product.images[0].url;
  }
  
  return undefined;
};