'use client';

import { Input, Text } from 'rizzui';

import { TenantFormInput } from '@/validators/create-tenant.schema';

import { useFormContext } from 'react-hook-form';
import { Card, FieldGrid, ColorInput } from './form-controls';

import type { TenantFormMeta } from './form-types';
import { TenantAccessCards } from './tenant-access-cards';

export function IdentityFields({ id, meta, slugManuallyEdited }: { id?: string; meta?: TenantFormMeta; slugManuallyEdited: React.MutableRefObject<boolean> }) {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext<TenantFormInput>();
  const slugValue = watch('slug');
  const tenantName = watch('name');
  const primaryColorValue = watch('primaryColor') || '';
  return (<>
{/* ── Identity ── */}
            <div
              className="space-y-6"
            >
              <Card title="Identity">
                <div className="space-y-4">
                  <FieldGrid>
                    <Input
                      label="Tenant Name *"
                      placeholder="e.g. Acme Liquors"
                      {...register('name')}
                      error={errors.name?.message}
                    />
                    <Input
                      label="Contact Email"
                      type="email"
                      placeholder="owner@acme.com"
                      {...register('contactEmail')}
                      error={errors.contactEmail?.message}
                    />
                  </FieldGrid>
                  <div>
                    <Input
                      label="Slug *"
                      placeholder="e.g. acme-liquors"
                      {...register('slug', {
                        onChange: () => {
                          slugManuallyEdited.current = true;
                        },
                      })}
                      error={errors.slug?.message}
                      prefix={<span className="text-sm text-gray-400">/</span>}
                    />
                    <Text className="mt-1.5 text-xs text-gray-400">
                      {id
                        ? 'Changing this breaks existing links.'
                        : 'Auto-generated from the name until you edit it.'}{' '}
                      Subdomain: {slugValue || 'slug'}.drinksharbour.com
                    </Text>
                  </div>
                  <FieldGrid>
                    <Input
                      label="Contact Phone"
                      placeholder="+234 800 000 0000"
                      {...register('contactPhone')}
                      error={errors.contactPhone?.message}
                    />
                    <Input
                      label="Country"
                      placeholder="e.g. Nigeria"
                      {...register('country')}
                      error={errors.country?.message}
                    />
                  </FieldGrid>
                  <ColorInput
                    label="Primary Colour"
                    value={primaryColorValue}
                    onChange={(v) =>
                      setValue('primaryColor', v, { shouldValidate: true })
                    }
                    error={errors.primaryColor?.message}
                  />
                </div>
              </Card>

              {/* Owner account — create provisions one, edit just reports it */}
              {id ? (
                <TenantAccessCards
                  tenantId={id}
                  tenantName={tenantName}
                  meta={meta}
                />
              ) : (
                <Card
                  title="Owner Account"
                  description="Optional. Creates a tenant_owner user and emails them a link to set their password — without one, nobody can sign in to this tenant."
                >
                  <FieldGrid>
                    <Input
                      label="Owner Name"
                      placeholder="e.g. Chidi Okafor"
                      {...register('ownerName')}
                      error={errors.ownerName?.message}
                    />
                    <Input
                      label="Owner Email"
                      type="email"
                      placeholder="owner@acme.com"
                      {...register('ownerEmail')}
                      error={errors.ownerEmail?.message}
                    />
                    <Input
                      label="Owner Phone"
                      placeholder="+234 800 000 0000"
                      {...register('ownerPhone')}
                      error={errors.ownerPhone?.message}
                    />
                  </FieldGrid>
                </Card>
              )}
            </div>

              </>);
}
