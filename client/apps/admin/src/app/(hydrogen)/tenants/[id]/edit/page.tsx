// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import CreateTenant from '@/app/shared/ecommerce/tenant/create-tenant';
import PageHeader from '@/app/shared/page-header';
import { routes } from '@/config/routes';
import { getAdminTenantById } from '@/services/tenant.service';
import { Loader, Text } from 'rizzui';
import { TenantFormInput } from '@/validators/create-tenant.schema';

export default function EditTenantPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;

  const [tenantForm, setTenantForm] = useState<TenantFormInput | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | undefined>(undefined);
  const [meta, setMeta] = useState<Record<string, any>>({});
  const [tenantName, setTenantName] = useState<string>('Tenant');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    getAdminTenantById(token, id)
      .then(({ tenant }) => {
        setTenantName(tenant.name || 'Tenant');
        setCurrentLogoUrl(tenant.logo?.url);

        // Server data the form doesn't own, but the page shows read-only
        setMeta({
          owner: typeof tenant.admin === 'object' ? tenant.admin : null,
          kycVerified: tenant.kycVerified,
          kycChecks: tenant.kycChecks,
          kycWarnings: tenant.kycWarnings,
          kycNameCrossCheck: tenant.kycNameCrossCheck,
          location: tenant.location,
          normalizedState: tenant.normalizedState,
        });

        const ps = tenant.purchaseSettings;

        // Map nested fields to flat form fields
        const form: TenantFormInput = {
          name: tenant.name || '',
          slug: tenant.slug || '',
          contactEmail: tenant.contactEmail || '',
          contactPhone: tenant.contactPhone || '',
          primaryColor: tenant.primaryColor || '#1a202c',
          plan: tenant.plan || 'free_trial',
          subscriptionStatus: tenant.subscriptionStatus || 'trialing',
          paystackCustomerId: tenant.paystackCustomerId || '',
          paystackSubscriptionCode: tenant.paystackSubscriptionCode || '',
          paystackPlanCode: tenant.paystackPlanCode || '',
          trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.split('T')[0] : '',
          currentPeriodStart: tenant.currentPeriodStart ? tenant.currentPeriodStart.split('T')[0] : '',
          currentPeriodEnd: tenant.currentPeriodEnd ? tenant.currentPeriodEnd.split('T')[0] : '',
          revenueModel: tenant.revenueModel || 'markup',
          markupPercentage: tenant.markupPercentage ?? 40,
          commissionPercentage: tenant.commissionPercentage ?? 12,
          platformMarkupPercentage: tenant.platformMarkupPercentage ?? 15,
          packMarkupPercentage: tenant.packMarkupPercentage ?? '',
          packCommissionPercentage: tenant.packCommissionPercentage ?? '',
          packRateMinUnits: tenant.packRateMinUnits ?? '',
          customPricingNote: tenant.customPricingNote || '',
          defaultCurrency: tenant.defaultCurrency || 'NGN',
          supportedCurrencies: Array.isArray(tenant.supportedCurrencies)
            ? tenant.supportedCurrencies.join(', ')
            : (tenant.supportedCurrencies || ''),
          country: tenant.country || '',
          addressStreet: tenant.address?.street || '',
          addressCity: tenant.address?.city || '',
          addressLga: tenant.address?.lga || '',
          addressState: tenant.address?.state || '',
          addressZipCode: tenant.address?.zipCode || '',
          addressCountry: tenant.address?.country || '',
          businessType: tenant.businessType || '',
          cacNumber: tenant.cacNumber || '',
          tin: tenant.tin || '',
          idType: tenant.idType || '',
          idNumber: tenant.idNumber || '',
          nafdacRequired: tenant.nafdacRequired ?? false,
          nafdacNumber: tenant.nafdacNumber || '',
          applicationDescription: tenant.applicationDescription || '',
          bankName: tenant.bankName || '',
          bankAccountNumber: tenant.bankAccountNumber || '',
          bankAccountName: tenant.bankAccountName || '',
          bankAccounts: (tenant.bankAccounts || []).map((a) => ({
            bankName: a.bankName || '',
            accountNumber: a.accountNumber || '',
            accountName: a.accountName || '',
          })),
          enforceAgeVerification: tenant.enforceAgeVerification ?? true,
          isSystemTenant: tenant.isSystemTenant ?? false,
          status: tenant.status || 'pending',
          rejectionReason: tenant.rejectionReason || '',
          notes: tenant.notes || '',
          // Note the `default` prefix — reading `billControlPolicy` here always
          // returned undefined, so the form silently reset the real policy
          psDefaultBillControlPolicy: ps?.defaultBillControlPolicy || 'received',
          psEnable3WayMatching: ps?.enable3WayMatching ?? true,
          psRequirePOApproval: ps?.requirePOApproval ?? true,
          psApprovalThreshold: ps?.approvalThreshold ?? 0,
          psDefaultPaymentTerms: ps?.defaultPaymentTerms || '',
          psAutoGenerateBill: ps?.autoGenerateBill ?? false,
          psAllowPartialReceipts: ps?.allowPartialReceipts ?? true,
          psDefaultReceivingLocation: ps?.defaultReceivingLocation || '',
          psLockConfirmedOrders: ps?.lockConfirmedOrders ?? false,
          psRfqValidityDays: ps?.rfqValidityDays ?? 30,
          psDefaultLeadTimeDays: ps?.defaultLeadTimeDays ?? 7,
        };

        setTenantForm(form);
      })
      .catch((err) => setError(err.message || 'Failed to load tenant'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const breadcrumb = [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.tenants, name: 'Tenants' },
    { name: tenantName },
  ];

  if (loading) {
    return (
      <>
        <PageHeader title="Edit Tenant" breadcrumb={breadcrumb} />
        <div className="flex h-52 flex-col items-center justify-center gap-3">
          <Loader variant="spinner" className="text-primary" />
          <Text className="text-sm text-gray-500">Loading tenant...</Text>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Edit Tenant" breadcrumb={breadcrumb} />
        <div className="flex h-52 flex-col items-center justify-center gap-3">
          <Text className="text-sm text-red-500">{error}</Text>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Edit: ${tenantName}`} breadcrumb={breadcrumb} />
      <CreateTenant
        id={id}
        tenant={tenantForm}
        currentLogoUrl={currentLogoUrl}
        meta={meta}
        isModalView={false}
      />
    </>
  );
}
