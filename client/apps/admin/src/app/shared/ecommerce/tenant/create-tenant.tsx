'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Select, Text, Title, type SelectOption } from 'rizzui';
import cn from '@core/utils/class-names';
import { TenantFormInput, tenantFormSchema } from '@/validators/create-tenant.schema';
import { useRouter } from 'next/navigation';

import { routes } from '@/config/routes';
import toast from 'react-hot-toast';

import { useTenantSubmit } from './use-tenant-submit';
import { QuickCreateForm } from './form-quick-create';
import { TABS, DEFAULT_VALUES } from './form-config';
import { slugify, VisibilityToggle } from './form-controls';
import { ImagePicker } from './form-image-picker';
import type { TenantFormMeta } from './form-types';
import { IdentityFields } from './form-identity';
import { BillingFields } from './form-billing';
import { RevenueFields } from './form-revenue';
import { LegalFields } from './form-legal';
import { OperationsFields } from './form-operations';

// ─── Constants ────────────────────────────────────────────────────────────────

// Mirrors the Tenant schema enum — growth and venue are real plans the public
// apply form can set, so omitting them here would block editing those tenants.
import { STATUS_OPTIONS } from './form-options';

// Field ownership per tab — drives the error dots and the jump-to-error on submit
// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateTenant({
  id,
  tenant,
  currentLogoUrl,
  meta,
  isModalView = true,
  onSuccess,
}: {
  id?: string;
  isModalView?: boolean;
  tenant?: TenantFormInput;
  currentLogoUrl?: string;
  /** Read-only server data (owner, KYC, geocode) not represented in the form */
  meta?: TenantFormMeta;
  onSuccess?: () => void;
}) {
  const router = useRouter();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const { onSubmit, isLoading } = useTenantSubmit(id, logoFile, onSuccess);
  const [activeTab, setActiveTab] = useState<string>('identity');
  const slugManuallyEdited = useRef(false);

  const methods = useForm<TenantFormInput>({
    mode: 'onChange',
    resolver: zodResolver(tenantFormSchema),
    defaultValues: { ...DEFAULT_VALUES, ...tenant },
  });

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = methods;

  const nameValue = watch('name');
  const statusValue = watch('status');
  const slugValue = watch('slug');
  const primaryColorValue = watch('primaryColor') || '';
  const revenueModelValue = watch('revenueModel');
  const nafdacRequiredValue = watch('nafdacRequired');

  // Auto-generate the slug from the name until the admin types their own.
  // Keyed on typing, not focus — tabbing through the field used to kill this.
  useEffect(() => {
    if (!slugManuallyEdited.current && nameValue && !id) {
      setValue('slug', slugify(nameValue), { shouldValidate: false });
    }
  }, [nameValue, id, setValue]);

  const tabErrorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of TABS) {
      counts[tab.key] = tab.fields.filter(
        (f) => errors[f as keyof typeof errors]
      ).length;
    }
    return counts;
  }, [errors]);

  // A field failing inside a collapsed tab would otherwise fail silently
  const onInvalid = (formErrors: Record<string, unknown>) => {
    const failing = TABS.find((tab) => tab.fields.some((f) => formErrors[f]));
    if (failing) setActiveTab(failing.key);
    toast.error('Check the highlighted fields before saving');
  };

  // ── MODAL layout — the quick-create on the tenants list ─────────────────────
  if (isModalView) {
    return (
      <FormProvider {...methods}>
        <QuickCreateForm onSubmit={handleSubmit(onSubmit, onInvalid)} id={id} currentLogoUrl={currentLogoUrl} setLogoFile={setLogoFile} onSuccess={onSuccess} isLoading={isLoading} slugManuallyEdited={slugManuallyEdited} />
      </FormProvider>
    );
  }

  // ── FULL PAGE layout ────────────────────────────────────────────────────────
  return (
    <FormProvider {...methods}>
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="isomorphic-form flex flex-grow flex-col @container"
      >
        <div className="flex flex-col gap-6 xl:flex-row">
          {/* ── Left column ── */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Tab bar */}
            <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1.5">
              {TABS.map(({ key, label, icon: Icon }) => {
                const errorCount = tabErrorCounts[key] ?? 0;
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {label}
                    {errorCount > 0 && (
                      <span
                        className={cn(
                          'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                          isActive
                            ? 'bg-white text-primary'
                            : 'bg-red-100 text-red-600'
                        )}
                        title={`${errorCount} field${errorCount > 1 ? 's' : ''} need attention`}
                      >
                        {errorCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className={activeTab !== "identity" ? "hidden" : undefined}><IdentityFields id={id} meta={meta} slugManuallyEdited={slugManuallyEdited} /></div>
<div className={activeTab !== "billing" ? "hidden" : undefined}><BillingFields /></div>
<div className={activeTab !== "revenue" ? "hidden" : undefined}><RevenueFields /></div>
<div className={activeTab !== "legal" ? "hidden" : undefined}><LegalFields meta={meta} /></div>
<div className={activeTab !== "operations" ? "hidden" : undefined}><OperationsFields meta={meta} /></div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-full space-y-6 xl:w-72 xl:shrink-0">
            {/* Publish panel */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <Title as="h6" className="mb-4 font-semibold text-gray-800">
                Publish
              </Title>
              <div className="mb-4">
                <Controller
                  name="status"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={STATUS_OPTIONS}
                      value={
                        STATUS_OPTIONS.find((o) => o.value === value) ?? null
                      }
                      onChange={(opt: SelectOption) =>
                        onChange(opt.value)
                      }
                      label="Status"
                      placeholder="Select status"
                      error={errors.status?.message}
                    />
                  )}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button type="submit" isLoading={isLoading} className="w-full">
                  {id ? 'Update Tenant' : 'Save Tenant'}
                </Button>
                <Button
                  type="button"
                  variant="flat"
                  className="w-full"
                  onClick={() => router.push(routes.eCommerce.tenants)}
                >
                  Cancel
                </Button>
              </div>
            </div>

            {/* Logo panel */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <Title as="h6" className="mb-4 font-semibold text-gray-800">
                Logo
              </Title>
              <ImagePicker
                currentUrl={currentLogoUrl}
                onFile={setLogoFile}
                onClear={() => setLogoFile(null)}
              />
            </div>

            {/* Settings panel */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <Title as="h6" className="mb-2 font-semibold text-gray-800">
                Settings
              </Title>
              <div className="divide-y divide-gray-100">
                <Controller
                  name="enforceAgeVerification"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <VisibilityToggle
                      label="Age Verification"
                      description="Require age check on storefront"
                      checked={!!value}
                      onChange={onChange}
                    />
                  )}
                />
                <Controller
                  name="isSystemTenant"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <VisibilityToggle
                      label="System Tenant"
                      description="Protected — cannot be deleted"
                      checked={!!value}
                      onChange={onChange}
                    />
                  )}
                />
              </div>
            </div>

            {/* Rejection reason — required by the server when status is 'rejected' */}
            {statusValue === 'rejected' && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-5">
                <Title as="h6" className="mb-2 font-semibold text-red-700">
                  Rejection Reason *
                </Title>
                <Text className="mb-3 text-xs text-red-500">
                  Visible to the tenant owner.
                </Text>
                <textarea
                  {...register('rejectionReason')}
                  placeholder="Explain why this tenant was rejected…"
                  rows={4}
                  maxLength={1000}
                  className="w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                />
                {errors.rejectionReason?.message && (
                  <Text className="mt-1 text-xs font-medium text-red-600">
                    {errors.rejectionReason.message}
                  </Text>
                )}
              </div>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
