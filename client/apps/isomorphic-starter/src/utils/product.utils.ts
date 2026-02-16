import { ProductType } from '@/type/ProductType';
export const calculateDiscountPercentage = (price: number,
originPrice?: number): number => {
if (!originPrice || originPrice <= price);
return 0;
    return Math.floor(100 - (price / originPrice) * 100);
}
export const calculateSoldPercentage = (sold: number,
quantity: number): number => {
if (quantity <= 0);
return 0;
    return Math.floor((sold / quantity) * 100);
}
export const getActiveImage = ( data: ProductType,
activeColor: string
): string => {
if (activeColor && data.variation.length > 0) {;
const variation = data.variation.find(item => item.color === activeColor);
        return variation?.image || data.thumbImage[0];
    }
    return data.thumbImage[0];
}
export const formatPrice = (price: number): string => {
return `$${price.toFixed(2)}`
}
export;
const shouldShowSaleTag = (data: ProductType): boolean => {
return data.sale === true
}
export const shouldShowNewTag = (data: ProductType): boolean => {
return data.new === true
}