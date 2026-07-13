// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { routes } from '@/config/routes';
import {
  getAdminTenantById,
  updateAdminTenant,
} from '@/services/tenant.service';
import PageHeader from '@/app/shared/page-header';
import { Badge, Button, Loader, Text, Title } from 'rizzui';
import toast from 'react-hot-toast';
import {
  PiPencilLineBold,
  PiBuildingsBold,
  PiPackageBold,
  PiShoppingCartBold,
  PiCurrencyNgnBold,
  PiCheckCircleBold,
  PiProhibitBold,
  PiArchiveBold,
  PiClockBold,
  PiMapPinBold,
  PiEnvelopeBold,
  PiPhoneBold,
  PiGlobeBold,
  PiWarningCircleBold,
  PiArrowClockwiseBold,
} from 'react-icons/pi';

// ─── Badge helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: any; label: string }> = {
    approved: { color: 'success', label: 'Approved' },
    pending: { color: 'warning', label: 'Pending' },
    rejected: { color: 'danger', label: 'Rejected' },
    suspended: { color: 'danger', label: 'Suspended' },
    archived: { color: 'secondary', label: 'Archived' },
  };
  const cfg = map[status] ?? { color: 'secondary', label: status };
  return (
    <Badge
      color={cfg.color}
      variant="flat"
      className="text-xs font-semibold capitalize"
    >
      {cfg.label}
    </Badge>
  );
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: any; label: string }> = {
    active: { color: 'success', label: 'Active' },
    trialing: { color: 'primary', label: 'Trialing' },
    past_due: { color: 'warning', label: 'Past Due' },
    canceled: { color: 'danger', label: 'Canceled' },
    incomplete: { color: 'warning', label: 'Incomplete' },
    incomplete_expired: { color: 'danger', label: 'Expired' },
  };
  const cfg = map[status] ?? { color: 'secondary', label: status };
  return (
    <Badge color={cfg.color} variant="flat" className="text-xs font-semibold">
      {cfg.label}
    </Badge>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { color: any }> = {
    free_trial: { color: 'secondary' },
    starter: { color: 'primary' },
    pro: { color: 'info' },
    enterprise: { color: 'success' },
    custom: { color: 'warning' },
  };
  const cfg = map[plan] ?? { color: 'secondary' };
  return (
    <Badge
      color={cfg.color}
      variant="flat"
      className="text-xs font-semibold capitalize"
    >
      {(plan || '').replace(/_/g, ' ')}
    </Badge>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  iconBg = 'bg-blue-50',
  iconColor = 'text-blue-600',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <span className={iconColor}>{icon}</span>
        </div>
        <Text className="text-sm font-medium text-gray-500">{label}</Text>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <Text className="mt-0.5 text-xs text-gray-400">{sub}</Text>}
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <Text className="w-40 flex-shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </Text>
      <div className="flex-1 text-sm text-gray-700">{value}</div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <Title as="h6" className="mb-4 font-semibold text-gray-800">
        {title}
      </Title>
      {children}
    </div>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtCurrency(n?: number) {
  if (n == null) return '₦0';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;
  const router = useRouter();

  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    getAdminTenantById(token, id)
      .then(({ tenant }) => setTenant(tenant))
      .catch((err) => setError(err.message || 'Failed to load tenant'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [token, id]);

  async function changeStatus(newStatus: string) {
    if (!token) return;
    setActionLoading(true);
    try {
      await updateAdminTenant(token, id, { status: newStatus } as any);
      setTenant((prev: any) => ({ ...prev, status: newStatus }));
      toast.success(`Tenant ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  const breadcrumb = [
    { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
    { href: routes.eCommerce.tenants, name: 'Tenants' },
    { name: tenant?.name || 'Tenant' },
  ];

  if (loading) {
    return (
      <>
        <PageHeader title="Tenant" breadcrumb={breadcrumb} />
        <div className="flex h-60 flex-col items-center justify-center gap-3">
          <Loader variant="spinner" className="text-primary" />
          <Text className="text-sm text-gray-500">Loading tenant...</Text>
        </div>
      </>
    );
  }

  if (error || !tenant) {
    return (
      <>
        <PageHeader title="Tenant" breadcrumb={breadcrumb} />
        <div className="flex h-60 flex-col items-center justify-center gap-4">
          <PiWarningCircleBold className="h-10 w-10 text-red-300" />
          <Text className="text-sm text-red-500">
            {error || 'Tenant not found'}
          </Text>
          <Button size="sm" variant="outline" onClick={load}>
            <PiArrowClockwiseBold className="me-1.5 h-4 w-4" /> Retry
          </Button>
        </div>
      </>
    );
  }

  const t = tenant;
  const addressParts = [
    t.address?.street,
    t.address?.city,
    t.address?.lga,
    t.address?.state,
    t.address?.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <PageHeader title={t.name} breadcrumb={breadcrumb}>
        <div className="mt-4 flex flex-wrap items-center gap-2 @lg:mt-0">
          {t.status !== 'approved' && (
            <Button
              size="sm"
              variant="outline"
              isLoading={actionLoading}
              onClick={() => changeStatus('approved')}
              className="border-green-200 text-green-600 hover:bg-green-50"
            >
              <PiCheckCircleBold className="me-1.5 h-4 w-4" /> Approve
            </Button>
          )}
          {t.status !== 'suspended' && t.status !== 'archived' && (
            <Button
              size="sm"
              variant="outline"
              isLoading={actionLoading}
              onClick={() => changeStatus('suspended')}
              className="border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              <PiProhibitBold className="me-1.5 h-4 w-4" /> Suspend
            </Button>
          )}
          {t.status !== 'archived' && (
            <Button
              size="sm"
              variant="outline"
              isLoading={actionLoading}
              onClick={() => changeStatus('archived')}
              className="border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              <PiArchiveBold className="me-1.5 h-4 w-4" /> Archive
            </Button>
          )}
          <Link href={routes.eCommerce.editTenant(id)}>
            <Button size="sm">
              <PiPencilLineBold className="me-1.5 h-4 w-4" /> Edit Tenant
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="space-y-6">
        {/* ── Profile header card ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start gap-5">
            {/* Logo / avatar */}
            <div
              className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50"
              style={
                t.primaryColor
                  ? { borderColor: t.primaryColor + '33' }
                  : undefined
              }
            >
              {t.logo?.url ? (
                <img
                  src={t.logo.url}
                  alt={t.name}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <PiBuildingsBold
                  className="h-9 w-9"
                  style={{ color: t.primaryColor || '#94a3b8' }}
                />
              )}
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Title as="h4" className="font-bold text-gray-900">
                  {t.name}
                </Title>
                {t.isSystemTenant && (
                  <Badge color="warning" variant="flat" className="text-xs">
                    System
                  </Badge>
                )}
              </div>
              <div className="mb-3 flex items-center gap-1.5">
                <PiGlobeBold className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <Text className="font-mono text-sm text-gray-400">
                  {t.slug}.drinksharbour.com
                </Text>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={t.status} />
                <PlanBadge plan={t.plan} />
                <SubStatusBadge status={t.subscriptionStatus} />
                {t.revenueModel && (
                  <Badge
                    color="secondary"
                    variant="flat"
                    className="text-xs font-medium capitalize"
                  >
                    {t.revenueModel}
                  </Badge>
                )}
              </div>
            </div>

            {/* Primary colour swatch */}
            {t.primaryColor && (
              <div className="flex flex-shrink-0 items-center gap-2">
                <div
                  className="h-8 w-8 rounded-lg border border-gray-200 shadow-sm"
                  style={{ backgroundColor: t.primaryColor }}
                />
                <Text className="font-mono text-xs text-gray-500">
                  {t.primaryColor}
                </Text>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 gap-4 @lg:grid-cols-4">
          <StatCard
            icon={<PiPackageBold className="h-5 w-5" />}
            label="Products"
            value={t.productCount ?? 0}
            sub={
              t.activeSubProductCount
                ? `${t.activeSubProductCount} active variants`
                : undefined
            }
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
          <StatCard
            icon={<PiShoppingCartBold className="h-5 w-5" />}
            label="Total Orders"
            value={t.totalOrders ?? 0}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
          />
          <StatCard
            icon={<PiCurrencyNgnBold className="h-5 w-5" />}
            label="Total Revenue"
            value={fmtCurrency(t.totalRevenue)}
            iconBg="bg-green-50"
            iconColor="text-green-600"
          />
          <StatCard
            icon={<PiClockBold className="h-5 w-5" />}
            label="Created"
            value={fmtDate(t.createdAt) || '—'}
            sub={
              t.onboardedAt ? `Onboarded ${fmtDate(t.onboardedAt)}` : undefined
            }
            iconBg="bg-gray-50"
            iconColor="text-gray-500"
          />
        </div>

        {/* ── Main body ── */}
        <div className="flex flex-col gap-6 @5xl:flex-row @5xl:items-start">
          {/* Left */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Contact & Identity */}
            <Section title="Contact & Identity">
              <InfoRow
                label="Contact Email"
                value={
                  t.contactEmail && (
                    <a
                      href={`mailto:${t.contactEmail}`}
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <PiEnvelopeBold className="h-3.5 w-3.5 flex-shrink-0" />
                      {t.contactEmail}
                    </a>
                  )
                }
              />
              <InfoRow
                label="Contact Phone"
                value={
                  t.contactPhone && (
                    <a
                      href={`tel:${t.contactPhone}`}
                      className="flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <PiPhoneBold className="h-3.5 w-3.5 flex-shrink-0" />
                      {t.contactPhone}
                    </a>
                  )
                }
              />
              <InfoRow label="Country" value={t.country} />
              <InfoRow label="Default Currency" value={t.defaultCurrency} />
              {t.supportedCurrencies?.length > 0 && (
                <InfoRow
                  label="Supported Currencies"
                  value={
                    <div className="flex flex-wrap gap-1">
                      {t.supportedCurrencies.map((c: string) => (
                        <Badge
                          key={c}
                          color="secondary"
                          variant="flat"
                          className="text-xs"
                        >
                          {c}
                        </Badge>
                      ))}
                    </div>
                  }
                />
              )}
              {t.approvedAt && (
                <InfoRow label="Approved At" value={fmtDate(t.approvedAt)} />
              )}
              {t.rejectionReason && (
                <InfoRow
                  label="Rejection Reason"
                  value={
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {t.rejectionReason}
                    </div>
                  }
                />
              )}
            </Section>

            {/* Revenue Model */}
            <Section title="Revenue Model">
              <div className="mb-4 flex items-center gap-3">
                <Badge
                  color={t.revenueModel === 'markup' ? 'primary' : 'success'}
                  variant="flat"
                  className="text-sm font-semibold capitalize"
                >
                  {t.revenueModel || 'markup'}
                </Badge>
                {t.customPricingNote && (
                  <Text className="text-xs italic text-gray-500">
                    {t.customPricingNote}
                  </Text>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Markup %',
                    value:
                      t.markupPercentage != null
                        ? `${t.markupPercentage}%`
                        : null,
                  },
                  {
                    label: 'Commission %',
                    value:
                      t.commissionPercentage != null
                        ? `${t.commissionPercentage}%`
                        : null,
                  },
                  {
                    label: 'Platform Markup %',
                    value:
                      t.platformMarkupPercentage != null
                        ? `${t.platformMarkupPercentage}%`
                        : null,
                  },
                  {
                    label: 'Pack Markup %',
                    value: `${t.packMarkupPercentage ?? 10}%`,
                  },
                  {
                    label: 'Pack Commission %',
                    value:
                      t.packCommissionPercentage != null
                        ? `${t.packCommissionPercentage}%`
                        : null,
                  },
                  {
                    label: 'Pack Rate From',
                    value: `${t.packRateMinUnits ?? 2}+ units`,
                  },
                ].map(
                  ({ label, value }) =>
                    value && (
                      <div
                        key={label}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center"
                      >
                        <Text className="text-lg font-bold text-gray-800">
                          {value}
                        </Text>
                        <Text className="mt-0.5 text-xs text-gray-400">
                          {label}
                        </Text>
                      </div>
                    )
                )}
              </div>
            </Section>

            {/* Address */}
            {(addressParts || t.location?.lat) && (
              <Section title="Address">
                {addressParts && (
                  <div className="mb-4 flex items-start gap-2">
                    <PiMapPinBold className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div>
                      <Text className="text-sm text-gray-700">
                        {t.address?.formatted || addressParts}
                      </Text>
                      {t.normalizedState && (
                        <Text className="mt-0.5 text-xs text-gray-400">
                          State: {t.normalizedState}
                        </Text>
                      )}
                    </div>
                  </div>
                )}
                {t.location?.lat && (
                  <div className="flex flex-wrap gap-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    <span>
                      Lat:{' '}
                      <span className="font-mono font-medium text-gray-700">
                        {t.location.lat.toFixed(6)}
                      </span>
                    </span>
                    <span>
                      Lon:{' '}
                      <span className="font-mono font-medium text-gray-700">
                        {t.location.lon?.toFixed(6)}
                      </span>
                    </span>
                    {t.location.source && (
                      <span>
                        Source:{' '}
                        <span className="font-medium capitalize text-gray-700">
                          {t.location.source}
                        </span>
                      </span>
                    )}
                    {t.location.geocodedAt && (
                      <span>Geocoded: {fmtDate(t.location.geocodedAt)}</span>
                    )}
                  </div>
                )}
              </Section>
            )}

            {/* Purchase Settings */}
            {t.purchaseSettings && (
              <Section title="Purchase Settings">
                <div className="space-y-0">
                  <InfoRow
                    label="Bill Control"
                    value={
                      <Badge
                        color="secondary"
                        variant="flat"
                        className="text-xs capitalize"
                      >
                        {(
                          t.purchaseSettings.billControlPolicy || 'received'
                        ).replace(/_/g, ' ')}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label="Payment Terms"
                    value={t.purchaseSettings.defaultPaymentTerms}
                  />
                  <InfoRow
                    label="Approval Threshold"
                    value={
                      t.purchaseSettings.approvalThreshold != null
                        ? t.purchaseSettings.approvalThreshold === 0
                          ? 'All POs require approval'
                          : fmtCurrency(t.purchaseSettings.approvalThreshold)
                        : null
                    }
                  />
                  <InfoRow
                    label="Receiving Location"
                    value={t.purchaseSettings.defaultReceivingLocation}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { key: 'enable3WayMatching', label: '3-Way Matching' },
                    { key: 'requirePOApproval', label: 'PO Approval Required' },
                    { key: 'autoGenerateBill', label: 'Auto-Generate Bills' },
                    { key: 'allowPartialReceipts', label: 'Partial Receipts' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 flex-shrink-0 rounded-full ${t.purchaseSettings[key] ? 'bg-green-400' : 'bg-gray-300'}`}
                      />
                      <Text className="text-sm text-gray-600">{label}</Text>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Admin Notes */}
            {t.notes && (
              <Section title="Admin Notes">
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                  <Text className="whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
                    {t.notes}
                  </Text>
                </div>
              </Section>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-full space-y-6 @5xl:w-72 @5xl:flex-shrink-0">
            {/* Subscription */}
            <Section title="Subscription">
              <div className="space-y-0">
                <InfoRow label="Plan" value={<PlanBadge plan={t.plan} />} />
                <InfoRow
                  label="Sub. Status"
                  value={<SubStatusBadge status={t.subscriptionStatus} />}
                />
                <InfoRow label="Trial Ends" value={fmtDate(t.trialEndsAt)} />
                <InfoRow
                  label="Period Start"
                  value={fmtDate(t.currentPeriodStart)}
                />
                <InfoRow
                  label="Period End"
                  value={fmtDate(t.currentPeriodEnd)}
                />
              </div>
              {(t.stripeCustomerId || t.stripeSubscriptionId) && (
                <div className="mt-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  {t.stripeCustomerId && (
                    <div>
                      <Text className="mb-0.5 text-xs text-gray-400">
                        Stripe Customer
                      </Text>
                      <Text className="break-all font-mono text-xs text-gray-700">
                        {t.stripeCustomerId}
                      </Text>
                    </div>
                  )}
                  {t.stripeSubscriptionId && (
                    <div>
                      <Text className="mb-0.5 text-xs text-gray-400">
                        Stripe Subscription
                      </Text>
                      <Text className="break-all font-mono text-xs text-gray-700">
                        {t.stripeSubscriptionId}
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Settings */}
            <Section title="Settings">
              <div className="space-y-2">
                {[
                  {
                    label: 'Age Verification',
                    value: t.enforceAgeVerification,
                    desc: 'Required on storefront',
                  },
                  {
                    label: 'System Tenant',
                    value: t.isSystemTenant,
                    desc: 'Protected from deletion',
                  },
                ].map(({ label, value, desc }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <Text className="text-sm font-medium text-gray-700">
                        {label}
                      </Text>
                      <Text className="text-xs text-gray-400">{desc}</Text>
                    </div>
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${value ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {value ? (
                        <PiCheckCircleBold className="h-4 w-4" />
                      ) : (
                        <PiProhibitBold className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Quick actions */}
            <Section title="Quick Actions">
              <div className="space-y-2">
                <Link href={routes.eCommerce.editTenant(id)} className="block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                  >
                    <PiPencilLineBold className="h-4 w-4" /> Edit Tenant
                  </Button>
                </Link>
                {t.status !== 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={actionLoading}
                    onClick={() => changeStatus('approved')}
                    className="w-full justify-start gap-2 border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <PiCheckCircleBold className="h-4 w-4" /> Approve
                  </Button>
                )}
                {t.status === 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={actionLoading}
                    onClick={() => changeStatus('suspended')}
                    className="w-full justify-start gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                  >
                    <PiProhibitBold className="h-4 w-4" /> Suspend
                  </Button>
                )}
                {t.status !== 'archived' && (
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={actionLoading}
                    onClick={() => changeStatus('archived')}
                    className="w-full justify-start gap-2 border-gray-200 text-gray-500 hover:bg-gray-50"
                  >
                    <PiArchiveBold className="h-4 w-4" /> Archive
                  </Button>
                )}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
