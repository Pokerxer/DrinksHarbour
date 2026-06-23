import { ProductType } from '@/types/product.types';

export const calculateDiscountPercentage = (price: number, originPrice?: number): number => {
  if (!originPrice || originPrice <= price) return 0;
  return Math.floor(100 - (price / originPrice) * 100);
};

export const calculateSoldPercentage = (sold: number, quantity: number): number => {
  if (quantity <= 0) return 0;
  return Math.floor((sold / quantity) * 100);
};

export const isNewProduct = (createdAt: string | Date): boolean => {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  return now - created < sevenDaysInMs;
};

export const formatPrice = (price: number, currency: string = 'NGN'): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};
