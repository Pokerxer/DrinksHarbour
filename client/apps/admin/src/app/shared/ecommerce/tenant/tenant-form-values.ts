import type { AdminTenant } from '@/services/tenant.service';
import type { TenantFormInput } from '@/validators/create-tenant.schema';

export function tenantFormValues(tenant: AdminTenant): TenantFormInput {
        const ps = tenant.purchaseSettings;

        // Map nested fields to flat form fields
        return {
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
          trialEndsAt: tenant.trialEndsAt
            ? tenant.trialEndsAt.split('T')[0]
            : '',
          currentPeriodStart: tenant.currentPeriodStart
            ? tenant.currentPeriodStart.split('T')[0]
            : '',
          currentPeriodEnd: tenant.currentPeriodEnd
            ? tenant.currentPeriodEnd.split('T')[0]
            : '',
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
            : tenant.supportedCurrencies || '',
          country: tenant.country || '',
          addressStreet: tenant.address?.street || '',
          addressCity: tenant.address?.city || '',
          addressLga: tenant.address?.lga || '',
          addressState: tenant.address?.state || '',
          addressZipCode: tenant.address?.zipCode || '',
          addressCountry: tenant.address?.country || '',
          businessType: tenant.businessType || undefined,
          cacNumber: tenant.cacNumber || '',
          tin: tenant.tin || '',
          idType: tenant.idType || undefined,
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
          psDefaultBillControlPolicy:
            ps?.defaultBillControlPolicy || 'received',
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

}
