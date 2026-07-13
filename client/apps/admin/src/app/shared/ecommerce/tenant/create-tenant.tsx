// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { Controller, type SubmitHandler } from 'react-hook-form';
import { Button, Input, Select, Switch, Text, Title, Textarea, type SelectOption } from 'rizzui';
import { Form } from '@core/ui/form';
import { TenantFormInput, tenantFormSchema } from '@/validators/create-tenant.schema';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createAdminTenant, updateAdminTenant } from '@/services/tenant.service';
import { routes } from '@/config/routes';
import toast from 'react-hot-toast';
import { PiTrashBold, PiUploadSimpleBold } from 'react-icons/pi';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_OPTIONS = [
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'custom', label: 'Custom' },
];

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'incomplete_expired', label: 'Incomplete Expired' },
];

const REVENUE_MODEL_OPTIONS = [
  { value: 'markup', label: 'Markup' },
  { value: 'commission', label: 'Commission' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'archived', label: 'Archived' },
];

const CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

const BILL_CONTROL_OPTIONS = [
  { value: 'ordered', label: 'Ordered Quantities' },
  { value: 'received', label: 'Received Quantities' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── ImagePicker ──────────────────────────────────────────────────────────────

function ImagePicker({
  label,
  currentUrl,
  onFile,
  onClear,
}: {
  label?: string;
  currentUrl?: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }

  function handleClear() {
    setPreview(null);
    onClear();
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      {label && <Text className="text-sm font-medium text-gray-700">{label}</Text>}
      {preview ? (
        <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div className="relative aspect-video w-full">
            <img
              src={preview}
              alt={label || 'Tenant logo'}
              className="h-full w-full object-contain p-2"
            />
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:bg-red-50 hover:text-red-500"
          >
            <PiTrashBold className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-7 transition hover:border-primary hover:bg-primary/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <PiUploadSimpleBold className="h-4 w-4 text-gray-400" />
          </div>
          <div className="text-center">
            <Text className="text-xs font-medium text-gray-600">Click to upload</Text>
            <Text className="text-xs text-gray-400">PNG, JPG or WEBP</Text>
          </div>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ─── VisibilityToggle ─────────────────────────────────────────────────────────

function VisibilityToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 flex-1 pr-4">
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
        {description && <Text className="text-xs text-gray-400">{description}</Text>}
      </div>
      <Switch
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

// ─── ColorInput ───────────────────────────────────────────────────────────────

function ColorInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const safe = value || '#1a202c';
  return (
    <div>
      <Text className="mb-1.5 block text-sm font-medium text-gray-700">{label}</Text>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border border-gray-200 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1a202c"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={7}
        />
      </div>
      {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateTenant({
  id,
  tenant,
  currentLogoUrl,
  isModalView = true,
  onSuccess,
}: {
  id?: string;
  isModalView?: boolean;
  tenant?: TenantFormInput;
  currentLogoUrl?: string;
  onSuccess?: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;
  const router = useRouter();

  const [isLoading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const slugManuallyEdited = useRef(false);

  const onSubmit: SubmitHandler<TenantFormInput> = async (data) => {
    setLoading(true);
    try {
      const formData = {
        name: data.name,
        slug: data.slug,
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        primaryColor: data.primaryColor || '#1a202c',
        plan: data.plan || undefined,
        subscriptionStatus: data.subscriptionStatus || undefined,
        stripeCustomerId: data.stripeCustomerId || '',
        stripeSubscriptionId: data.stripeSubscriptionId || '',
        trialEndsAt: data.trialEndsAt || '',
        currentPeriodStart: data.currentPeriodStart || '',
        currentPeriodEnd: data.currentPeriodEnd || '',
        revenueModel: data.revenueModel || undefined,
        markupPercentage: data.markupPercentage !== undefined ? data.markupPercentage : undefined,
        commissionPercentage: data.commissionPercentage !== undefined ? data.commissionPercentage : undefined,
        platformMarkupPercentage: data.platformMarkupPercentage !== undefined ? data.platformMarkupPercentage : undefined,
        // '' clears a pack rate on the server (packs revert to normal rates)
        packMarkupPercentage: data.packMarkupPercentage !== undefined ? data.packMarkupPercentage : undefined,
        packCommissionPercentage: data.packCommissionPercentage !== undefined ? data.packCommissionPercentage : undefined,
        packRateMinUnits: data.packRateMinUnits !== undefined && data.packRateMinUnits !== '' ? data.packRateMinUnits : undefined,
        customPricingNote: data.customPricingNote || '',
        defaultCurrency: data.defaultCurrency || undefined,
        supportedCurrencies: data.supportedCurrencies || '',
        country: data.country || '',
        addressStreet: data.addressStreet || '',
        addressCity: data.addressCity || '',
        addressLga: data.addressLga || '',
        addressState: data.addressState || '',
        addressZipCode: data.addressZipCode || '',
        addressCountry: data.addressCountry || '',
        enforceAgeVerification: data.enforceAgeVerification ?? true,
        isSystemTenant: data.isSystemTenant ?? false,
        status: data.status || undefined,
        rejectionReason: data.rejectionReason || '',
        notes: data.notes || '',
        psBillControlPolicy: data.psBillControlPolicy || undefined,
        psEnable3WayMatching: data.psEnable3WayMatching ?? undefined,
        psRequirePOApproval: data.psRequirePOApproval ?? undefined,
        psApprovalThreshold: data.psApprovalThreshold !== undefined ? data.psApprovalThreshold : undefined,
        psDefaultPaymentTerms: data.psDefaultPaymentTerms || '',
        psAutoGenerateBill: data.psAutoGenerateBill ?? undefined,
        psAllowPartialReceipts: data.psAllowPartialReceipts ?? undefined,
        psDefaultReceivingLocation: data.psDefaultReceivingLocation || '',
        logoFile,
      };

      if (id) {
        await updateAdminTenant(token, id, formData);
        toast.success('Tenant updated');
      } else {
        await createAdminTenant(token, formData);
        toast.success('Tenant created');
        window.dispatchEvent(new Event('tenant-created'));
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(routes.eCommerce.tenants);
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<TenantFormInput>
      validationSchema={tenantFormSchema}
      onSubmit={onSubmit}
      useFormProps={{
        mode: 'onChange',
        defaultValues: {
          status: 'pending',
          plan: 'free_trial',
          subscriptionStatus: 'trialing',
          revenueModel: 'markup',
          markupPercentage: 40,
          commissionPercentage: 12,
          platformMarkupPercentage: 15,
          defaultCurrency: 'NGN',
          enforceAgeVerification: true,
          isSystemTenant: false,
          primaryColor: '#1a202c',
          psEnable3WayMatching: true,
          psRequirePOApproval: true,
          psApprovalThreshold: 0,
          psAutoGenerateBill: false,
          psAllowPartialReceipts: true,
          psBillControlPolicy: 'received',
          ...tenant,
        },
      }}
      className="isomorphic-form flex flex-grow flex-col @container"
    >
      {({ register, control, watch, setValue, formState: { errors } }) => {
        const nameValue = watch('name');
        const statusValue = watch('status');
        const primaryColorValue = watch('primaryColor') || '';

        // Auto-generate slug from name unless manually edited
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (!slugManuallyEdited.current && nameValue && !id) {
            setValue('slug', slugify(nameValue), { shouldValidate: false });
          }
        }, [nameValue]);

        return isModalView ? (
          // ── MODAL layout ──────────────────────────────────────────────────
          <>
            <div className="space-y-5 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Tenant Name *"
                  placeholder="e.g. Acme Liquors"
                  {...register('name')}
                  error={errors.name?.message}
                />
                <Input
                  label="Slug *"
                  placeholder="e.g. acme-liquors"
                  {...register('slug')}
                  error={errors.slug?.message}
                  onFocus={() => { slugManuallyEdited.current = true; }}
                />
                <Controller
                  name="plan"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={PLAN_OPTIONS}
                      value={PLAN_OPTIONS.find((o) => o.value === value) ?? PLAN_OPTIONS[0]}
                      onChange={(opt: SelectOption) => onChange((opt as any).value)}
                      label="Plan"
                      placeholder="Select plan"
                    />
                  )}
                />
                <Controller
                  name="revenueModel"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={REVENUE_MODEL_OPTIONS}
                      value={REVENUE_MODEL_OPTIONS.find((o) => o.value === value) ?? REVENUE_MODEL_OPTIONS[0]}
                      onChange={(opt: SelectOption) => onChange((opt as any).value)}
                      label="Revenue Model"
                      placeholder="Select model"
                    />
                  )}
                />
                <Controller
                  name="status"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={STATUS_OPTIONS}
                      value={STATUS_OPTIONS.find((o) => o.value === value) ?? STATUS_OPTIONS[0]}
                      onChange={(opt: SelectOption) => onChange((opt as any).value)}
                      label="Status"
                      placeholder="Select status"
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
                <div className="col-span-2">
                  <Text className="mb-2 block text-sm font-medium text-gray-700">Logo</Text>
                  <ImagePicker
                    currentUrl={currentLogoUrl}
                    onFile={(f) => setLogoFile(f)}
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
          </>
        ) : (
          // ── FULL PAGE layout ──────────────────────────────────────────────
          <div className="flex gap-6 @5xl:gap-7">
            {/* ── Left column ── */}
            <div className="min-w-0 flex-1 space-y-6">

              {/* Identity */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">Identity</Title>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
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
                  </div>
                  <div>
                    <Input
                      label="Slug *"
                      placeholder="e.g. acme-liquors"
                      {...register('slug')}
                      error={errors.slug?.message}
                      prefix={<span className="text-gray-400 text-sm">/</span>}
                      onFocus={() => { slugManuallyEdited.current = true; }}
                    />
                    <Text className="mt-1.5 text-xs text-gray-400">
                      Auto-generated from name. Subdomain: {watch('slug') || 'slug'}.drinksharbour.com
                    </Text>
                  </div>
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                    <Input
                      label="Contact Phone"
                      placeholder="+234 800 000 0000"
                      {...register('contactPhone')}
                    />
                    <Input
                      label="Country"
                      placeholder="e.g. Nigeria"
                      {...register('country')}
                    />
                  </div>
                  <ColorInput
                    label="Primary Colour"
                    value={primaryColorValue}
                    onChange={(v) => setValue('primaryColor', v)}
                    error={errors.primaryColor?.message}
                  />
                </div>
              </div>

              {/* Plan & Billing */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">Plan & Billing</Title>
                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <Controller
                    name="plan"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={PLAN_OPTIONS}
                        value={PLAN_OPTIONS.find((o) => o.value === value) ?? PLAN_OPTIONS[0]}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Plan"
                        placeholder="Select plan"
                      />
                    )}
                  />
                  <Controller
                    name="subscriptionStatus"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={SUBSCRIPTION_STATUS_OPTIONS}
                        value={SUBSCRIPTION_STATUS_OPTIONS.find((o) => o.value === value) ?? SUBSCRIPTION_STATUS_OPTIONS[0]}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Subscription Status"
                        placeholder="Select status"
                      />
                    )}
                  />
                  <Input
                    label="Stripe Customer ID"
                    placeholder="cus_..."
                    {...register('stripeCustomerId')}
                  />
                  <Input
                    label="Stripe Subscription ID"
                    placeholder="sub_..."
                    {...register('stripeSubscriptionId')}
                  />
                  <Input
                    label="Trial Ends At"
                    type="date"
                    {...register('trialEndsAt')}
                  />
                  <Input
                    label="Current Period Start"
                    type="date"
                    {...register('currentPeriodStart')}
                  />
                  <Input
                    label="Current Period End"
                    type="date"
                    {...register('currentPeriodEnd')}
                  />
                </div>
              </div>

              {/* Revenue Model */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">Revenue Model</Title>
                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <Controller
                    name="revenueModel"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={REVENUE_MODEL_OPTIONS}
                        value={REVENUE_MODEL_OPTIONS.find((o) => o.value === value) ?? REVENUE_MODEL_OPTIONS[0]}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Revenue Model"
                        placeholder="Select model"
                      />
                    )}
                  />
                  <Input
                    label="Markup %"
                    type="number"
                    placeholder="40"
                    {...register('markupPercentage', {
                      setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                    })}
                    error={errors.markupPercentage?.message}
                  />
                  <Input
                    label="Commission %"
                    type="number"
                    placeholder="12"
                    {...register('commissionPercentage', {
                      setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                    })}
                    error={errors.commissionPercentage?.message}
                  />
                  <Input
                    label="Platform Markup %"
                    type="number"
                    placeholder="15"
                    {...register('platformMarkupPercentage', {
                      setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                    })}
                    error={errors.platformMarkupPercentage?.message}
                  />
                  <Input
                    label="Pack Markup %"
                    type="number"
                    placeholder="Leave empty to use normal markup"
                    {...register('packMarkupPercentage', {
                      setValueAs: (v) => (v === '' || v === null ? '' : Number(v)),
                    })}
                    error={errors.packMarkupPercentage?.message}
                  />
                  <Input
                    label="Pack Commission %"
                    type="number"
                    placeholder="Leave empty to use normal commission"
                    {...register('packCommissionPercentage', {
                      setValueAs: (v) => (v === '' || v === null ? '' : Number(v)),
                    })}
                    error={errors.packCommissionPercentage?.message}
                  />
                  <Input
                    label="Pack Rate Min Units"
                    type="number"
                    placeholder="2"
                    {...register('packRateMinUnits', {
                      setValueAs: (v) => (v === '' || v === null ? '' : Number(v)),
                    })}
                    error={errors.packRateMinUnits?.message}
                  />
                  <div className="col-span-2">
                    <Input
                      label="Custom Pricing Note"
                      placeholder="Any custom pricing notes..."
                      {...register('customPricingNote')}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">Address</Title>
                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <div className="col-span-2">
                    <Input
                      label="Street"
                      placeholder="e.g. 12 Adeola Odeku Street"
                      {...register('addressStreet')}
                    />
                  </div>
                  <Input
                    label="City"
                    placeholder="e.g. Victoria Island"
                    {...register('addressCity')}
                  />
                  <Input
                    label="LGA"
                    placeholder="e.g. Eti-Osa"
                    {...register('addressLga')}
                  />
                  <Input
                    label="State"
                    placeholder="e.g. Lagos"
                    {...register('addressState')}
                  />
                  <Input
                    label="Zip Code"
                    placeholder="e.g. 101241"
                    {...register('addressZipCode')}
                  />
                  <Input
                    label="Country"
                    placeholder="e.g. Nigeria"
                    {...register('addressCountry')}
                  />
                </div>
              </div>

              {/* Currency */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">Currency</Title>
                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <Controller
                    name="defaultCurrency"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={CURRENCY_OPTIONS}
                        value={CURRENCY_OPTIONS.find((o) => o.value === value) ?? CURRENCY_OPTIONS[0]}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Default Currency"
                        placeholder="Select currency"
                      />
                    )}
                  />
                  <div>
                    <Input
                      label="Supported Currencies"
                      placeholder="e.g. NGN,USD,EUR"
                      {...register('supportedCurrencies')}
                    />
                    <Text className="mt-1 text-xs text-gray-400">Comma-separated: NGN, USD, EUR, GBP</Text>
                  </div>
                </div>
              </div>

              {/* Purchase Settings */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-1 font-semibold text-gray-800">Purchase Settings</Title>
                <Text className="mb-5 text-sm text-gray-400">Configure procurement controls for this tenant.</Text>
                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <Controller
                    name="psBillControlPolicy"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={BILL_CONTROL_OPTIONS}
                        value={BILL_CONTROL_OPTIONS.find((o) => o.value === value) ?? BILL_CONTROL_OPTIONS[1]}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Bill Control Policy"
                        placeholder="Select policy"
                      />
                    )}
                  />
                  <Input
                    label="Approval Threshold (₦)"
                    type="number"
                    placeholder="0"
                    {...register('psApprovalThreshold', {
                      setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                    })}
                  />
                  <Input
                    label="Default Payment Terms"
                    placeholder="e.g. Net 30"
                    {...register('psDefaultPaymentTerms')}
                  />
                  <Input
                    label="Default Receiving Location"
                    placeholder="e.g. Main Warehouse"
                    {...register('psDefaultReceivingLocation')}
                  />
                </div>
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
                </div>
              </div>

              {/* Admin Notes */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-1 font-semibold text-gray-800">Admin Notes</Title>
                <Text className="mb-4 text-sm text-gray-400">Internal notes — not shown to the tenant.</Text>
                <textarea
                  {...register('notes')}
                  placeholder="Any internal notes about this tenant…"
                  rows={4}
                  maxLength={5000}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* ── Right sidebar ── */}
            <div className="w-72 flex-shrink-0 space-y-6 @5xl:w-80">

              {/* Publish panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-4 font-semibold text-gray-800">Publish</Title>
                <div className="mb-4">
                  <Controller
                    name="status"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={STATUS_OPTIONS}
                        value={STATUS_OPTIONS.find((o) => o.value === value) ?? STATUS_OPTIONS[0]}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Status"
                        placeholder="Select status"
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
                <Title as="h6" className="mb-4 font-semibold text-gray-800">Logo</Title>
                <ImagePicker
                  currentUrl={currentLogoUrl}
                  onFile={(f) => setLogoFile(f)}
                  onClear={() => setLogoFile(null)}
                />
              </div>

              {/* Settings panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-2 font-semibold text-gray-800">Settings</Title>
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

              {/* Rejection reason — only show when status is 'rejected' */}
              {statusValue === 'rejected' && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-5">
                  <Title as="h6" className="mb-2 font-semibold text-red-700">Rejection Reason</Title>
                  <Text className="mb-3 text-xs text-red-500">Visible to the tenant owner.</Text>
                  <textarea
                    {...register('rejectionReason')}
                    placeholder="Explain why this tenant was rejected…"
                    rows={4}
                    maxLength={1000}
                    className="w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                </div>
              )}
            </div>
          </div>
        );
      }}
    </Form>
  );
}
