'use client';

import { Controller, useFieldArray } from 'react-hook-form';

import { ActionIcon, Button, Input, Select, Text, type SelectOption } from 'rizzui';

import { TenantFormInput } from '@/validators/create-tenant.schema';

import { PiTrashBold, PiPlusBold } from 'react-icons/pi';

import { useFormContext } from 'react-hook-form';
import { Card, FieldGrid, VisibilityToggle } from './form-controls';

import { KycSummary } from './form-kyc';
import { BUSINESS_TYPE_OPTIONS, ID_TYPE_OPTIONS } from './form-options';
import type { TenantFormMeta } from './form-types';

export function LegalFields({ meta }: { meta?: TenantFormMeta }) {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<TenantFormInput>();
  const nafdacRequiredValue = watch('nafdacRequired');
  const { fields: bankAccountFields, append: appendBankAccount, remove: removeBankAccount } = useFieldArray({ control, name: 'bankAccounts' });
  return (<>
{/* ── Legal & KYC ── */}
            <div className="space-y-6">
              <Card title="Business Registration">
                <FieldGrid>
                  <Controller
                    name="businessType"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={BUSINESS_TYPE_OPTIONS}
                        value={
                          BUSINESS_TYPE_OPTIONS.find(
                            (o) => o.value === value
                          ) ?? null
                        }
                        onChange={(opt: SelectOption) =>
                          onChange(opt.value)
                        }
                        label="Business Type"
                        placeholder="Select type"
                        clearable
                        onClear={() => onChange('')}
                        error={errors.businessType?.message}
                      />
                    )}
                  />
                  <Input
                    label="CAC Number"
                    placeholder="RC1234567"
                    {...register('cacNumber')}
                    error={errors.cacNumber?.message}
                  />
                  <Input
                    label="Tax ID (TIN)"
                    placeholder="1234567890"
                    {...register('tin')}
                    error={errors.tin?.message}
                  />
                  <Controller
                    name="idType"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={ID_TYPE_OPTIONS}
                        value={
                          ID_TYPE_OPTIONS.find((o) => o.value === value) ?? null
                        }
                        onChange={(opt: SelectOption) =>
                          onChange(opt.value)
                        }
                        label="ID Type"
                        placeholder="Select ID type"
                        clearable
                        onClear={() => onChange('')}
                        error={errors.idType?.message}
                      />
                    )}
                  />
                  <Input
                    label="ID Number"
                    placeholder="e.g. 12345678901"
                    {...register('idNumber')}
                    error={errors.idNumber?.message}
                  />
                </FieldGrid>
                <div className="mt-4 divide-y divide-gray-100">
                  <Controller
                    name="nafdacRequired"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Sells NAFDAC-regulated beverages"
                        description="Requires a NAFDAC registration number"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                </div>
                {nafdacRequiredValue && (
                  <div className="mt-4">
                    <Input
                      label="NAFDAC Number *"
                      placeholder="e.g. A1-2345"
                      {...register('nafdacNumber')}
                      error={errors.nafdacNumber?.message}
                    />
                  </div>
                )}
              </Card>

              <Card
                title="Settlement Account"
                description="Where this tenant's payouts are sent."
              >
                <FieldGrid>
                  <Input
                    label="Bank Name"
                    placeholder="e.g. GTBank"
                    {...register('bankName')}
                    error={errors.bankName?.message}
                  />
                  <Input
                    label="Account Number"
                    placeholder="0123456789"
                    {...register('bankAccountNumber')}
                    error={errors.bankAccountNumber?.message}
                  />
                  <Input
                    label="Account Name"
                    placeholder="e.g. Acme Liquors Ltd"
                    {...register('bankAccountName')}
                    error={errors.bankAccountName?.message}
                  />
                </FieldGrid>
              </Card>

              <Card
                title="Invoice Bank Accounts"
                description="Shown to customers on POS invoices. Separate from the settlement account above."
              >
                <div className="space-y-3">
                  {bankAccountFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-end gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
                    >
                      <div className="grid flex-1 grid-cols-1 gap-3 @xl:grid-cols-3">
                        <Input
                          label="Bank"
                          placeholder="e.g. GTBank"
                          {...register(`bankAccounts.${index}.bankName`)}
                        />
                        <Input
                          label="Account Number"
                          placeholder="0123456789"
                          {...register(`bankAccounts.${index}.accountNumber`)}
                        />
                        <Input
                          label="Account Name"
                          placeholder="e.g. Acme Liquors Ltd"
                          {...register(`bankAccounts.${index}.accountName`)}
                        />
                      </div>
                      <ActionIcon
                        variant="flat"
                        size="sm"
                        title="Remove this account"
                        onClick={() => removeBankAccount(index)}
                        className="mb-0.5 text-gray-400 hover:text-red-500"
                      >
                        <PiTrashBold className="h-4 w-4" />
                      </ActionIcon>
                    </div>
                  ))}
                  {bankAccountFields.length === 0 && (
                    <Text className="text-sm text-gray-400">
                      No invoice bank accounts added.
                    </Text>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendBankAccount({
                        bankName: '',
                        accountNumber: '',
                        accountName: '',
                      })
                    }
                  >
                    <PiPlusBold className="me-1.5 h-4 w-4" /> Add Account
                  </Button>
                </div>
              </Card>

              <Card
                title="KYC Verification"
                description="Read-only. Produced by the Paystack KYC checks when a vendor applies."
              >
                <KycSummary meta={meta} />
              </Card>

              <Card title="Application Description">
                <textarea
                  {...register('applicationDescription')}
                  placeholder="What this business sells, as described on their application…"
                  rows={4}
                  maxLength={2000}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Card>
            </div>

              </>);
}
