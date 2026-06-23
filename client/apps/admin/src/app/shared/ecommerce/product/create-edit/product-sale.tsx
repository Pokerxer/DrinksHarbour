// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';

import {
  PiTag,
  PiPercent,
  PiCalendar,
  PiLightning,
  PiWarning,
  PiCalculator,
  PiCurrencyDollar,
} from 'react-icons/pi';

interface ProductSaleProps {
  className?: string;
}

const saleTypeOptions = [
  { value: 'percentage', label: 'Percentage Off', icon: PiPercent },
  { value: 'fixed', label: 'Fixed Discount', icon: PiCurrencyDollar },
  { value: 'flash_sale', label: 'Flash Sale', icon: PiLightning },
];

export default function ProductSale({ className }: ProductSaleProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const isOnSale = watch('subProductData.isOnSale') || false;
  const saleType = watch('subProductData.saleType') || 'percentage';
  const saleDiscountValue = watch('subProductData.saleDiscountValue') || 0;
  const saleStartDate = watch('subProductData.saleStartDate');
  const saleEndDate = watch('subProductData.saleEndDate');

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
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  return (
    <FormGroup
      title="Sale Pricing"
      description="Configure sale prices, discounts, and promotional offers"
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
              <Text className="text-xs text-gray-500">Enable sale pricing for all variants of this product</Text>
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
              {saleType === 'fixed' ? 'Fixed Discount Amount' : 'Discount Percentage'}
            </label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max={saleType !== 'fixed' ? 100 : undefined}
                step={saleType === 'fixed' ? '1' : '0.01'}
                placeholder={saleType === 'fixed' ? 'e.g., 500' : 'e.g., 20'}
                {...register('subProductData.saleDiscountValue', { valueAsNumber: true })}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-500">{saleType === 'fixed' ? '₦' : '%'}</span>
              </div>
            </div>
            {saleType !== 'fixed' && (
              <p className="mt-1.5 text-xs text-gray-500">Enter a value between 0 and 100</p>
            )}
            {saleType === 'fixed' && (
              <p className="mt-1.5 text-xs text-gray-500">Amount deducted from the platform selling price</p>
            )}
          </div>

          {/* Sale Start Date */}
          <div className={cn('rounded-xl border bg-white p-5', saleType === 'flash_sale' ? 'border-orange-300' : 'border-gray-200')}>
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PiCalendar className="h-4 w-4 text-purple-500" />
              Sale Start Date
              {saleType === 'flash_sale' && <span className="text-[10px] font-normal text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">Required for Flash Sale</span>}
            </label>
            <Input
              type="datetime-local"
              {...register('subProductData.saleStartDate')}
            />
            <Text className="mt-2 text-xs text-gray-500">
              {saleType === 'flash_sale' ? 'When the flash sale countdown begins' : 'Leave blank for immediate start'}
            </Text>
          </div>

          {/* Sale End Date */}
          <div className={cn('rounded-xl border bg-white p-5', saleType === 'flash_sale' ? 'border-orange-300' : 'border-gray-200')}>
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PiCalendar className="h-4 w-4 text-orange-500" />
              Sale End Date
              {saleType === 'flash_sale' && <span className="text-[10px] font-normal text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">Required for Flash Sale</span>}
            </label>
            <Input
              type="datetime-local"
              {...register('subProductData.saleEndDate')}
            />
            <Text className="mt-2 text-xs text-gray-500">
              {saleType === 'flash_sale' ? 'Countdown timer on storefront uses this date' : 'Leave blank for no end date'}
            </Text>
          </div>

          {/* Sale Discount Preview */}
          {isOnSale && saleDiscountValue > 0 && (
            <div className="@2xl:col-span-2 rounded-xl border-2 border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-3">
                <Badge color="danger" size="lg">
                  {saleType === 'fixed'
                    ? `${formatCurrency(saleDiscountValue)} OFF`
                    : saleType === 'flash_sale'
                      ? `⚡ ${saleDiscountValue}% OFF`
                      : `${saleDiscountValue}% OFF`}
                </Badge>
                <Text className="text-sm text-gray-600">
                  {saleType === 'fixed'
                    ? <>Fixed <strong>₦{saleDiscountValue.toLocaleString()}</strong> deducted from the platform price of each variant.</>
                    : saleType === 'flash_sale'
                      ? <>Flash sale — <strong>{saleDiscountValue}%</strong> off platform price. Countdown shown on storefront.</>
                      : <><strong>{saleDiscountValue}%</strong> off platform price applied to all variants across all tenants.</>}
                </Text>
              </div>
            </div>
          )}

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