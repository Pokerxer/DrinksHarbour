'use client';

import { Controller } from 'react-hook-form';

import { Button, Input, Text } from 'rizzui';

import { TenantFormInput } from '@/validators/create-tenant.schema';

import { ImagePicker } from './form-image-picker';

import { useFormContext } from 'react-hook-form';
import { PLAN_OPTIONS, REVENUE_MODEL_OPTIONS, STATUS_OPTIONS } from './form-options';
import { TenantModalSelect } from './modal-select';

export function QuickCreateForm({ onSubmit, id, currentLogoUrl, setLogoFile, onSuccess, isLoading, slugManuallyEdited }: { onSubmit: React.FormEventHandler<HTMLFormElement>; id?: string; currentLogoUrl?: string; setLogoFile: (file: File | null) => void; onSuccess?: () => void; isLoading: boolean; slugManuallyEdited: React.MutableRefObject<boolean> }) {
 const { register, control, formState: { errors } } = useFormContext<TenantFormInput>();
 return (
<>
        <form
          noValidate
          onSubmit={onSubmit}
          className="isomorphic-form flex flex-grow flex-col @container"
        >
          <div className="space-y-5 pb-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Tenant Name *"
                placeholder="e.g. Acme Liquors"
                {...register('name')}
                error={errors.name?.message}
              />
              <Input
                label="Slug *"
                placeholder="e.g. acme-liquors"
                {...register('slug', {
                  onChange: () => {
                    slugManuallyEdited.current = true;
                  },
                })}
                error={errors.slug?.message}
              />
              <Controller
                name="plan"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TenantModalSelect
                    options={PLAN_OPTIONS}
                    value={value}
                    onChange={onChange}
                    label="Plan"
                    placeholder="Select plan"
                    error={errors.plan?.message}
                  />
                )}
              />
              <Controller
                name="revenueModel"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TenantModalSelect
                    options={REVENUE_MODEL_OPTIONS}
                    value={value}
                    onChange={onChange}
                    label="Revenue Model"
                    placeholder="Select model"
                    error={errors.revenueModel?.message}
                  />
                )}
              />
              <Controller
                name="status"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TenantModalSelect
                    options={STATUS_OPTIONS}
                    value={value}
                    onChange={onChange}
                    label="Status"
                    placeholder="Select status"
                    error={errors.status?.message}
                  />
                )}
              />
              <Input
                label="Contact Email"
                type="email"
                placeholder="owner@acme.com"
                {...register('contactEmail')}
                error={errors.contactEmail?.message}
              />
              <Input
                label="Owner Name"
                placeholder="e.g. Chidi Okafor"
                {...register('ownerName')}
                error={errors.ownerName?.message}
              />
              <Input
                label="Owner Email"
                type="email"
                placeholder="Sends a set-password invite"
                {...register('ownerEmail')}
                error={errors.ownerEmail?.message}
              />
              <div className="sm:col-span-2">
                <Text className="mb-2 block text-sm font-medium text-gray-700">
                  Logo
                </Text>
                <ImagePicker
                  currentUrl={currentLogoUrl}
                  onFile={setLogoFile}
                  onClear={() => setLogoFile(null)}
                />
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-40 -mx-5 flex items-center justify-end gap-3 border-t border-gray-100 bg-white/90 px-5 py-4 backdrop-blur">
            <Button variant="outline" type="button" onClick={onSuccess}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {id ? 'Update' : 'Create'} Tenant
            </Button>
          </div>
        </form>
</>
 );
}
