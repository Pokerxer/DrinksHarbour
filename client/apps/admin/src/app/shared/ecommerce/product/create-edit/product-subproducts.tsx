// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Badge, Text, Textarea, ActionIcon } from 'rizzui';
import {
  PiStorefront,
  PiCheckCircleBold,
  PiXCircleBold,
  PiSpinnerBold,
  PiPackageBold,
  PiArrowsClockwiseBold,
  PiClockBold,
  PiWarningBold,
  PiCurrencyNgnBold,
  PiStackBold,
  PiEyeBold,
  PiXBold,
  PiRulerBold,
  PiTruckBold,
  PiNoteBold,
  PiImageBold,
  PiTagBold,
  PiShoppingBagBold,
  PiUserBold,
  PiCheckSquareBold,
} from 'react-icons/pi';
import { subproductService } from '@/services/subproduct.service';
import cn from '@core/utils/class-names';

interface SubProductItem {
  _id: string;
  sku?: string;
  status: string;
  tenant?: { _id: string; name: string };
  baseSellingPrice?: number;
  currency?: string;
  availableStock?: number;
  totalStock?: number;
  sizes?: Array<{ size: string; stock?: number; basePrice?: number }>;
  createdAt: string;
}

interface FullSubProduct extends SubProductItem {
  costPrice?: number;
  markupPercentage?: number;
  marginPercentage?: number;
  salePrice?: number;
  saleDiscountPercentage?: number;
  isOnSale?: boolean;
  saleStartDate?: string;
  saleEndDate?: string;
  shortDescriptionOverride?: string;
  descriptionOverride?: string;
  tenantNotes?: string;
  imagesOverride?: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  reservedStock?: number;
  lowStockThreshold?: number;
  shipping?: {
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
    fragile?: boolean;
    requiresAgeVerification?: boolean;
    hazmat?: boolean;
    shippingClass?: string;
  };
  warehouse?: {
    location?: string;
    zone?: string;
    aisle?: string;
    shelf?: string;
    bin?: string;
  };
  isFeaturedByTenant?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  vendor?: string;
  supplierSKU?: string;
  updatedAt?: string;
}

const STATUS_MAP: Record<
  string,
  {
    label: string;
    color: 'success' | 'warning' | 'danger' | 'secondary' | 'primary';
  }
> = {
  active: { label: 'Active', color: 'success' },
  pending: { label: 'Pending', color: 'warning' },
  draft: { label: 'Draft', color: 'secondary' },
  archived: { label: 'Declined', color: 'danger' },
  discontinued: { label: 'Discontinued', color: 'danger' },
  hidden: { label: 'Hidden', color: 'secondary' },
  low_stock: { label: 'Low Stock', color: 'warning' },
  out_of_stock: { label: 'Out of Stock', color: 'danger' },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, color: 'secondary' };
  return (
    <Badge
      color={info.color}
      variant="flat"
      className="text-xs font-semibold capitalize"
    >
      {info.label}
    </Badge>
  );
}

function RowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0">
      <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-lg bg-gray-200" />
        <div className="h-8 w-20 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  if (value == null || value === '' || value === false) return null;
  return (
    <div className="flex items-start justify-between border-b border-gray-50 py-2 last:border-0">
      <span className="w-36 flex-shrink-0 text-xs text-gray-500">{label}</span>
      <span
        className={cn('text-right text-xs text-gray-900', mono && 'font-mono')}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </span>
      </div>
      <div className="rounded-xl bg-gray-50 px-4 py-1">{children}</div>
    </div>
  );
}

type PriceOverrides = {
  baseWebsitePrice?: number;
  sizes?: Array<{ id: string; websitePrice: number }>;
};

function ReviewDrawer({
  subProductId,
  token,
  isOpen,
  onClose,
  onApprove,
  onDecline,
}: {
  subProductId: string | null;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string, overrides?: PriceOverrides) => Promise<void>;
  onDecline: (id: string, reason?: string) => Promise<void>;
}) {
  const [sp, setSp] = useState<FullSubProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<'approving' | 'declining' | null>(
    null
  );
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [sizeWebsitePrices, setSizeWebsitePrices] = useState<
    Record<string, string>
  >({});
  const [baseWebsitePrice, setBaseWebsitePrice] = useState<string>('');
  // Server-computed platform prices — used to detect which inputs the admin
  // actually changed, so unchanged values are never sent as overrides
  const [serverDefaults, setServerDefaults] = useState<{
    base: number;
    sizes: Record<string, number>;
  }>({ base: 0, sizes: {} });
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState(0);

  const fmt = (v?: number | null) =>
    v != null
      ? `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
      : null;

  // Keyboard shortcut to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        isOpen &&
        !showApproveConfirm &&
        !showDeclineConfirm
      ) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showApproveConfirm, showDeclineConfirm]);

  // Section navigation
  const reviewSections = [
    { id: 0, label: 'Overview' },
    { id: 1, label: 'Pricing' },
    { id: 2, label: 'Product' },
    { id: 3, label: 'Inventory' },
  ];

  useEffect(() => {
    if (!isOpen || !subProductId) return;
    setSp(null);
    setLoading(true);
    setDeclineReason('');
    setShowDeclineForm(false);
    setShowApproveConfirm(false);
    setShowDeclineConfirm(false);
    setSizeWebsitePrices({});
    setBaseWebsitePrice('');
    setShowSuccess(null);
    setCurrentSection(0);

    subproductService
      .getSubProduct(subProductId, token)
      .then((res: any) => {
        const data =
          res?.data?.subProduct ?? res?.subProduct ?? res?.data ?? res;
        setSp(data);
        if (!data) return;

        const defaults: { base: number; sizes: Record<string, number> } = {
          base: 0,
          sizes: {},
        };

        if (data.pricing?.platformSellingPrice > 0) {
          defaults.base = data.pricing.platformSellingPrice;
          setBaseWebsitePrice(String(data.pricing.platformSellingPrice));
        }

        const initSizes: Record<string, string> = {};
        for (const s of data.sizes ?? []) {
          if (s.pricing?.platformSellingPrice > 0) {
            defaults.sizes[s._id] = s.pricing.platformSellingPrice;
            initSizes[s._id] = String(s.pricing.platformSellingPrice);
          }
        }
        setSizeWebsitePrices(initSizes);
        setServerDefaults(defaults);
      })
      .catch(() => setSp(null))
      .finally(() => setLoading(false));
  }, [isOpen, subProductId]);

  const handleApprove = async () => {
    if (!sp) return;
    setActioning('approving');
    // Only send prices the admin actually changed (±₦1 vs the server-computed
    // default) — unchanged inputs must not become back-calculated overrides
    const changed = (entered: number, def: number) =>
      !isNaN(entered) && entered > 0 && Math.abs(entered - (def || 0)) >= 1;
    const overrides: PriceOverrides = {};
    const bp = parseFloat(baseWebsitePrice);
    if (changed(bp, serverDefaults.base)) overrides.baseWebsitePrice = bp;
    const sizeEntries = Object.entries(sizeWebsitePrices)
      .map(([id, v]) => ({ id, websitePrice: parseFloat(v) }))
      .filter((e) => changed(e.websitePrice, serverDefaults.sizes[e.id]));
    if (sizeEntries.length) overrides.sizes = sizeEntries;
    try {
      await onApprove(sp._id, overrides);
      onClose();
    } finally {
      setActioning(null);
    }
  };

  const handleDecline = async () => {
    if (!sp) return;
    setActioning('declining');
    try {
      await onDecline(sp._id, declineReason || undefined);
      onClose();
    } finally {
      setActioning(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay — click outside to close */}
      <div className="fixed inset-0 z-[9998] bg-black/40" onClick={onClose} />
      {/* Panel — stopPropagation keeps all internal clicks from hitting the overlay */}
      <div
        className="fixed right-0 top-0 z-[9999] flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
            <div className="flex items-center gap-2">
              <PiShoppingBagBold className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-semibold text-gray-900">
                Review Sub-Product
              </span>
            </div>
            <ActionIcon size="sm" variant="text" onClick={onClose}>
              <PiXBold className="h-4 w-4" />
            </ActionIcon>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <PiSpinnerBold className="h-8 w-8 animate-spin text-blue-400" />
              </div>
            )}

            {!loading && !sp && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <PiWarningBold className="mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-400">
                  Failed to load sub-product details
                </p>
              </div>
            )}

            {!loading &&
              sp &&
              (() => {
                const pricing = (sp as any).pricing || {};
                const revenueModel = pricing.revenueModel ?? 'markup';
                const markupPct = pricing.markupPct ?? 25;
                const commissionPct = pricing.commissionPct ?? 12;
                const platformMarkupPct = pricing.platformMarkupPct ?? 15;

                const supplierCostBase = pricing.costPrice || 0;
                const tenantSellingBase = pricing.tenantSellingPrice || 0;
                const platformCostBase = pricing.platformCostPrice || 0;
                const platformSellingBase = pricing.platformSellingPrice || 0;
                const platformMargin = pricing.platformMargin || 0;
                const tenantReceives =
                  pricing.tenantReceives || supplierCostBase;
                const hasProductDiscount =
                  pricing.productDiscount?.active || false;
                const tenantStorePrice =
                  pricing.tenantDiscount?.discountedPrice || null;

                return (
                  <>
                    {/* Status + Meta */}
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={sp.status} />
                      <span className="font-mono text-[10px] text-gray-400">
                        {sp.sku || 'No SKU'}
                      </span>
                    </div>

                    {/* Tenant */}
                    <Section title="Tenant" icon={PiUserBold}>
                      <InfoRow
                        label="Store"
                        value={
                          (sp as any).tenant?.name ||
                          (sp as any).tenant?.businessName
                        }
                      />
                      <InfoRow
                        label="Tenant Price"
                        value={
                          <span className="font-semibold text-orange-600">
                            {tenantSellingBase > 0
                              ? fmt(tenantSellingBase)
                              : '—'}
                          </span>
                        }
                      />
                      <InfoRow
                        label="Revenue Model"
                        value={
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                              revenueModel === 'commission'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            )}
                          >
                            {revenueModel}
                          </span>
                        }
                      />
                      {revenueModel === 'markup' ? (
                        <InfoRow label="Markup %" value={`${markupPct}%`} />
                      ) : (
                        <InfoRow
                          label="Commission %"
                          value={`${commissionPct}%`}
                        />
                      )}
                      {revenueModel === 'markup' && (
                        <InfoRow
                          label="Pack Markup %"
                          value={
                            <span className="font-medium text-amber-600">
                              {(sp as any).tenant?.packMarkupPercentage ?? 10}%
                              from {(sp as any).tenant?.packRateMinUnits ?? 2}+
                              units/pack
                            </span>
                          }
                        />
                      )}
                      {revenueModel === 'commission' &&
                        (sp as any).tenant?.packCommissionPercentage !=
                          null && (
                          <InfoRow
                            label="Pack Commission %"
                            value={
                              <span className="font-medium text-amber-600">
                                {(sp as any).tenant.packCommissionPercentage}%
                                from {(sp as any).tenant.packRateMinUnits ?? 2}+
                                units/pack
                              </span>
                            }
                          />
                        )}
                    </Section>

                    {/* Pricing Chain - Platform Pricing Pipeline */}
                    {(() => {
                      const currentBaseVal = baseWebsitePrice;
                      const defaultWebsite = platformSellingBase;

                      return (
                        <div className="mb-5">
                          <div className="mb-3 flex items-center gap-2">
                            <PiCurrencyNgnBold className="h-4 w-4 text-gray-400" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Platform Pricing
                            </span>
                            <span
                              className={cn(
                                'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                                revenueModel === 'commission'
                                  ? 'bg-purple-50 text-purple-600'
                                  : 'bg-blue-50 text-blue-600'
                              )}
                            >
                              {revenueModel}
                            </span>
                          </div>

                          {revenueModel === 'markup' ? (
                            // Markup pipeline: Supplier Cost → ×(1+markup%) → Platform Cost → ×(1+platformMarkup%) → Platform Selling
                            <div className="mb-3 space-y-2">
                              <div className="flex items-center gap-1 text-[10px]">
                                <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-1.5 py-2 text-center">
                                  <div className="mb-0.5 text-[9px] text-gray-500">
                                    Supplier Cost
                                  </div>
                                  <div className="font-bold text-gray-700">
                                    {supplierCostBase > 0
                                      ? fmt(supplierCostBase)
                                      : '—'}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 px-0.5 text-center text-gray-400">
                                  ×(1+{markupPct}%)
                                </div>
                                <div className="flex-1 rounded-lg border border-blue-100 bg-blue-50 px-1.5 py-2 text-center">
                                  <div className="mb-0.5 text-[9px] text-blue-500">
                                    Platform Cost
                                  </div>
                                  <div className="font-bold text-blue-700">
                                    {platformCostBase > 0
                                      ? fmt(platformCostBase)
                                      : '—'}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 px-0.5 text-center text-gray-400">
                                  ×(1+{platformMarkupPct}%)
                                </div>
                                <div className="flex-1 rounded-lg border border-indigo-100 bg-indigo-50 px-1.5 py-2 text-center">
                                  <div className="mb-0.5 text-[9px] text-indigo-500">
                                    Platform Selling
                                  </div>
                                  <div className="font-bold text-indigo-700">
                                    {platformSellingBase > 0
                                      ? fmt(platformSellingBase)
                                      : '—'}
                                  </div>
                                </div>
                              </div>
                              <p className="text-center text-[10px] text-gray-400">
                                platformCost = supplierCost × (1+{markupPct}%) ·
                                platformSelling = platformCost × (1+
                                {platformMarkupPct}%) · margin = selling − cost
                              </p>
                              {tenantStorePrice != null &&
                                tenantStorePrice < tenantSellingBase && (
                                  <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-[10px]">
                                    <div className="font-medium text-orange-600">
                                      Tenant Store Price (with tenant discount):{' '}
                                      {fmt(tenantStorePrice)}
                                    </div>
                                    <div className="text-[9px] text-orange-400">
                                      Tenant discount is for tenant store only —
                                      does not affect platform pricing
                                    </div>
                                  </div>
                                )}
                            </div>
                          ) : (
                            // Commission pipeline: Tenant Selling Price → Platform Cost Price → Platform Selling Price → Final Platform Price
                            <div className="mb-3 space-y-2">
                              <div className="flex items-center gap-1 text-[10px]">
                                <div className="flex-1 rounded-lg border border-orange-100 bg-orange-50 px-1.5 py-2 text-center">
                                  <div className="mb-0.5 flex items-center justify-center gap-0.5 text-[9px] text-orange-500">
                                    <PiStorefront className="h-2.5 w-2.5" />{' '}
                                    Tenant Price
                                  </div>
                                  <div className="font-bold text-orange-700">
                                    {tenantSellingBase > 0
                                      ? fmt(tenantSellingBase)
                                      : '—'}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 px-0.5 text-center text-gray-400">
                                  ×(1−{commissionPct}%)
                                </div>
                                <div className="flex-1 rounded-lg border border-blue-100 bg-blue-50 px-1.5 py-2 text-center">
                                  <div className="mb-0.5 text-[9px] text-blue-500">
                                    Platform Cost
                                  </div>
                                  <div className="font-bold text-blue-700">
                                    {platformCostBase > 0
                                      ? fmt(platformCostBase)
                                      : '—'}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 px-0.5 text-center text-gray-400">
                                  ×(1+{platformMarkupPct}%)
                                </div>
                                <div className="flex-1 rounded-lg border border-indigo-100 bg-indigo-50 px-1.5 py-2 text-center">
                                  <div className="mb-0.5 text-[9px] text-indigo-500">
                                    Platform Selling
                                  </div>
                                  <div className="font-bold text-indigo-700">
                                    {platformSellingBase > 0
                                      ? fmt(platformSellingBase)
                                      : '—'}
                                  </div>
                                </div>
                              </div>
                              <p className="text-center text-[10px] text-gray-400">
                                platformCost = tenantPrice × (1−{commissionPct}
                                %) · platformSelling = platformCost × (1+
                                {platformMarkupPct}%) · margin = selling − cost
                              </p>
                              {tenantStorePrice != null &&
                                tenantStorePrice < tenantSellingBase && (
                                  <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-[10px]">
                                    <div className="font-medium text-orange-600">
                                      Tenant Store Price (with tenant discount):{' '}
                                      {fmt(tenantStorePrice)}
                                    </div>
                                    <div className="text-[9px] text-orange-400">
                                      Tenant discount is for tenant store only —
                                      does not affect platform pricing
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}

                          {/* Editable base website price */}
                          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-green-700">
                                Final Platform Price (editable)
                              </span>
                              {defaultWebsite > 0 &&
                                parseFloat(currentBaseVal) !==
                                  defaultWebsite && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBaseWebsitePrice(
                                        String(defaultWebsite)
                                      )
                                    }
                                    className="text-[10px] text-green-600 underline"
                                  >
                                    Reset to {fmt(defaultWebsite)}
                                  </button>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-green-700">
                                ₦
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={currentBaseVal}
                                onChange={(e) =>
                                  setBaseWebsitePrice(e.target.value)
                                }
                                className="flex-1 rounded-lg border border-green-200 bg-white px-3 py-1.5 text-sm font-bold text-green-900 focus:outline-none focus:ring-2 focus:ring-green-300"
                              />
                            </div>
                          </div>

                          {/* Summary strip - Platform Margin (live: follows the editable price) */}
                          {(() => {
                            const entered = parseFloat(currentBaseVal);
                            const liveMargin =
                              !isNaN(entered) &&
                              entered > 0 &&
                              platformCostBase > 0
                                ? parseFloat(
                                    (entered - platformCostBase).toFixed(2)
                                  )
                                : platformMargin;
                            return (
                              <div className="mt-3 space-y-2">
                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                  <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-center">
                                    <div className="mb-0.5 text-orange-500">
                                      Tenant Price
                                    </div>
                                    <div className="font-bold text-orange-700">
                                      {tenantSellingBase > 0
                                        ? fmt(tenantSellingBase)
                                        : '—'}
                                    </div>
                                  </div>
                                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-center">
                                    <div className="mb-0.5 text-gray-400">
                                      Supplier Cost
                                    </div>
                                    <div className="font-bold text-gray-700">
                                      {supplierCostBase > 0
                                        ? fmt(supplierCostBase)
                                        : '—'}
                                    </div>
                                  </div>
                                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-center">
                                    <div className="mb-0.5 text-blue-500">
                                      Platform Margin
                                    </div>
                                    <div
                                      className={cn(
                                        'font-bold',
                                        liveMargin != null && liveMargin > 0
                                          ? 'text-blue-700'
                                          : 'text-red-500'
                                      )}
                                    >
                                      {liveMargin != null
                                        ? fmt(liveMargin)
                                        : '—'}
                                    </div>
                                  </div>
                                </div>
                                {revenueModel === 'commission' && (
                                  <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-center">
                                    <div className="mb-0.5 text-[10px] text-purple-500">
                                      Tenant Receives (after {commissionPct}%
                                      commission)
                                    </div>
                                    <div className="font-bold text-purple-700">
                                      {tenantReceives != null
                                        ? fmt(tenantReceives)
                                        : '—'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* Core Info */}
                    <Section title="Product Info" icon={PiTagBold}>
                      <InfoRow
                        label="Product"
                        value={(sp as any).product?.name}
                      />
                      <InfoRow
                        label="Category"
                        value={(sp as any).product?.category?.name}
                      />
                      <InfoRow
                        label="Brand"
                        value={(sp as any).product?.brand?.name}
                      />
                      <InfoRow
                        label="ABV"
                        value={
                          (sp as any).product?.abv != null
                            ? `${(sp as any).product.abv}%`
                            : null
                        }
                      />
                      <InfoRow
                        label="Volume"
                        value={
                          (sp as any).product?.volumeMl != null
                            ? `${(sp as any).product.volumeMl}ml`
                            : null
                        }
                      />
                      <InfoRow
                        label="Origin"
                        value={(sp as any).product?.originCountry}
                      />
                    </Section>

                    {/* Sale */}
                    {sp.isOnSale && (
                      <>
                        <InfoRow label="Sale Price" value={fmt(sp.salePrice)} />
                        <InfoRow
                          label="Sale Discount"
                          value={
                            sp.saleDiscountPercentage != null
                              ? `${sp.saleDiscountPercentage}%`
                              : null
                          }
                        />
                        <InfoRow
                          label="Sale Start"
                          value={
                            sp.saleStartDate
                              ? new Date(sp.saleStartDate).toLocaleDateString(
                                  'en-GB'
                                )
                              : null
                          }
                        />
                        <InfoRow
                          label="Sale End"
                          value={
                            sp.saleEndDate
                              ? new Date(sp.saleEndDate).toLocaleDateString(
                                  'en-GB'
                                )
                              : null
                          }
                        />
                      </>
                    )}

                    {/* Inventory */}
                    <Section title="Inventory" icon={PiStackBold}>
                      <InfoRow
                        label="Total Stock"
                        value={
                          sp.totalStock != null
                            ? sp.totalStock.toString()
                            : null
                        }
                      />
                      <InfoRow
                        label="Available"
                        value={
                          sp.availableStock != null
                            ? sp.availableStock.toString()
                            : null
                        }
                      />
                      <InfoRow
                        label="Reserved"
                        value={
                          sp.reservedStock != null
                            ? sp.reservedStock.toString()
                            : null
                        }
                      />
                      <InfoRow
                        label="Low Stock Alert"
                        value={
                          sp.lowStockThreshold != null
                            ? `≤ ${sp.lowStockThreshold} units`
                            : null
                        }
                      />
                    </Section>

                    {/* Size Variants */}
                    {sp.sizes &&
                      sp.sizes.length > 0 &&
                      (() => {
                        // Product-level discount for platform pricing
                        const productDiscount =
                          (sp as any).product?.platformDiscount?.value > 0 &&
                          (sp as any).product?.platformDiscount?.type
                            ? {
                                value: (sp as any).product.platformDiscount
                                  .value,
                                type: (sp as any).product.platformDiscount.type,
                                start: (sp as any).product.platformDiscount
                                  .start,
                                end: (sp as any).product.platformDiscount.end,
                              }
                            : null;

                        return (
                          <div className="mb-5">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <PiRulerBold className="h-4 w-4 text-gray-400" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Size Variants ({sp.sizes.length})
                                </span>
                              </div>
                              <span className="text-[10px] font-medium text-green-600">
                                Website ₦ is editable
                              </span>
                            </div>

                            <div className="space-y-2">
                              {sp.sizes.map((s: any) => {
                                const sizeId = s._id;
                                // Use server-provided size pricing
                                const sizePricing = s.pricing || {};
                                const sizeSupplierCost =
                                  sizePricing.costPrice || 0;
                                const sizeSellingPrice =
                                  sizePricing.tenantSellingPrice || 0;
                                const sizePlatformCost =
                                  sizePricing.platformCostPrice || 0;
                                const sizePlatformSelling =
                                  sizePricing.platformSellingPrice || 0;
                                const sizePlatformMargin =
                                  sizePricing.platformMargin || 0;
                                const sizeHasDiscount =
                                  sizePricing.productDiscount?.active || false;
                                const sizeTenantStorePrice =
                                  sizePricing.tenantDiscount?.discountedPrice ||
                                  null;
                                // Multi-pack sizes are priced with the tenant's reduced pack rate
                                const sizeMarkupPct =
                                  sizePricing.markupPct ?? markupPct;
                                const sizeCommissionPct =
                                  sizePricing.commissionPct ?? commissionPct;
                                const sizeIsPackRate =
                                  sizePricing.isPackRate || false;
                                const sizeUnitsPerPack = s.unitsPerPack || 1;

                                const defaultWebsite = sizePlatformSelling;
                                const currentVal =
                                  sizeWebsitePrices[sizeId] ?? '';
                                // Margin follows the editable price live
                                const enteredSize = parseFloat(currentVal);
                                const liveSizeMargin =
                                  !isNaN(enteredSize) &&
                                  enteredSize > 0 &&
                                  sizePlatformCost > 0
                                    ? parseFloat(
                                        (
                                          enteredSize - sizePlatformCost
                                        ).toFixed(2)
                                      )
                                    : sizePlatformMargin;

                                return (
                                  <div
                                    key={sizeId}
                                    className="rounded-xl border border-gray-100 bg-gray-50/50 p-3"
                                  >
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                      <span className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                                        {s.size || s.displayName || '-'}
                                        {sizeIsPackRate && (
                                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
                                            Pack ×{sizeUnitsPerPack} ·{' '}
                                            {revenueModel === 'commission'
                                              ? `${sizeCommissionPct}% pack commission`
                                              : `${sizeMarkupPct}% pack markup`}
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-[10px] text-gray-400">
                                        {s.stock ?? 0} in stock
                                      </span>
                                    </div>

                                    {revenueModel === 'markup' ? (
                                      // Markup pipeline: Tenant Price → Supplier Cost → Platform Cost → Platform Selling (includes discount)
                                      <div className="mb-2 space-y-1.5">
                                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-center">
                                            <div className="mb-0.5 text-gray-500">
                                              Supplier Cost
                                            </div>
                                            <div className="font-bold text-gray-700">
                                              {sizeSupplierCost > 0
                                                ? `₦${sizeSupplierCost.toLocaleString()}`
                                                : '—'}
                                            </div>
                                          </div>
                                          <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-center">
                                            <div className="mb-0.5 text-blue-500">
                                              Platform Cost
                                            </div>
                                            <div className="font-bold text-blue-700">
                                              {sizePlatformCost > 0
                                                ? `₦${sizePlatformCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                : '—'}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px]">
                                          <div className="flex-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-center">
                                            <div className="mb-0.5 text-indigo-500">
                                              Platform Selling
                                              {sizeHasDiscount && (
                                                <span className="ml-1 text-green-600">
                                                  (after discount)
                                                </span>
                                              )}
                                            </div>
                                            <div className="font-bold text-indigo-700">
                                              {sizePlatformSelling > 0
                                                ? `₦${sizePlatformSelling.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                : '—'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      // Commission pipeline: Tenant Selling Price → Platform Cost → Platform Selling (includes discount)
                                      <div className="mb-2 space-y-1.5">
                                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                          <div className="rounded-lg border border-orange-100 bg-orange-50 px-2 py-1.5 text-center">
                                            <div className="mb-0.5 flex items-center justify-center gap-0.5 text-orange-500">
                                              <PiStorefront className="h-2.5 w-2.5" />{' '}
                                              Tenant Price
                                            </div>
                                            <div className="font-bold text-orange-700">
                                              {sizeSellingPrice > 0
                                                ? `₦${sizeSellingPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                : '—'}
                                            </div>
                                          </div>
                                          <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-center">
                                            <div className="mb-0.5 text-blue-500">
                                              Platform Cost
                                            </div>
                                            <div className="font-bold text-blue-700">
                                              {sizePlatformCost > 0
                                                ? `₦${sizePlatformCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                : '—'}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px]">
                                          <div className="flex-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-center">
                                            <div className="mb-0.5 text-indigo-500">
                                              Platform Selling
                                              {sizeHasDiscount && (
                                                <span className="ml-1 text-green-600">
                                                  (after discount)
                                                </span>
                                              )}
                                            </div>
                                            <div className="font-bold text-indigo-700">
                                              {sizePlatformSelling > 0
                                                ? `₦${sizePlatformSelling.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                : '—'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                                      <div className="mb-1 flex items-center justify-between">
                                        <div className="text-[10px] font-semibold text-green-700">
                                          Final Platform Price (editable)
                                        </div>
                                        {defaultWebsite > 0 &&
                                          parseFloat(currentVal) !==
                                            defaultWebsite && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setSizeWebsitePrices(
                                                  (prev) => ({
                                                    ...prev,
                                                    [sizeId]:
                                                      String(defaultWebsite),
                                                  })
                                                )
                                              }
                                              className="text-[10px] text-green-600 underline"
                                            >
                                              Reset to ₦
                                              {defaultWebsite.toLocaleString()}
                                            </button>
                                          )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-green-700">
                                          ₦
                                        </span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="50"
                                          value={currentVal}
                                          onChange={(e) =>
                                            setSizeWebsitePrices((prev) => ({
                                              ...prev,
                                              [sizeId]: e.target.value,
                                            }))
                                          }
                                          className="flex-1 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-bold text-green-900 focus:outline-none focus:ring-2 focus:ring-green-300"
                                        />
                                        {liveSizeMargin != null && (
                                          <span
                                            className={cn(
                                              'whitespace-nowrap text-[10px] font-medium',
                                              liveSizeMargin > 0
                                                ? 'text-blue-600'
                                                : 'text-red-500'
                                            )}
                                          >
                                            Margin:{' '}
                                            {liveSizeMargin > 0 ? '+' : ''}₦
                                            {liveSizeMargin.toLocaleString(
                                              undefined,
                                              { maximumFractionDigits: 0 }
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="mt-2 px-1 text-[10px] text-gray-400">
                              {revenueModel === 'commission' ? (
                                <span>
                                  platformCost = tenantPrice × (1−
                                  {commissionPct}%) · platformSelling =
                                  platformCost × (1+{platformMarkupPct}%) ·
                                  margin = selling − cost
                                </span>
                              ) : (
                                <span>
                                  platformCost = supplierCost × (1+{markupPct}%)
                                  · platformSelling = platformCost × (1+
                                  {platformMarkupPct}%) · margin = selling −
                                  cost
                                </span>
                              )}
                              {sp.sizes.some(
                                (s: any) => s.pricing?.isPackRate
                              ) && (
                                <span className="text-amber-500">
                                  {' '}
                                  · multi-pack sizes use the tenant&apos;s
                                  reduced pack rate shown on each card
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                    {/* Description Overrides */}
                    {(sp.shortDescriptionOverride ||
                      sp.descriptionOverride) && (
                      <Section title="Description Override" icon={PiNoteBold}>
                        {sp.shortDescriptionOverride && (
                          <div className="py-2">
                            <p className="mb-1 text-xs text-gray-500">
                              Short Description
                            </p>
                            <p className="text-xs leading-relaxed text-gray-800">
                              {sp.shortDescriptionOverride}
                            </p>
                          </div>
                        )}
                        {sp.descriptionOverride && (
                          <div className="border-t border-gray-100 py-2">
                            <p className="mb-1 text-xs text-gray-500">
                              Full Description
                            </p>
                            <p className="line-clamp-6 text-xs leading-relaxed text-gray-800">
                              {sp.descriptionOverride}
                            </p>
                          </div>
                        )}
                      </Section>
                    )}

                    {/* Images */}
                    {sp.imagesOverride && sp.imagesOverride.length > 0 && (
                      <div className="mb-5">
                        <div className="mb-2 flex items-center gap-2">
                          <PiImageBold className="h-4 w-4 text-gray-400" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Image Overrides ({sp.imagesOverride.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sp.imagesOverride
                            .slice(0, 6)
                            .map((img: any, i: number) => (
                              <div key={i} className="relative">
                                <img
                                  src={img.url}
                                  alt={img.alt || `Image ${i + 1}`}
                                  className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      '/placeholder.png';
                                  }}
                                />
                                {img.isPrimary && (
                                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
                                    <PiCheckCircleBold className="h-2.5 w-2.5 text-white" />
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Shipping */}
                    {sp.shipping &&
                      Object.values(sp.shipping).some(
                        (v) => v != null && v !== false
                      ) && (
                        <Section title="Shipping" icon={PiTruckBold}>
                          <InfoRow
                            label="Weight"
                            value={
                              sp.shipping.weight != null
                                ? `${sp.shipping.weight} kg`
                                : null
                            }
                          />
                          <InfoRow
                            label="Dimensions"
                            value={
                              sp.shipping.length &&
                              sp.shipping.width &&
                              sp.shipping.height
                                ? `${sp.shipping.length} × ${sp.shipping.width} × ${sp.shipping.height} cm`
                                : null
                            }
                          />
                          <InfoRow
                            label="Shipping Class"
                            value={sp.shipping.shippingClass}
                          />
                          <InfoRow
                            label="Fragile"
                            value={sp.shipping.fragile ? 'Yes' : null}
                          />
                          <InfoRow
                            label="Age Verification"
                            value={
                              sp.shipping.requiresAgeVerification
                                ? 'Required'
                                : null
                            }
                          />
                          <InfoRow
                            label="Hazmat"
                            value={sp.shipping.hazmat ? 'Yes' : null}
                          />
                        </Section>
                      )}

                    {/* Flags */}
                    <Section title="Flags" icon={PiCheckSquareBold}>
                      <InfoRow
                        label="Featured"
                        value={sp.isFeaturedByTenant ? 'Yes' : null}
                      />
                      <InfoRow
                        label="New Arrival"
                        value={sp.isNewArrival ? 'Yes' : null}
                      />
                      <InfoRow
                        label="Best Seller"
                        value={sp.isBestSeller ? 'Yes' : null}
                      />
                    </Section>

                    {/* Decline form */}
                    {showDeclineForm && (
                      <div className="mb-4">
                        <label className="mb-1 block text-xs font-semibold text-gray-700">
                          Decline Reason (optional)
                        </label>
                        <Textarea
                          value={declineReason}
                          onChange={(e: any) =>
                            setDeclineReason(e.target.value)
                          }
                          rows={3}
                          placeholder="e.g. Pricing too high, missing images…"
                          className="w-full text-sm"
                        />
                      </div>
                    )}
                  </>
                );
              })()}
          </div>

          {/* Footer actions */}
          {!loading && sp && (
            <div className="sticky bottom-0 flex gap-3 border-t border-gray-100 bg-white px-5 py-4">
              {!showDeclineForm ? (
                <>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={!!actioning}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {actioning === 'approving' ? (
                      <PiSpinnerBold className="h-4 w-4 animate-spin" />
                    ) : (
                      <PiCheckCircleBold className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeclineForm(true)}
                    disabled={!!actioning}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60"
                  >
                    <PiXCircleBold className="h-4 w-4" />
                    Decline
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={!!actioning}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {actioning === 'declining' ? (
                      <PiSpinnerBold className="h-4 w-4 animate-spin" />
                    ) : (
                      <PiXCircleBold className="h-4 w-4" />
                    )}
                    Confirm Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeclineForm(false)}
                    disabled={!!actioning}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ProductSubProductsPanel({
  productId,
}: {
  productId: string;
}) {
  const { data: session } = useSession();
  const [subProducts, setSubProducts] = useState<SubProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // tracks per-row action: { [subProductId]: 'approving' | 'declining' }
  const [actionLoading, setActionLoading] = useState<Record<string, string>>(
    {}
  );
  const [reviewId, setReviewId] = useState<string | null>(null);

  const fetchSubProducts = useCallback(async () => {
    if (!session?.user?.token || !productId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await subproductService.getSubProductsByProduct(
        productId,
        session.user.token
      );
      const raw =
        res?.data?.subProducts ?? res?.subProducts ?? res?.data ?? res ?? [];
      setSubProducts(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sub-products');
    } finally {
      setIsLoading(false);
    }
  }, [productId, session?.user?.token]);

  useEffect(() => {
    fetchSubProducts();
  }, [fetchSubProducts]);

  const handleApprove = async (id: string, overrides?: PriceOverrides) => {
    if (!session?.user?.token) return;
    setActionLoading((prev) => ({ ...prev, [id]: 'approving' }));
    try {
      await subproductService.adminSetSubProductStatus(
        id,
        'active',
        session.user.token,
        overrides
      );
      setSubProducts((prev) =>
        prev.map((sp) => (sp._id === id ? { ...sp, status: 'active' } : sp))
      );
      toast.success('Sub-product approved — now live on the store');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve sub-product');
    } finally {
      setActionLoading((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  };

  const handleDecline = async (id: string, reason?: string) => {
    if (!session?.user?.token) return;
    setActionLoading((prev) => ({ ...prev, [id]: 'declining' }));
    try {
      await subproductService.adminSetSubProductStatus(
        id,
        'archived',
        session.user.token,
        undefined,
        reason
      );
      setSubProducts((prev) =>
        prev.map((sp) => (sp._id === id ? { ...sp, status: 'archived' } : sp))
      );
      toast.success('Sub-product declined');
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline sub-product');
    } finally {
      setActionLoading((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  };

  const pendingCount = subProducts.filter(
    (sp) => sp.status === 'pending' || sp.status === 'draft'
  ).length;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100">
            <PiStorefront className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Sub-Products
            </h3>
            <p className="text-xs text-gray-500">
              Tenant listings linked to this product
            </p>
          </div>
          {subProducts.length > 0 && (
            <Badge color="primary" variant="flat" className="ml-1 text-xs">
              {subProducts.length} total
            </Badge>
          )}
          {pendingCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <Badge
                color="warning"
                variant="flat"
                className="animate-pulse text-xs"
              >
                {pendingCount} pending review
              </Badge>
            </motion.div>
          )}
        </div>
        <button
          type="button"
          onClick={fetchSubProducts}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-blue-600"
        >
          <motion.span
            animate={isLoading ? { rotate: 360 } : {}}
            transition={{ duration: 0.8, repeat: isLoading ? Infinity : 0 }}
          >
            <PiArrowsClockwiseBold className="h-4 w-4" />
          </motion.span>
          Refresh
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="m-4 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-5">
          <PiWarningBold className="h-5 w-5 flex-shrink-0 text-red-500" />
          <Text className="flex-1 text-sm text-red-700">{error}</Text>
          <button
            type="button"
            onClick={fetchSubProducts}
            className="whitespace-nowrap text-xs font-semibold text-red-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && subProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <PiPackageBold className="h-7 w-7 text-gray-300" />
          </div>
          <Text className="font-medium text-gray-500">No sub-products yet</Text>
          <Text className="mt-1 max-w-xs text-sm text-gray-400">
            No tenant has linked this product to their store yet.
          </Text>
        </div>
      )}

      {/* Review Drawer */}
      <ReviewDrawer
        subProductId={reviewId}
        token={session?.user?.token ?? ''}
        isOpen={!!reviewId}
        onClose={() => setReviewId(null)}
        onApprove={handleApprove}
        onDecline={handleDecline}
      />

      {/* List */}
      {!isLoading && !error && subProducts.length > 0 && (
        <div className="divide-y divide-gray-100">
          <AnimatePresence initial={false}>
            {subProducts.map((sp, i) => {
              const needsReview =
                sp.status === 'pending' || sp.status === 'draft';
              const isActioning = !!actionLoading[sp._id];
              const actionType = actionLoading[sp._id];

              return (
                <motion.div
                  key={sp._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    'flex items-start gap-4 px-6 py-4 transition-colors hover:bg-gray-50/60 sm:items-center',
                    needsReview && 'bg-amber-50/50 hover:bg-amber-50'
                  )}
                >
                  {/* Tenant icon */}
                  <div
                    className={cn(
                      'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border',
                      needsReview
                        ? 'border-amber-200 bg-amber-100'
                        : 'border-blue-100 bg-blue-50'
                    )}
                  >
                    <PiStorefront
                      className={cn(
                        'h-5 w-5',
                        needsReview ? 'text-amber-600' : 'text-blue-500'
                      )}
                    />
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Text className="truncate text-sm font-semibold text-gray-900">
                        {sp.tenant?.name || 'Unknown Tenant'}
                      </Text>
                      <StatusBadge status={sp.status} />
                      {needsReview && (
                        <Badge
                          color="warning"
                          variant="outline"
                          className="text-xs"
                        >
                          Needs Review
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      {sp.sku && (
                        <span className="font-mono text-xs text-gray-400">
                          SKU: {sp.sku}
                        </span>
                      )}
                      {sp.baseSellingPrice != null && (
                        <span className="flex items-center gap-0.5 text-xs font-medium text-gray-600">
                          <PiCurrencyNgnBold className="h-3 w-3" />
                          {sp.baseSellingPrice.toLocaleString()}
                          {sp.currency && sp.currency !== 'NGN' && (
                            <span className="ml-0.5 text-gray-400">
                              {sp.currency}
                            </span>
                          )}
                        </span>
                      )}
                      {sp.availableStock != null && (
                        <span className="flex items-center gap-0.5 text-xs text-gray-400">
                          <PiStackBold className="h-3 w-3" />
                          {sp.availableStock} in stock
                        </span>
                      )}
                      {sp.sizes && sp.sizes.length > 0 && (
                        <span className="text-xs text-gray-400">
                          {sp.sizes.length} size{sp.sizes.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {sp.createdAt && (
                        <span className="flex items-center gap-0.5 text-xs text-gray-400">
                          <PiClockBold className="h-3 w-3" />
                          {new Date(sp.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="ml-auto flex flex-shrink-0 items-center gap-2">
                    {/* Review button — always visible */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setReviewId(sp._id)}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                    >
                      <PiEyeBold className="h-3 w-3" />
                      Review
                    </motion.button>
                    {needsReview ? (
                      <>
                        {/* Approve */}
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleApprove(sp._id)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isActioning && actionType === 'approving' ? (
                            <PiSpinnerBold className="h-4 w-4 animate-spin" />
                          ) : (
                            <PiCheckCircleBold className="h-4 w-4" />
                          )}
                          Approve
                        </motion.button>
                        {/* Decline */}
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleDecline(sp._id)}
                          disabled={isActioning}
                          className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isActioning && actionType === 'declining' ? (
                            <PiSpinnerBold className="h-4 w-4 animate-spin" />
                          ) : (
                            <PiXCircleBold className="h-4 w-4" />
                          )}
                          Decline
                        </motion.button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        {sp.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleDecline(sp._id)}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            {isActioning ? (
                              <PiSpinnerBold className="h-3 w-3 animate-spin" />
                            ) : (
                              <PiXCircleBold className="h-3 w-3" />
                            )}
                            Deactivate
                          </button>
                        )}
                        {sp.status === 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(sp._id)}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-green-200 hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
                          >
                            {isActioning ? (
                              <PiSpinnerBold className="h-3 w-3 animate-spin" />
                            ) : (
                              <PiCheckCircleBold className="h-3 w-3" />
                            )}
                            Reactivate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
