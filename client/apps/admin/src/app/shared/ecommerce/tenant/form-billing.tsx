'use client';

import { Controller } from 'react-hook-form';

import { Input, Select, type SelectOption } from 'rizzui';

import { TenantFormInput } from '@/validators/create-tenant.schema';

import { useFormContext } from 'react-hook-form';
import { Card, FieldGrid } from './form-controls';

import { PLAN_OPTIONS, SUBSCRIPTION_STATUS_OPTIONS } from './form-options';

export function BillingFields() {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<TenantFormInput>();
  return (<>
{/* ── Billing ── */}
            <div
              className="space-y-6"
            >
              <Card title="Plan & Subscription">
                <FieldGrid>
                  <Controller
                    name="plan"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={PLAN_OPTIONS}
                        value={
                          PLAN_OPTIONS.find((o) => o.value === value) ?? null
                        }
                        onChange={(opt: SelectOption) =>
                          onChange(opt.value)
                        }
                        label="Plan"
                        placeholder="Select plan"
                        error={errors.plan?.message}
                      />
                    )}
                  />
                  <Controller
                    name="subscriptionStatus"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={SUBSCRIPTION_STATUS_OPTIONS}
                        value={
                          SUBSCRIPTION_STATUS_OPTIONS.find(
                            (o) => o.value === value
                          ) ?? null
                        }
                        onChange={(opt: SelectOption) =>
                          onChange(opt.value)
                        }
                        label="Subscription Status"
                        placeholder="Select status"
                        error={errors.subscriptionStatus?.message}
                      />
                    )}
                  />
                  <Input
                    label="Trial Ends At"
                    type="date"
                    {...register('trialEndsAt')}
                    error={errors.trialEndsAt?.message}
                  />
                  <Input
                    label="Current Period Start"
                    type="date"
                    {...register('currentPeriodStart')}
                    error={errors.currentPeriodStart?.message}
                  />
                  <Input
                    label="Current Period End"
                    type="date"
                    {...register('currentPeriodEnd')}
                    error={errors.currentPeriodEnd?.message}
                  />
                </FieldGrid>
              </Card>

              <Card
                title="Paystack"
                description="Billing identifiers from the Paystack dashboard. Leave blank unless this tenant has a live subscription."
              >
                <FieldGrid>
                  <Input
                    label="Customer ID"
                    placeholder="CUS_..."
                    {...register('paystackCustomerId')}
                    error={errors.paystackCustomerId?.message}
                  />
                  <Input
                    label="Subscription Code"
                    placeholder="SUB_..."
                    {...register('paystackSubscriptionCode')}
                    error={errors.paystackSubscriptionCode?.message}
                  />
                  <Input
                    label="Plan Code"
                    placeholder="PLN_..."
                    {...register('paystackPlanCode')}
                    error={errors.paystackPlanCode?.message}
                  />
                </FieldGrid>
              </Card>
            </div>

              </>);
}
