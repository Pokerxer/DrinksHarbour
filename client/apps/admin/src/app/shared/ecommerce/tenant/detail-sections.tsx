import type { ReactNode } from 'react';
import type { AdminTenant } from '@/services/tenant.service';
import { KycSummary } from './form-kyc';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><h2 className="mb-4 font-semibold text-gray-900">{title}</h2><div className="space-y-3">{children}</div></section>;
}
export function Info({ label, value }: { label: string; value?: ReactNode }) {
  return <div className="grid min-w-0 gap-1 border-b border-gray-100 pb-2 last:border-0 sm:grid-cols-[9rem_minmax(0,1fr)]"><dt className="text-xs font-medium text-gray-500">{label}</dt><dd className="min-w-0 break-words text-sm text-gray-800">{value === undefined || value === null || value === '' ? '—' : value}</dd></div>;
}
export function dateLabel(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function TenantDetailSections({ tenant: t }: { tenant: AdminTenant }) {
  const owner = typeof t.admin === 'object' ? t.admin : null;
  const ps = t.purchaseSettings;
  return <div className="grid min-w-0 gap-5 xl:grid-cols-2">
    <Section title="Business and contact">
      <dl>
        <Info label="Contact email" value={t.contactEmail && <a className="text-primary" href={`mailto:${t.contactEmail}`}>{t.contactEmail}</a>} />
        <Info label="Contact phone" value={t.contactPhone} />
        <Info label="Business type" value={t.businessType} />
        <Info label="Address" value={[t.address?.street, t.address?.city, t.address?.lga, t.address?.state, t.address?.zipCode, t.address?.country || t.country].filter(Boolean).join(', ')} />
        <Info label="Currency" value={t.defaultCurrency || 'NGN'} />
        <Info label="Supported currencies" value={t.supportedCurrencies?.join(', ')} />
        <Info label="Created" value={dateLabel(t.createdAt)} />
        <Info label="Approved" value={dateLabel(t.approvedAt)} />
        <Info label="Onboarded" value={dateLabel(t.onboardedAt)} />
      </dl>
    </Section>
    <Section title="Owner account">
      {owner ? <dl>
        <Info label="Name" value={owner.displayName || [owner.firstName, owner.lastName].filter(Boolean).join(' ')} />
        <Info label="Email" value={owner.email} /><Info label="Phone" value={owner.phone} />
        <Info label="Role" value={owner.role?.replace(/_/g, ' ')} /><Info label="Account status" value={owner.status} />
      </dl> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No owner account is assigned. This tenant needs an owner before they can sign in.</p>}
    </Section>
    <Section title="Subscription">
      <dl><Info label="Plan" value={t.plan.replace(/_/g, ' ')} /><Info label="Status" value={t.subscriptionStatus.replace(/_/g, ' ')} />
        <Info label="Trial ends" value={dateLabel(t.trialEndsAt)} /><Info label="Period starts" value={dateLabel(t.currentPeriodStart)} /><Info label="Period ends" value={dateLabel(t.currentPeriodEnd)} />
        <Info label="Paystack customer" value={t.paystackCustomerId} /><Info label="Subscription code" value={t.paystackSubscriptionCode} /><Info label="Plan code" value={t.paystackPlanCode} />
      </dl>
    </Section>
    <Section title="Pricing and revenue">
      <dl><Info label="Revenue model" value={t.revenueModel} />
        <Info label={t.revenueModel === 'markup' ? 'Markup' : 'Commission'} value={`${(t.revenueModel === 'markup' ? t.markupPercentage : t.commissionPercentage) ?? 0}%`} />
        <Info label="Platform markup" value={`${t.platformMarkupPercentage ?? 0}%`} />
        <Info label="Pack markup" value={t.packMarkupPercentage == null ? 'Uses standard rate' : `${t.packMarkupPercentage}%`} />
        <Info label="Pack commission" value={t.packCommissionPercentage == null ? 'Uses standard rate' : `${t.packCommissionPercentage}%`} />
        <Info label="Pack minimum units" value={t.packRateMinUnits} /><Info label="Pricing notes" value={t.customPricingNote} />
      </dl>
    </Section>
    <Section title="Registration and verification">
      <dl><Info label="CAC number" value={t.cacNumber} /><Info label="Tax ID" value={t.tin} /><Info label="ID type" value={t.idType} /><Info label="ID number" value={t.idNumber} /><Info label="NAFDAC number" value={t.nafdacNumber} /><Info label="Application" value={t.applicationDescription} /></dl>
      <KycSummary meta={t} />
    </Section>
    <Section title="Settlement accounts">
      <dl><Info label="Bank" value={t.bankName} /><Info label="Account name" value={t.bankAccountName} /><Info label="Account number" value={t.bankAccountNumber} /></dl>
      {t.bankAccounts?.map((account, index) => <dl key={index} className="rounded-lg bg-gray-50 p-3"><Info label="Bank" value={account.bankName} /><Info label="Account name" value={account.accountName} /><Info label="Account number" value={account.accountNumber} /></dl>)}
    </Section>
    <Section title="Operations and settings">
      <dl><Info label="Age verification" value={t.enforceAgeVerification ? 'Required' : 'Disabled'} /><Info label="System tenant" value={t.isSystemTenant ? 'Protected from deletion' : 'No'} />
        <Info label="Bill control" value={ps?.defaultBillControlPolicy} /><Info label="PO approval" value={ps?.requirePOApproval ? 'Required' : 'Not required'} />
        <Info label="Approval threshold" value={ps?.approvalThreshold} /><Info label="Payment terms" value={ps?.defaultPaymentTerms} />
        <Info label="Three-way matching" value={ps?.enable3WayMatching ? 'Enabled' : 'Disabled'} /><Info label="Partial receipts" value={ps?.allowPartialReceipts ? 'Allowed' : 'Disabled'} />
        <Info label="Auto-generate bills" value={ps?.autoGenerateBill ? 'Enabled' : 'Disabled'} /><Info label="Lock confirmed orders" value={ps?.lockConfirmedOrders ? 'Enabled' : 'Disabled'} />
        <Info label="Receiving location" value={ps?.defaultReceivingLocation} /><Info label="RFQ validity (days)" value={ps?.rfqValidityDays} /><Info label="Lead time (days)" value={ps?.defaultLeadTimeDays} />
      </dl>
    </Section>
    <Section title="Internal notes"><p className="whitespace-pre-wrap break-words text-sm text-gray-600">{t.notes || 'No notes recorded.'}</p>{t.rejectionReason && <Info label="Rejection reason" value={t.rejectionReason} />}</Section>
  </div>;
}
