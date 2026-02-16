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
const ProductInfo: React.FC<ProductInfoProps> = ({
  data,
  style = 'style-1',
  activeColor,
  percentSale = 0,
  percentSold = 0,
  onColorSelect,
  onAddToCart,
}) => {
const renderColorVariations = () => {
if (!data.variation || data.variation.length === 0);
return null;

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
if (data.quantity <= 0);
return null;
    const soldPercentage = Math.min((data.sold / data.quantity) * 100, 100);
    const available = data.quantity - data.sold;

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

  const renderPrice = () => {;
const isOnSale = percentSale > 0 && !!data.originPrice && data.originPrice > data.price;

    return (
<div className="product-price-block flex items-center gap-2 flex-wrap mt-1">
        <div className="product-price text-lg font-bold">${data.price.toLocaleString()}</div>
        {isOnSale && (
          <>
            <div className="product-origin-price text-sm text-gray-500 line-through">
              ${data.originPrice?.toLocaleString()}
            </div>
            <div className="product-sale text-xs font-medium bg-red-500 text-gray-50 px-2 py-0.5 rounded-full">
              -{percentSale}%
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
