// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ActionIcon,
  Badge,
  Button,
  Input,
  Select,
  Switch,
  Text,
  Title,
  type SelectOption,
} from 'rizzui';
import cn from '@core/utils/class-names';
import {
  TenantFormInput,
  tenantFormSchema,
  businessTypeValues,
  idTypeValues,
} from '@/validators/create-tenant.schema';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  createAdminTenant,
  updateAdminTenant,
} from '@/services/tenant.service';
import { routes } from '@/config/routes';
import toast from 'react-hot-toast';
import {
  PiTrashBold,
  PiUploadSimpleBold,
  PiPlusBold,
  PiWarningCircleBold,
  PiIdentificationCardBold,
  PiCreditCardBold,
  PiPercentBold,
  PiScalesBold,
  PiSlidersHorizontalBold,
  PiCheckCircleBold,
  PiSealCheckBold,
  PiSealWarningBold,
} from 'react-icons/pi';

// ─── Constants ────────────────────────────────────────────────────────────────

// Mirrors the Tenant schema enum — growth and venue are real plans the public
// apply form can set, so omitting them here would block editing those tenants.
const PLAN_OPTIONS = [
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'venue', label: 'Venue' },
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

const BUSINESS_TYPE_OPTIONS = businessTypeValues.map((v) => ({
  value: v,
  label: v,
}));
const ID_TYPE_OPTIONS = idTypeValues.map((v) => ({ value: v, label: v }));

// Field ownership per tab — drives the error dots and the jump-to-error on submit
const TABS = [
  {
    key: 'identity',
    label: 'Identity',
    icon: PiIdentificationCardBold,
    fields: [
      'name',
      'slug',
      'contactEmail',
      'contactPhone',
      'country',
      'primaryColor',
      'ownerName',
      'ownerEmail',
      'ownerPhone',
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: PiCreditCardBold,
    fields: [
      'plan',
      'subscriptionStatus',
      'paystackCustomerId',
      'paystackSubscriptionCode',
      'paystackPlanCode',
      'trialEndsAt',
      'currentPeriodStart',
      'currentPeriodEnd',
    ],
  },
  {
    key: 'revenue',
    label: 'Revenue',
    icon: PiPercentBold,
    fields: [
      'revenueModel',
      'markupPercentage',
      'commissionPercentage',
      'platformMarkupPercentage',
      'packMarkupPercentage',
      'packCommissionPercentage',
      'packRateMinUnits',
      'customPricingNote',
    ],
  },
  {
    key: 'legal',
    label: 'Legal & KYC',
    icon: PiScalesBold,
    fields: [
      'businessType',
      'cacNumber',
      'tin',
      'idType',
      'idNumber',
      'nafdacRequired',
      'nafdacNumber',
      'bankName',
      'bankAccountNumber',
      'bankAccountName',
      'bankAccounts',
      'applicationDescription',
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    icon: PiSlidersHorizontalBold,
    fields: [
      'addressStreet',
      'addressCity',
      'addressLga',
      'addressState',
      'addressZipCode',
      'addressCountry',
      'defaultCurrency',
      'supportedCurrencies',
      'psDefaultBillControlPolicy',
      'psApprovalThreshold',
      'psDefaultPaymentTerms',
      'psDefaultReceivingLocation',
      'psRfqValidityDays',
      'psDefaultLeadTimeDays',
      'psEnable3WayMatching',
      'psRequirePOApproval',
      'psAutoGenerateBill',
      'psAllowPartialReceipts',
      'psLockConfirmedOrders',
      'notes',
    ],
  },
] as const;

const DEFAULT_VALUES: Partial<TenantFormInput> = {
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
  psLockConfirmedOrders: false,
  psDefaultBillControlPolicy: 'received',
  nafdacRequired: false,
  bankAccounts: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** '' clears an optional number; anything else becomes a Number for zod. */
const asOptionalNumber = (v: any) =>
  v === '' || v === null ? undefined : Number(v);
/** Same, but '' is a meaningful value the server reads as "clear this rate". */
const asClearableNumber = (v: any) => (v === '' || v === null ? '' : Number(v));

// ─── Layout primitives ────────────────────────────────────────────────────────

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <Title
        as="h5"
        className={cn(
          'font-semibold text-gray-800',
          description ? 'mb-1' : 'mb-5'
        )}
      >
        {title}
      </Title>
      {description && (
        <Text className="mb-5 text-sm text-gray-400">{description}</Text>
      )}
      {children}
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">{children}</div>
  );
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
      {label && (
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
      )}
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
            <Text className="text-xs font-medium text-gray-600">
              Click to upload
            </Text>
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
        {description && (
          <Text className="text-xs text-gray-400">{description}</Text>
        )}
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
      <Text className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </Text>
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
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={7}
        />
      </div>
      {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
    </div>
  );
}

// ─── KYC summary (read-only) ──────────────────────────────────────────────────

function KycSummary({ meta }: { meta: any }) {
  const checks = meta?.kycChecks ?? [];
  const warnings = meta?.kycWarnings ?? [];

  if (!checks.length && !warnings.length && meta?.kycVerified === undefined) {
    return (
      <Text className="text-sm text-gray-400">
        No KYC run for this tenant. Checks are performed automatically for
        vendors who sign up through the public application form.
      </Text>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {meta.kycVerified ? (
          <>
            <PiSealCheckBold className="h-5 w-5 text-green-600" />
            <Text className="text-sm font-medium text-green-700">
              KYC verified
            </Text>
          </>
        ) : (
          <>
            <PiSealWarningBold className="h-5 w-5 text-amber-500" />
            <Text className="text-sm font-medium text-amber-700">
              KYC not verified
            </Text>
          </>
        )}
      </div>

      {checks.length > 0 && (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {checks.map((c: any, i: number) => (
            <div
              key={`${c.check}-${i}`}
              className="flex items-start gap-3 px-3 py-2"
            >
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                  c.skipped
                    ? 'bg-gray-300'
                    : c.passed
                      ? 'bg-green-400'
                      : 'bg-red-400'
                )}
              />
              <div className="min-w-0">
                <Text className="text-sm capitalize text-gray-700">
                  {String(c.check || '').replace(/_/g, ' ')}
                </Text>
                {c.detail && (
                  <Text className="text-xs text-gray-400">{c.detail}</Text>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          {warnings.map((w: string, i: number) => (
            <Text key={i} className="text-xs text-amber-800">
              • {w}
            </Text>
          ))}
        </div>
      )}
    </div>
  );
}

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
  meta?: any;
  onSuccess?: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;
  const router = useRouter();

  const [isLoading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
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

  const {
    fields: bankAccountFields,
    append: appendBankAccount,
    remove: removeBankAccount,
  } = useFieldArray({ control, name: 'bankAccounts' });

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

  const onSubmit: SubmitHandler<TenantFormInput> = async (data) => {
    setLoading(true);
    try {
      const formData: Record<string, any> = {
        name: data.name,
        slug: data.slug,
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        primaryColor: data.primaryColor || '#1a202c',
        plan: data.plan || undefined,
        subscriptionStatus: data.subscriptionStatus || undefined,
        paystackCustomerId: data.paystackCustomerId || '',
        paystackSubscriptionCode: data.paystackSubscriptionCode || '',
        paystackPlanCode: data.paystackPlanCode || '',
        trialEndsAt: data.trialEndsAt || '',
        currentPeriodStart: data.currentPeriodStart || '',
        currentPeriodEnd: data.currentPeriodEnd || '',
        revenueModel: data.revenueModel || undefined,
        markupPercentage: data.markupPercentage,
        commissionPercentage: data.commissionPercentage,
        platformMarkupPercentage: data.platformMarkupPercentage,
        // '' clears a pack rate on the server (packs revert to normal rates)
        packMarkupPercentage: data.packMarkupPercentage,
        packCommissionPercentage: data.packCommissionPercentage,
        packRateMinUnits:
          data.packRateMinUnits === '' ? undefined : data.packRateMinUnits,
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
        businessType: data.businessType || '',
        cacNumber: data.cacNumber || '',
        tin: data.tin || '',
        idType: data.idType || '',
        idNumber: data.idNumber || '',
        nafdacRequired: data.nafdacRequired ?? false,
        nafdacNumber: data.nafdacNumber || '',
        applicationDescription: data.applicationDescription || '',
        bankName: data.bankName || '',
        bankAccountNumber: data.bankAccountNumber || '',
        bankAccountName: data.bankAccountName || '',
        bankAccounts: data.bankAccounts ?? [],
        enforceAgeVerification: data.enforceAgeVerification ?? true,
        isSystemTenant: data.isSystemTenant ?? false,
        status: data.status || undefined,
        rejectionReason: data.rejectionReason || '',
        notes: data.notes || '',
        psDefaultBillControlPolicy:
          data.psDefaultBillControlPolicy || undefined,
        psEnable3WayMatching: data.psEnable3WayMatching,
        psRequirePOApproval: data.psRequirePOApproval,
        psApprovalThreshold: data.psApprovalThreshold,
        psDefaultPaymentTerms: data.psDefaultPaymentTerms || '',
        psAutoGenerateBill: data.psAutoGenerateBill,
        psAllowPartialReceipts: data.psAllowPartialReceipts,
        psDefaultReceivingLocation: data.psDefaultReceivingLocation || '',
        psLockConfirmedOrders: data.psLockConfirmedOrders,
        psRfqValidityDays: data.psRfqValidityDays,
        psDefaultLeadTimeDays: data.psDefaultLeadTimeDays,
        logoFile,
      };

      if (id) {
        await updateAdminTenant(token, id, formData as any);
        toast.success('Tenant updated');
      } else {
        // Owner provisioning is create-only — changing an existing tenant's
        // owner is a separate, riskier operation
        if (data.ownerEmail?.trim()) {
          formData.ownerName = data.ownerName || '';
          formData.ownerEmail = data.ownerEmail.trim();
          formData.ownerPhone = data.ownerPhone || '';
        }

        const { ownerInvite } = await createAdminTenant(token, formData as any);
        toast.success('Tenant created');
        if (ownerInvite && !ownerInvite.emailSent) {
          toast.error(
            `Owner account created, but the invite email to ${ownerInvite.email} could not be sent. Send them a password reset link.`,
            { duration: 8000 }
          );
        }
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

  // A field failing inside a collapsed tab would otherwise fail silently
  const onInvalid = (formErrors: Record<string, any>) => {
    const failing = TABS.find((tab) => tab.fields.some((f) => formErrors[f]));
    if (failing) setActiveTab(failing.key);
    toast.error('Check the highlighted fields before saving');
  };

  // ── MODAL layout — the quick-create on the tenants list ─────────────────────
  if (isModalView) {
    return (
      <FormProvider {...methods}>
        <form
          noValidate
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="isomorphic-form flex flex-grow flex-col @container"
        >
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
                  <Select
                    options={PLAN_OPTIONS}
                    value={PLAN_OPTIONS.find((o) => o.value === value) ?? null}
                    onChange={(opt: SelectOption) =>
                      onChange((opt as any).value)
                    }
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
                  <Select
                    options={REVENUE_MODEL_OPTIONS}
                    value={
                      REVENUE_MODEL_OPTIONS.find((o) => o.value === value) ??
                      null
                    }
                    onChange={(opt: SelectOption) =>
                      onChange((opt as any).value)
                    }
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
                  <Select
                    options={STATUS_OPTIONS}
                    value={
                      STATUS_OPTIONS.find((o) => o.value === value) ?? null
                    }
                    onChange={(opt: SelectOption) =>
                      onChange((opt as any).value)
                    }
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
              <div className="col-span-2">
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
        <div className="flex gap-6 @5xl:gap-7">
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

            {/* ── Identity ── */}
            <div
              className={cn('space-y-6', activeTab !== 'identity' && 'hidden')}
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
                <Card title="Owner Account">
                  {meta?.owner ? (
                    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <PiCheckCircleBold className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <div className="min-w-0">
                        <Text className="text-sm font-medium text-gray-800">
                          {meta.owner.displayName ||
                            [meta.owner.firstName, meta.owner.lastName]
                              .filter(Boolean)
                              .join(' ') ||
                            meta.owner.email}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {meta.owner.email}
                        </Text>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {meta.owner.role && (
                            <Badge
                              variant="flat"
                              color="secondary"
                              className="text-xs capitalize"
                            >
                              {String(meta.owner.role).replace(/_/g, ' ')}
                            </Badge>
                          )}
                          {meta.owner.status && (
                            <Badge
                              variant="flat"
                              color={
                                meta.owner.status === 'active'
                                  ? 'success'
                                  : 'warning'
                              }
                              className="text-xs capitalize"
                            >
                              {meta.owner.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                      <PiWarningCircleBold className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                      <div>
                        <Text className="text-sm font-medium text-amber-900">
                          No owner account
                        </Text>
                        <Text className="text-xs text-amber-700">
                          Nobody can sign in to this tenant. Create a user with
                          the tenant_owner role from the Users page and assign
                          them to this tenant.
                        </Text>
                      </div>
                    </div>
                  )}
                </Card>
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

            {/* ── Billing ── */}
            <div
              className={cn('space-y-6', activeTab !== 'billing' && 'hidden')}
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
                          onChange((opt as any).value)
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
                          onChange((opt as any).value)
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

            {/* ── Revenue ── */}
            <div
              className={cn('space-y-6', activeTab !== 'revenue' && 'hidden')}
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
                          onChange((opt as any).value)
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

            {/* ── Legal & KYC ── */}
            <div className={cn('space-y-6', activeTab !== 'legal' && 'hidden')}>
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
                          onChange((opt as any).value)
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
                          onChange((opt as any).value)
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

            {/* ── Operations ── */}
            <div
              className={cn(
                'space-y-6',
                activeTab !== 'operations' && 'hidden'
              )}
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
                          onChange((opt as any).value)
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
                          onChange((opt as any).value)
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
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-72 flex-shrink-0 space-y-6 @5xl:w-80">
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
                        onChange((opt as any).value)
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
