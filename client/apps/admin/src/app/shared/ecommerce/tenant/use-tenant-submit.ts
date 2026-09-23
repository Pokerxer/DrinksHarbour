'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { SubmitHandler } from 'react-hook-form';
import type { TenantFormInput } from '@/validators/create-tenant.schema';
import { createAdminTenant, updateAdminTenant, type TenantFormData } from '@/services/tenant.service';
import { routes } from '@/config/routes';
import toast from 'react-hot-toast';

export function useTenantSubmit(id: string | undefined, logoFile: File | null, onSuccess?: () => void) {
  const { data: session } = useSession();
  const token = session?.user?.token ?? '';
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const onSubmit: SubmitHandler<TenantFormInput> = async (data) => {
    if (!token) { toast.error('Sign in to manage tenants'); return; }
    setLoading(true);
    try {
      const formData: TenantFormData = {
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
        await updateAdminTenant(token, id, formData);
        toast.success('Tenant updated');
      } else {
        // Owner provisioning is create-only — changing an existing tenant's
        // owner is a separate, riskier operation
        if (data.ownerEmail?.trim()) {
          formData.ownerName = data.ownerName || '';
          formData.ownerEmail = data.ownerEmail.trim();
          formData.ownerPhone = data.ownerPhone || '';
        }

        const { ownerInvite } = await createAdminTenant(token, formData);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return { onSubmit, isLoading };
}
