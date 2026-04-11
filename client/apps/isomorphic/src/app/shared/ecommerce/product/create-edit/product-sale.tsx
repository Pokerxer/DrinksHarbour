// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Button, Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';
import { useState, useEffect, useMemo } from 'react';
import {
  PiTag,
  PiPercent,
  PiCalendar,
  PiLightning,
  PiWarning,
  PiCalculator,
  PiCurrencyDollar,
  PiChartLine,
} from 'react-icons/pi';

interface ProductSaleProps {
  className?: string;
}

const saleTypeOptions = [
  { value: 'percentage', label: 'Percentage Off', icon: PiPercent },
  { value: 'fixed', label: 'Fixed Discount', icon: PiCurrencyDollar },
  { value: 'flash_sale', label: 'Flash Sale', icon: PiLightning },
];

const currencySymbols: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export default function ProductSale({ className }: ProductSaleProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const isOnSale = watch('subProductData.isOnSale') || false;
  const saleType = watch('subProductData.saleType') || 'percentage';
  const costPrice = watch('subProductData.costPrice') || 0;
  const markupPercentage = watch('subProductData.markupPercentage') || 25;
  const platformMarkup = watch('subProductData.platformMarkup') || 15;
  const currency = watch('subProductData.currency') || 'NGN';
  const currencySymbol = currencySymbols[currency] || '₦';
  const saleDiscountValue = watch('subProductData.saleDiscountValue') || 0;
  const saleStartDate = watch('subProductData.saleStartDate');
  const saleEndDate = watch('subProductData.saleEndDate');

  const pricing = useMemo(() => {
    const cost = costPrice || 0;
    const markup = markupPercentage || 0;
    const pMarkup = platformMarkup || 0;
    
    const tenantSellingPrice = cost * (1 + markup / 100);
    const platformCostPrice = tenantSellingPrice * (1 + pMarkup / 100);
    const finalPlatformPrice = Math.round(platformCostPrice);
    
    return {
      costPrice: cost,
      tenantSellingPrice: Math.round(tenantSellingPrice),
      platformCostPrice: Math.round(platformCostPrice),
      finalPlatformPrice,
    };
  }, [costPrice, markupPercentage, platformMarkup]);

  const [calculatedSalePrice, setCalculatedSalePrice] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  useEffect(() => {
    if (isOnSale && pricing.finalPlatformPrice && saleDiscountValue) {
      let salePrice = 0;
      let discount = 0;
      
      if (saleType === 'percentage') {
        discount = pricing.finalPlatformPrice * saleDiscountValue / 100;
        salePrice = pricing.finalPlatformPrice - discount;
      } else if (saleType === 'fixed') {
        discount = Math.min(saleDiscountValue, pricing.finalPlatformPrice);
        salePrice = pricing.finalPlatformPrice - discount;
      }
      
      setCalculatedSalePrice(Math.max(0, salePrice));
      setDiscountAmount(discount);
    } else {
      setCalculatedSalePrice(0);
      setDiscountAmount(0);
    }
  }, [isOnSale, pricing.finalPlatformPrice, saleDiscountValue, saleType]);

  const toggleSale = (enabled: boolean) => {
    setValue('subProductData.isOnSale', enabled);
    if (!enabled) {
      setValue('subProductData.salePrice', null);
      setValue('subProductData.saleDiscountValue', 0);
      setValue('subProductData.saleStartDate', null);
      setValue('subProductData.saleEndDate', null);
    }
  };

  const isSaleActive = () => {
    if (!isOnSale) return false;
    const now = new Date();
    const start = saleStartDate ? new Date(saleStartDate) : null;
    const end = saleEndDate ? new Date(saleEndDate) : null;
    
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  };

  const isExpired = () => {
    if (!isOnSale || !saleEndDate) return false;
    return new Date() > new Date(saleEndDate);
  };

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString()}`;
  };

  const actualDiscountPercentage = pricing.finalPlatformPrice > 0 
    ? ((discountAmount / pricing.finalPlatformPrice) * 100).toFixed(1)
    : '0';

  return (
    <FormGroup
      title="Sale Pricing"
      description="Configure sale prices, discounts, and promotional offers based on final platform price"
      className={cn(className)}
    >
      {/* Sale Toggle */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isOnSale ? 'bg-red-100' : 'bg-gray-100'}`}>
              <PiTag className={`h-5 w-5 ${isOnSale ? 'text-red-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <Text className="font-semibold text-gray-900">On Sale</Text>
              <Text className="text-xs text-gray-500">Enable sale pricing for this product</Text>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={isOnSale}
              onChange={(e) => toggleSale(e.target.checked)}
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-md after:transition-all after:content-[''] peer-checked:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
          </label>
        </div>

        {isOnSale && (
          <div className="mt-4 flex gap-2">
            {isSaleActive() && (
              <Badge color="success" variant="flat" size="sm">
                Active
              </Badge>
            )}
            {isExpired() && (
              <Badge color="danger" variant="flat" size="sm">
                Expired
              </Badge>
            )}
            {saleStartDate && new Date() < new Date(saleStartDate) && (
              <Badge color="info" variant="flat" size="sm">
                Scheduled
              </Badge>
            )}
          </div>
        )}
      </div>

      {isOnSale && (
        <>
          {/* Pricing Summary */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <PiChartLine className="h-5 w-5 text-blue-600" />
              <Text className="font-semibold text-gray-900">Platform Price Breakdown</Text>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500 text-xs mb-1">Supplier Cost</div>
                <div className="font-bold text-gray-900">{formatCurrency(pricing.costPrice)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500 text-xs mb-1">Tenant Price (×{markupPercentage}%)</div>
                <div className="font-bold text-gray-900">{formatCurrency(pricing.tenantSellingPrice)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500 text-xs mb-1">Platform Cost (×{platformMarkup}%)</div>
                <div className="font-bold text-gray-900">{formatCurrency(pricing.platformCostPrice)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-gray-500 text-xs mb-1">Final Platform Price</div>
                <div className="font-bold text-green-600">{formatCurrency(pricing.finalPlatformPrice)}</div>
              </div>
            </div>
            <Text className="text-xs text-gray-500 mt-2">
              Sale discount is calculated from the final platform price (what customers see on the platform)
            </Text>
          </div>

          <div className="grid gap-6 @2xl:grid-cols-2">
            {/* Sale Type */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <PiPercent className="h-4 w-4 text-blue-500" />
                Sale Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {saleTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setValue('subProductData.saleType', option.value)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all',
                      saleType === option.value
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <option.icon className="mb-1 h-5 w-5" />
                    <span className="text-xs font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Discount Value */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <PiCalculator className="h-4 w-4 text-green-500" />
                {saleType === 'percentage' ? 'Discount Percentage' : 'Fixed Discount'}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max={saleType === 'percentage' ? 100 : pricing.finalPlatformPrice}
                  step="0.01"
                  placeholder={saleType === 'percentage' ? 'e.g., 20' : `e.g., ${Math.round(pricing.finalPlatformPrice * 0.2)}`}
                  {...register('subProductData.saleDiscountValue', { valueAsNumber: true })}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500">{saleType === 'percentage' ? '%' : currencySymbol}</span>
                </div>
              </div>
              <Text className="mt-2 text-xs text-gray-500">
                Applied to final platform price of {formatCurrency(pricing.finalPlatformPrice)}
              </Text>
            </div>

            {/* Sale Start Date */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <PiCalendar className="h-4 w-4 text-purple-500" />
                Sale Start Date
              </label>
              <Input
                type="datetime-local"
                {...register('subProductData.saleStartDate')}
              />
              <Text className="mt-2 text-xs text-gray-500">
                Leave blank for immediate start
              </Text>
            </div>

            {/* Sale End Date */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <PiCalendar className="h-4 w-4 text-orange-500" />
                Sale End Date
              </label>
              <Input
                type="datetime-local"
                {...register('subProductData.saleEndDate')}
              />
              <Text className="mt-2 text-xs text-gray-500">
                Leave blank for no end date
              </Text>
            </div>

            {/* Sale Price Preview */}
            {calculatedSalePrice > 0 && (
              <div className="@2xl:col-span-2 rounded-xl border-2 border-red-200 bg-red-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-medium text-gray-600">Calculated Sale Price</Text>
                    <Text className="text-3xl font-bold text-red-600">{formatCurrency(calculatedSalePrice)}</Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      You save {formatCurrency(discountAmount)} ({actualDiscountPercentage}% off)
                    </Text>
                  </div>
                  <div className="text-right">
                    <Text className="text-sm text-gray-500">Original Price</Text>
                    <Text className="text-lg font-medium text-gray-400 line-through">{formatCurrency(pricing.finalPlatformPrice)}</Text>
                  </div>
                </div>
                {saleDiscountValue > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Badge color="danger" size="sm">
                      {saleType === 'percentage' ? `${saleDiscountValue}% OFF` : `${formatCurrency(saleDiscountValue)} OFF`}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Manual Sale Price Override */}
            <div className="@2xl:col-span-2 rounded-xl border border-gray-200 bg-white p-5">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <PiCurrencyDollar className="h-4 w-4 text-teal-500" />
                Manual Sale Price (Optional)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={`Leave empty to use calculated price (${formatCurrency(calculatedSalePrice)})`}
                {...register('subProductData.salePrice', { valueAsNumber: true })}
              />
              <Text className="mt-2 text-xs text-gray-500">
                Override the calculated sale price with a custom value
              </Text>
            </div>
          </div>
        </>
      )}

      {!isOnSale && pricing.finalPlatformPrice > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <PiChartLine className="h-5 w-5 text-gray-400" />
            <Text className="font-semibold text-gray-700">Current Platform Price</Text>
          </div>
          <Text className="text-2xl font-bold text-gray-900">{formatCurrency(pricing.finalPlatformPrice)}</Text>
          <Text className="text-xs text-gray-500 mt-1">
            Based on cost {formatCurrency(costPrice)} + markup {markupPercentage}% + platform {platformMarkup}%
          </Text>
        </div>
      )}

      {!isOnSale && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <PiWarning className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          <Text className="text-gray-500">Sale pricing is disabled. Toggle "On Sale" above to enable.</Text>
        </div>
      )}
    </FormGroup>
  );
}