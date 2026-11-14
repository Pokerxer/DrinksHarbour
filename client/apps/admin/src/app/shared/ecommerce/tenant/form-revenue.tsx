'use client';

import { Controller, useFormContext } from 'react-hook-form';

import { Input, Select, type SelectOption } from 'rizzui';

import { TenantFormInput } from '@/validators/create-tenant.schema';

import {
  Card,
  FieldGrid,
  asOptionalNumber,
  asClearableNumber,
} from './form-controls';

import { REVENUE_MODEL_OPTIONS } from './form-options';

export function RevenueFields() {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<TenantFormInput>();
  const revenueModelValue = watch('revenueModel');
  return (
    <>
      {/* ── Revenue ── */}
      <div className="space-y-6">
        <Card
          title="Revenue Model"
          description={
            revenueModelValue === 'selling_price_markup'
              ? 'Adds a platform percentage to tenant selling price. Tenant receives their selling price; product overrides retain their own percentage.'
              : revenueModelValue === 'commission'
                ? 'Commission: the tenant is paid the item price less the commission percentage.'
                : 'Markup: the selling price is the tenant cost plus the markup percentage.'
          }
        >
          <FieldGrid>
            <Controller
              name="revenueModel"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Select
                  options={REVENUE_MODEL_OPTIONS}
                  value={
                    REVENUE_MODEL_OPTIONS.find((o) => o.value === value) ?? null
                  }
                  onChange={(opt) => onChange((opt as SelectOption).value)}
                  label="Revenue Model"
                  placeholder="Select model"
                  error={errors.revenueModel?.message}
                />
              )}
            />
            {revenueModelValue === 'selling_price_markup' ? (
              <Input
                label="Selling-price markup %"
                type="number"
                min={0}
                max={500}
                step="any"
                {...register('sellingPriceMarkupPercentage', {
                  setValueAs: asOptionalNumber,
                })}
                error={errors.sellingPriceMarkupPercentage?.message}
              />
            ) : (
              <>
                <Input
                  label="Markup %"
                  type="number"
                  placeholder="40"
                  {...register('markupPercentage', {
                    setValueAs: asOptionalNumber,
                  })}
                  error={errors.markupPercentage?.message}
                />
                <Input
                  label="Commission %"
                  type="number"
                  placeholder="12"
                  {...register('commissionPercentage', {
                    setValueAs: asOptionalNumber,
                  })}
                  error={errors.commissionPercentage?.message}
                />
                <Input
                  label="Platform Markup %"
                  type="number"
                  placeholder="15"
                  {...register('platformMarkupPercentage', {
                    setValueAs: asOptionalNumber,
                  })}
                  error={errors.platformMarkupPercentage?.message}
                />
              </>
            )}
          </FieldGrid>
        </Card>

        {revenueModelValue !== 'selling_price_markup' && (
          <Card
            title="Pack Rates"
            description="Reduced rates for multi-pack sizes. Leave a rate empty to charge packs at the normal rate."
          >
            <FieldGrid>
              <Input
                label="Pack Markup %"
                type="number"
                placeholder="Empty = use normal markup"
                {...register('packMarkupPercentage', {
                  setValueAs: asClearableNumber,
                })}
                error={errors.packMarkupPercentage?.message}
              />
              <Input
                label="Pack Commission %"
                type="number"
                placeholder="Empty = use normal commission"
                {...register('packCommissionPercentage', {
                  setValueAs: asClearableNumber,
                })}
                error={errors.packCommissionPercentage?.message}
              />
              <Input
                label="Pack Rate Min Units"
                type="number"
                placeholder="2"
                {...register('packRateMinUnits', {
                  setValueAs: asClearableNumber,
                })}
                error={errors.packRateMinUnits?.message}
              />
            </FieldGrid>
            <div className="mt-4">
              <Input
                label="Custom Pricing Note"
                placeholder="Any custom pricing notes..."
                {...register('customPricingNote')}
                error={errors.customPricingNote?.message}
              />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
