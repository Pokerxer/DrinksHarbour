'use client';

import { Controller } from 'react-hook-form';

import { Input, Select, Text, type SelectOption } from 'rizzui';

import { TenantFormInput } from '@/validators/create-tenant.schema';

import { useFormContext } from 'react-hook-form';
import { Card, FieldGrid, VisibilityToggle, asOptionalNumber } from './form-controls';

import { CURRENCY_OPTIONS, BILL_CONTROL_OPTIONS } from './form-options';
import type { TenantFormMeta } from './form-types';

export function OperationsFields({ meta }: { meta?: TenantFormMeta }) {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<TenantFormInput>();
  return (<>
{/* ── Operations ── */}
            <div
              className="space-y-6"
            >
              <Card
                title="Address"
                description="Editing any address line re-runs geocoding, which updates the coordinates used for shipping distance."
              >
                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <div className="@xl:col-span-2">
                    <Input
                      label="Street"
                      placeholder="e.g. 12 Adeola Odeku Street"
                      {...register('addressStreet')}
                      error={errors.addressStreet?.message}
                    />
                  </div>
                  <Input
                    label="City"
                    placeholder="e.g. Victoria Island"
                    {...register('addressCity')}
                    error={errors.addressCity?.message}
                  />
                  <Input
                    label="LGA"
                    placeholder="e.g. Eti-Osa"
                    {...register('addressLga')}
                    error={errors.addressLga?.message}
                  />
                  <Input
                    label="State"
                    placeholder="e.g. Lagos"
                    {...register('addressState')}
                    error={errors.addressState?.message}
                  />
                  <Input
                    label="Zip Code"
                    placeholder="e.g. 101241"
                    {...register('addressZipCode')}
                    error={errors.addressZipCode?.message}
                  />
                  <Input
                    label="Country"
                    placeholder="e.g. Nigeria"
                    {...register('addressCountry')}
                    error={errors.addressCountry?.message}
                  />
                </div>
                {meta?.location?.lat != null && (
                  <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    <span>
                      Lat:{' '}
                      <span className="font-mono font-medium text-gray-700">
                        {meta.location.lat}
                      </span>
                    </span>
                    <span>
                      Lon:{' '}
                      <span className="font-mono font-medium text-gray-700">
                        {meta.location.lon}
                      </span>
                    </span>
                    {meta.normalizedState && (
                      <span>
                        Shipping zone:{' '}
                        <span className="font-medium text-gray-700">
                          {meta.normalizedState}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </Card>

              <Card title="Currency">
                <FieldGrid>
                  <Controller
                    name="defaultCurrency"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={CURRENCY_OPTIONS}
                        value={
                          CURRENCY_OPTIONS.find((o) => o.value === value) ??
                          null
                        }
                        onChange={(opt: SelectOption) =>
                          onChange(opt.value)
                        }
                        label="Default Currency"
                        placeholder="Select currency"
                        error={errors.defaultCurrency?.message}
                      />
                    )}
                  />
                  <div>
                    <Input
                      label="Supported Currencies"
                      placeholder="e.g. NGN,USD,EUR"
                      {...register('supportedCurrencies')}
                      error={errors.supportedCurrencies?.message}
                    />
                    <Text className="mt-1 text-xs text-gray-400">
                      Comma-separated: NGN, USD, EUR, GBP
                    </Text>
                  </div>
                </FieldGrid>
              </Card>

              <Card
                title="Purchase Settings"
                description="Procurement controls for this tenant."
              >
                <FieldGrid>
                  <Controller
                    name="psDefaultBillControlPolicy"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={BILL_CONTROL_OPTIONS}
                        value={
                          BILL_CONTROL_OPTIONS.find((o) => o.value === value) ??
                          null
                        }
                        onChange={(opt: SelectOption) =>
                          onChange(opt.value)
                        }
                        label="Bill Control Policy"
                        placeholder="Select policy"
                        error={errors.psDefaultBillControlPolicy?.message}
                      />
                    )}
                  />
                  <Input
                    label="Approval Threshold (₦)"
                    type="number"
                    placeholder="0"
                    {...register('psApprovalThreshold', {
                      setValueAs: asOptionalNumber,
                    })}
                    error={errors.psApprovalThreshold?.message}
                  />
                  <Input
                    label="Default Payment Terms"
                    placeholder="e.g. Net 30"
                    {...register('psDefaultPaymentTerms')}
                    error={errors.psDefaultPaymentTerms?.message}
                  />
                  <Input
                    label="Default Receiving Location"
                    placeholder="e.g. Main Warehouse"
                    {...register('psDefaultReceivingLocation')}
                    error={errors.psDefaultReceivingLocation?.message}
                  />
                  <Input
                    label="RFQ Validity (days)"
                    type="number"
                    placeholder="30"
                    {...register('psRfqValidityDays', {
                      setValueAs: asOptionalNumber,
                    })}
                    error={errors.psRfqValidityDays?.message}
                  />
                  <Input
                    label="Default Lead Time (days)"
                    type="number"
                    placeholder="7"
                    {...register('psDefaultLeadTimeDays', {
                      setValueAs: asOptionalNumber,
                    })}
                    error={errors.psDefaultLeadTimeDays?.message}
                  />
                </FieldGrid>
                <div className="mt-4 divide-y divide-gray-100">
                  <Controller
                    name="psEnable3WayMatching"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Enable 3-Way Matching"
                        description="Match PO, receipt, and vendor bill before payment"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="psRequirePOApproval"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Require PO Approval"
                        description="All purchase orders must be approved"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="psAutoGenerateBill"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Auto-Generate Vendor Bill"
                        description="Automatically create a bill when goods are received"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="psAllowPartialReceipts"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Allow Partial Receipts"
                        description="Allow receiving partial quantities against a PO line"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="psLockConfirmedOrders"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Lock Confirmed Orders"
                        description="Block edits to a purchase order once it is confirmed"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                </div>
              </Card>

              <Card
                title="Admin Notes"
                description="Internal notes — not shown to the tenant."
              >
                <textarea
                  {...register('notes')}
                  placeholder="Any internal notes about this tenant…"
                  rows={4}
                  maxLength={5000}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Card>
            </div>
  </>);
}
