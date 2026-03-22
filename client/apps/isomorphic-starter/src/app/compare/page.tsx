'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useCompare } from '@/context/CompareContext';
import { ProductType } from '@/types/product.types';
import Rate from '@/components/Other/Rate';

const ComparePage = () => {
  const { compareState, removeFromCompare, clearCompare, compareCount } = useCompare();

  const formatPrice = (price: number | undefined | null, currencySymbol: string = '₦') => {
    if (price == null || isNaN(price)) return `${currencySymbol}0`;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getCurrencySymbol = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currency_symbol') || '₦';
    }
    return '₦';
  };

  const getProductBadge = (product: ProductType) => {
    if (product.sale && product.originPrice && product.originPrice > product.price) {
      return { text: 'Sale', className: 'bg-red-500' };
    }
    if (product.badge) {
      return { text: product.badge.text, className: 'bg-emerald-500' };
    }
    if (product.new) {
      return { text: 'New', className: 'bg-blue-500' };
    }
    return null;
  };

  const comparisonFields = useMemo(() => [
    { label: 'Price', key: 'price', format: (v: any) => formatPrice(v, getCurrencySymbol()) },
    { label: 'Original Price', key: 'originPrice', format: (v: any) => v ? formatPrice(v, getCurrencySymbol()) : '-' },
    { label: 'Discount', key: 'discount', format: (v: any) => v ? `${v}% OFF` : '-' },
    { label: 'Rating', key: 'rating', format: (v: any, p: ProductType) => v ? (
      <div className="flex items-center gap-2">
        <Rate currentRate={v} size={14} />
        <span className="text-sm text-gray-600">({p.reviewCount || 0})</span>
      </div>
    ) : '-' },
    { label: 'ABV', key: 'abv', format: (v: any) => v ? `${v}% ABV` : 'Non-Alcoholic' },
    { label: 'Volume', key: 'volumeMl', format: (v: any) => v ? `${v}ml` : '-' },
    { label: 'Type', key: 'type' },
    { label: 'Category', key: 'category', format: (v: any) => v?.name || v || '-' },
    { label: 'Brand', key: 'brand', format: (v: any) => v?.name || '-' },
    { label: 'Origin', key: 'originCountry', format: (v: any) => v || '-' },
    { label: 'Region', key: 'region', format: (v: any) => v || '-' },
    { label: 'Producer', key: 'producer', format: (v: any) => v || '-' },
    { label: 'SKU', key: 'sku', format: (v: any) => v || '-' },
    { label: 'Barcode', key: 'barcode', format: (v: any) => v || '-' },
    { label: 'Flavors', key: 'flavors', format: (v: any) => v?.map((f: any) => f.name).join(', ') || '-' },
    { label: 'Tasting Notes', key: 'tastingNotes', format: (v: any) => {
      if (!v) return '-';
      const notes = [...(v.aroma || []), ...(v.palate || []), ...(v.finish || [])];
      return notes.length > 0 ? notes.join(', ') : '-';
    }},
    { label: 'Stock Status', key: 'availability', format: (v: any, p: ProductType) => {
      if (v?.inStock !== undefined) {
        return v.inStock ? (
          <span className="text-green-600 font-medium">In Stock</span>
        ) : (
          <span className="text-red-600 font-medium">Out of Stock</span>
        );
      }
      return p.quantity !== undefined ? (
        p.quantity > 0 ? (
          <span className="text-green-600 font-medium">In Stock ({p.quantity})</span>
        ) : (
          <span className="text-red-600 font-medium">Out of Stock</span>
        )
      ) : '-';
    }},
  ], []);

  if (compareCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-xl mx-auto text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Icon.PiScales size={48} className="text-gray-400" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              No Products to Compare
            </h1>
            <p className="text-gray-600 mb-8">
              Add products to your comparison list to see them side-by-side. 
              Visit the shop to explore our selection of beverages.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Icon.PiShoppingCart size={20} />
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <Icon.PiScales size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Compare Products</h1>
                <p className="text-sm text-gray-500">
                  {compareCount} product{compareCount !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={clearCompare}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Icon.PiTrash size={18} />
                Clear All
              </button>
              <Link
                href="/shop"
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Icon.PiPlus size={18} />
                Add More
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Product Headers */}
          <div className="grid grid-cols-[200px_repeat(4,1fr)] border-b border-gray-200">
            {/* Empty corner cell */}
            <div className="p-4 bg-gray-50 border-r border-gray-200" />
            
            {/* Product columns */}
            {compareState.compareArray.map((product, index) => {
              const badge = getProductBadge(product);
              return (
                <motion.div
                  key={product.id || product._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border-r border-gray-200 last:border-r-0"
                >
                  {/* Remove button */}
              <button
                onClick={() => removeFromCompare(product._id || product.id || '')}
                className="absolute top-4 right-4 w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors"
              >
                <Icon.PiX size={16} />
              </button>
                  
                  {/* Product image */}
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-4">
                    {product.images && product.images.length > 0 ? (
                      <Image
                        src={typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon.PiImage size={48} className="text-gray-400" />
                      </div>
                    )}
                    
                    {/* Badge */}
                    {badge && (
                      <div className={`absolute top-2 left-2 px-2 py-1 ${badge.className} text-white text-xs font-bold rounded-lg`}>
                        {badge.text}
                      </div>
                    )}
                  </div>
                  
                  {/* Product info */}
                  <Link href={`/product/${product.slug || product.id || product._id}`}>
                    <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 hover:text-amber-600 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  {product.brand?.name && (
                    <p className="text-sm text-gray-500 mb-2">{product.brand.name}</p>
                  )}
                  <p className="text-lg font-bold text-gray-900">
                    {formatPrice(product.price, getCurrencySymbol())}
                  </p>
                  {product.originPrice && product.originPrice > product.price && (
                    <p className="text-sm text-gray-400 line-through">
                      {formatPrice(product.originPrice, getCurrencySymbol())}
                    </p>
                  )}
                  
                  {/* Add to cart */}
                  <Link
                    href={`/product/${product.slug || product.id || product._id}`}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    <Icon.PiShoppingCart size={16} />
                    View Details
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Comparison Rows */}
          {comparisonFields.map((field, fieldIndex) => (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + fieldIndex * 0.05 }}
              className={`grid grid-cols-[200px_repeat(4,1fr)] border-b border-gray-100 ${
                fieldIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              }`}
            >
              {/* Field label */}
              <div className="p-4 font-medium text-gray-700 bg-gray-50 border-r border-gray-200 flex items-center">
                {field.label}
              </div>
              
              {/* Field values */}
              {compareState.compareArray.map((product) => {
                const value = product[field.key as keyof ProductType];
                return (
                  <div
                    key={`${product.id || product._id}-${field.key}`}
                    className="p-4 border-r border-gray-100 last:border-r-0 flex items-center"
                  >
                    {typeof field.format === 'function' 
                      ? field.format(value, product)
                      : value || '-'
                    }
                  </div>
                );
              })}
            </motion.div>
          ))}

          {/* Description Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-[200px_repeat(4,1fr)]"
          >
            <div className="p-4 font-medium text-gray-700 bg-gray-50 border-r border-gray-200 flex items-start">
              Description
            </div>
            {compareState.compareArray.map((product) => (
              <div
                key={`${product.id || product._id}-description`}
                className="p-4 border-r border-gray-100 last:border-r-0"
              >
                <p className="text-sm text-gray-600 line-clamp-4">
                  {product.shortDescription || product.description || 'No description available.'}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Recommendations */}
        {compareCount < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon.PiInfo size={24} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">
                  Add More Products to Compare
                </h3>
                <p className="text-gray-600 mb-4">
                  Add at least one more product to see a detailed side-by-side comparison. 
                  We recommend comparing 2-4 products for the best experience.
                </p>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
                >
                  <Icon.PiPlus size={18} />
                  Add Products to Compare
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ComparePage;
