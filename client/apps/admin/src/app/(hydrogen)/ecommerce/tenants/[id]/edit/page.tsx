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

        // Map nested fields to flat form fields
        const form: TenantFormInput = {
          name: tenant.name || '',
          slug: tenant.slug || '',
          contactEmail: tenant.contactEmail || '',
          contactPhone: tenant.contactPhone || '',
          primaryColor: tenant.primaryColor || '#1a202c',
          plan: tenant.plan || 'free_trial',
          subscriptionStatus: tenant.subscriptionStatus || 'trialing',
          stripeCustomerId: tenant.stripeCustomerId || '',
          stripeSubscriptionId: tenant.stripeSubscriptionId || '',
          trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.split('T')[0] : '',
          currentPeriodStart: tenant.currentPeriodStart ? tenant.currentPeriodStart.split('T')[0] : '',
          currentPeriodEnd: tenant.currentPeriodEnd ? tenant.currentPeriodEnd.split('T')[0] : '',
          revenueModel: tenant.revenueModel || 'markup',
          markupPercentage: tenant.markupPercentage ?? 40,
          commissionPercentage: tenant.commissionPercentage ?? 12,
          platformMarkupPercentage: tenant.platformMarkupPercentage ?? 15,
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
          enforceAgeVerification: tenant.enforceAgeVerification ?? true,
          isSystemTenant: tenant.isSystemTenant ?? false,
          status: tenant.status || 'pending',
          rejectionReason: tenant.rejectionReason || '',
          notes: tenant.notes || '',
          psBillControlPolicy: tenant.purchaseSettings?.billControlPolicy || 'received',
          psEnable3WayMatching: tenant.purchaseSettings?.enable3WayMatching ?? true,
          psRequirePOApproval: tenant.purchaseSettings?.requirePOApproval ?? true,
          psApprovalThreshold: tenant.purchaseSettings?.approvalThreshold ?? 0,
          psDefaultPaymentTerms: tenant.purchaseSettings?.defaultPaymentTerms || '',
          psAutoGenerateBill: tenant.purchaseSettings?.autoGenerateBill ?? false,
          psAllowPartialReceipts: tenant.purchaseSettings?.allowPartialReceipts ?? true,
          psDefaultReceivingLocation: tenant.purchaseSettings?.defaultReceivingLocation || '',
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
        isModalView={false}
      />
    </>
  );
}
