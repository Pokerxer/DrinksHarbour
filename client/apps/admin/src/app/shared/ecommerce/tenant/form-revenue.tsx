'use client';

import { Controller } from 'react-hook-form';

import { Input, Select, type SelectOption } from 'rizzui';

import { TenantFormInput } from '@/validators/create-tenant.schema';

import { useFormContext } from 'react-hook-form';
import { Card, FieldGrid, asOptionalNumber, asClearableNumber } from './form-controls';

import { REVENUE_MODEL_OPTIONS } from './form-options';

export function RevenueFields() {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<TenantFormInput>();
  const revenueModelValue = watch('revenueModel');
  return (<>
{/* ── Revenue ── */}
            <div
              className="space-y-6"
            >
              <Card
                title="Revenue Model"
                description={
                  revenueModelValue === 'commission'
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
                          REVENUE_MODEL_OPTIONS.find(
                            (o) => o.value === value
                          ) ?? null
                        }
                        onChange={(opt: SelectOption) =>
                          onChange(opt.value)
                        }
                        label="Revenue Model"
                        placeholder="Select model"
                        error={errors.revenueModel?.message}
                      />
                    )}
                  />
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
                </FieldGrid>
              </Card>

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
            </div>

              </>);
}
