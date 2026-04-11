'use client';

import React from 'react';
import Image from 'next/image';
import { ProductType } from '@/types/product.types';

interface ProductInfoProps {
  data: ProductType;
  style?: string;
  activeColor?: string;
  percentSale?: number;
  percentSold?: number;
  onColorSelect?: (color: string) => void;
  onAddToCart?: () => void;
};

interface VendorSaleInfo {
  isOnSale: boolean;
  salePrice?: number;
  saleDiscountValue?: number;
  saleType?: string;
  saleStartDate?: string;
  saleEndDate?: string;
}

const ProductInfo: React.FC<ProductInfoProps> = ({
  data,
  style = 'style-1',
  activeColor,
  percentSale = 0,
  percentSold = 0,
  onColorSelect,
  onAddToCart,
}) => {
  // Get sale info from availableAt (vendors)
  const vendorSaleInfo: VendorSaleInfo | null = React.useMemo(() => {
    const availableAt = (data as any)?.availableAt;
    if (!Array.isArray(availableAt) || availableAt.length === 0) return null;
    
    for (const vendor of availableAt) {
      if (vendor.isOnSale === true) {
        // Check if sale is active based on dates
        const now = new Date();
        const startDate = vendor.saleStartDate ? new Date(vendor.saleStartDate) : null;
        const endDate = vendor.saleEndDate ? new Date(vendor.saleEndDate) : null;
        
        let isActive = true;
        if (startDate && now < startDate) isActive = false;
        if (endDate && now > endDate) isActive = false;
        
        if (isActive) {
          return {
            isOnSale: true,
            salePrice: vendor.salePrice,
            saleDiscountValue: vendor.saleDiscountValue,
            saleType: vendor.saleType,
          };
        }
      }
    }
    return null;
  }, [data]);

  // Calculate sale percentage from vendor info
  const calculatedSalePercent = React.useMemo(() => {
    if (!vendorSaleInfo?.isOnSale) return 0;
    return vendorSaleInfo.saleDiscountValue || 0;
  }, [vendorSaleInfo]);

  // Determine if product is on sale (from props or vendor info)
  const isOnSale = percentSale > 0 || (vendorSaleInfo?.isOnSale && !!data.originPrice && (data.originPrice || 0) > (data.price || 0));

  // Get effective sale price if vendor has sale
  const displayPrice = React.useMemo(() => {
    if (vendorSaleInfo?.isOnSale && vendorSaleInfo.salePrice && vendorSaleInfo.salePrice > 0) {
      return vendorSaleInfo.salePrice;
    }
    return data.price;
  }, [data.price, vendorSaleInfo]);

  const renderColorVariations = () => {
const renderColorVariations = () => {
  if (!data.variation || data.variation.length === 0) return null;

    return (
<div className="list-color py-2 max-md:hidden flex items-center gap-2 flex-wrap">
        {data.variation.map((item, index) => (
          <div
            key={index}
            className={`color-item w-6 h-6 rounded-full duration-300 relative cursor-pointer ${
              activeColor === item.color ? 'ring-2 ring-black scale-110' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: item.colorCode }}
            onClick={(e) => {
              e.stopPropagation();
              onColorSelect?.(item.color);
            }}
            title={item.color}
          >
            <div className="tag-action bg-black-900 text-gray-50 caption2 capitalize px-1.5 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
              {item.color}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderProgressBar = () => {
    if ((data.quantity || 0) <= 0) return null;
    const soldPercentage = Math.min(((data.sold || 0) / (data.quantity || 1)) * 100, 100);
    const available = (data.quantity || 0) - (data.sold || 0);

    return (
<div className="product-sold sm:pb-4 pb-2">
        <div className="progress bg-gray-200 h-1.5 w-full rounded-full overflow-hidden relative">
          <div
            className="progress-sold bg-red-500 absolute left-0 top-0 h-full transition-all duration-500"
            style={{ width: `${soldPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
          <div className="text-sm">
            <span className="text-gray-600">Sold: </span>
            <span className="font-medium">{data.sold}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Available: </span>
            <span className={`font-medium ${available <= 10 ? 'text-red' : 'text-green'}`}>
              {available}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderPrice = () => {
    // Use the calculated values from useMemo
    const effectivePercentSale = vendorSaleInfo?.isOnSale ? calculatedSalePercent : percentSale;
    const effectiveIsOnSale = isOnSale;
    const effectivePrice = displayPrice;

    return (
      <div className="product-price-block flex items-center gap-2 flex-wrap mt-1">
        <div className="product-price text-lg font-bold">${effectivePrice.toLocaleString()}</div>
        {effectiveIsOnSale && data.originPrice && data.originPrice > effectivePrice && (
          <>
            <div className="product-origin-price text-sm text-gray-500 line-through">
              ${data.originPrice?.toLocaleString()}
            </div>
            <div className="product-sale text-xs font-medium bg-red-500 text-gray-50 px-2 py-0.5 rounded-full">
              -{effectivePercentSale}%
            </div>
          </>
        )}
      </div>
    );
  };

  return (
<div className="product-info">
      {renderProgressBar()}
      <h3 className="product-name text-base font-medium line-clamp-2 hover:text-green transition-colors mb-1">
        {data.name}
      </h3>
      {renderColorVariations()}
      {renderPrice()}
      {style === 'style-5' && onAddToCart && (
        <button
          className="w-full mt-3 py-2.5 text-sm font-medium rounded-full bg-black-900 text-gray-50 hover:bg-gray-800 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart();
          }}
        >
          Add to Cart
        </button>
      )}
    </div>
  );
};

export default ProductInfo;
