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

const STATUS_MAP: Record<string, { label: string; color: 'success' | 'warning' | 'danger' | 'secondary' | 'primary' }> = {
  active:        { label: 'Active',        color: 'success' },
  pending:       { label: 'Pending',       color: 'warning' },
  draft:         { label: 'Draft',         color: 'secondary' },
  archived:      { label: 'Declined',      color: 'danger' },
  discontinued:  { label: 'Discontinued',  color: 'danger' },
  hidden:        { label: 'Hidden',        color: 'secondary' },
  low_stock:     { label: 'Low Stock',     color: 'warning' },
  out_of_stock:  { label: 'Out of Stock',  color: 'danger' },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, color: 'secondary' };
  return (
    <Badge color={info.color} variant="flat" className="text-xs font-semibold capitalize">
      {info.label}
    </Badge>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-gray-200 rounded-lg" />
        <div className="h-8 w-20 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value == null || value === '' || value === false) return null;
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0 w-36">{label}</span>
      <span className={cn('text-xs text-gray-900 text-right', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
      </div>
      <div className="bg-gray-50 rounded-xl px-4 py-1">
        {children}
      </div>
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
  const [actioning, setActioning] = useState<'approving' | 'declining' | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [sizeWebsitePrices, setSizeWebsitePrices] = useState<Record<string, string>>({});
  const [baseWebsitePrice, setBaseWebsitePrice] = useState<string>('');
  // Server-computed platform prices — used to detect which inputs the admin
  // actually changed, so unchanged values are never sent as overrides
  const [serverDefaults, setServerDefaults] = useState<{ base: number; sizes: Record<string, number> }>({ base: 0, sizes: {} });
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState(0);

  const fmt = (v?: number | null) =>
    v != null ? `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : null;

  // Keyboard shortcut to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showApproveConfirm && !showDeclineConfirm) {
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

    subproductService.getSubProduct(subProductId, token)
      .then((res: any) => {
        const data = res?.data?.subProduct ?? res?.subProduct ?? res?.data ?? res;
        setSp(data);
        if (!data) return;

        const defaults: { base: number; sizes: Record<string, number> } = { base: 0, sizes: {} };

        if (data.pricing?.platformSellingPrice > 0) {
          defaults.base = data.pricing.platformSellingPrice;
          setBaseWebsitePrice(String(data.pricing.platformSellingPrice));
        }

        const initSizes: Record<string, string> = {};
        for (const s of (data.sizes ?? [])) {
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
      .filter(e => changed(e.websitePrice, serverDefaults.sizes[e.id]));
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
      <div
        className="fixed inset-0 bg-black/40 z-[9998]"
        onClick={onClose}
      />
      {/* Panel — stopPropagation keeps all internal clicks from hitting the overlay */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-white z-[9999] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <PiShoppingBagBold className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-gray-900 text-sm">Review Sub-Product</span>
          </div>
          <ActionIcon size="sm" variant="text" onClick={onClose}>
            <PiXBold className="w-4 h-4" />
          </ActionIcon>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <PiSpinnerBold className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          )}

          {!loading && !sp && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <PiWarningBold className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Failed to load sub-product details</p>
            </div>
          )}

          {!loading && sp && (() => {
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
            const tenantReceives = pricing.tenantReceives || supplierCostBase;
            const hasProductDiscount = pricing.productDiscount?.active || false;
            const tenantStorePrice = pricing.tenantDiscount?.discountedPrice || null;

            return (
              <>
                {/* Status + Meta */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                  <StatusBadge status={sp.status} />
                  <span className="text-[10px] text-gray-400 font-mono">{sp.sku || 'No SKU'}</span>
                </div>

                {/* Tenant */}
                <Section title="Tenant" icon={PiUserBold}>
                  <InfoRow label="Store" value={(sp as any).tenant?.name || (sp as any).tenant?.businessName} />
                  <InfoRow label="Tenant Price" value={<span className="text-orange-600 font-semibold">{tenantSellingBase > 0 ? fmt(tenantSellingBase) : '—'}</span>} />
                  <InfoRow label="Revenue Model" value={
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase',
                      revenueModel === 'commission' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    )}>{revenueModel}</span>
                  } />
                  {revenueModel === 'markup'
                    ? <InfoRow label="Markup %" value={`${markupPct}%`} />
                    : <InfoRow label="Commission %" value={`${commissionPct}%`} />
                  }
                </Section>

                {/* Pricing Chain - Platform Pricing Pipeline */}
                {(() => {
                  const currentBaseVal = baseWebsitePrice;
                  const defaultWebsite = platformSellingBase;

                  return (
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-3">
                        <PiCurrencyNgnBold className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform Pricing</span>
                        <span className={cn(
                          'ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase',
                          revenueModel === 'commission' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                        )}>
                          {revenueModel}
                        </span>
                      </div>

                      {revenueModel === 'markup' ? (
                        // Markup pipeline: Supplier Cost → ×(1+markup%) → Platform Cost → ×(1+platformMarkup%) → Platform Selling
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-1 text-[10px]">
                            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-2 text-center">
                              <div className="text-gray-500 mb-0.5 text-[9px]">Supplier Cost</div>
                              <div className="font-bold text-gray-700">{supplierCostBase > 0 ? fmt(supplierCostBase) : '—'}</div>
                            </div>
                            <div className="text-gray-400 text-center flex-shrink-0 px-0.5">
                              ×(1+{markupPct}%)
                            </div>
                            <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg px-1.5 py-2 text-center">
                              <div className="text-blue-500 mb-0.5 text-[9px]">Platform Cost</div>
                              <div className="font-bold text-blue-700">{platformCostBase > 0 ? fmt(platformCostBase) : '—'}</div>
                            </div>
                            <div className="text-gray-400 text-center flex-shrink-0 px-0.5">
                              ×(1+{platformMarkupPct}%)
                            </div>
                            <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-lg px-1.5 py-2 text-center">
                              <div className="text-indigo-500 mb-0.5 text-[9px]">
                                Platform Selling
                              </div>
                              <div className="font-bold text-indigo-700">{platformSellingBase > 0 ? fmt(platformSellingBase) : '—'}</div>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 text-center">
                            platformCost = supplierCost × (1+{markupPct}%) · platformSelling = platformCost × (1+{platformMarkupPct}%) · margin = selling − cost
                          </p>
                          {tenantStorePrice != null && tenantStorePrice < tenantSellingBase && (
                            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-[10px]">
                              <div className="text-orange-600 font-medium">Tenant Store Price (with tenant discount): {fmt(tenantStorePrice)}</div>
                              <div className="text-orange-400 text-[9px]">Tenant discount is for tenant store only — does not affect platform pricing</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Commission pipeline: Tenant Selling Price → Platform Cost Price → Platform Selling Price → Final Platform Price
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-1 text-[10px]">
                            <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg px-1.5 py-2 text-center">
                              <div className="text-orange-500 mb-0.5 text-[9px] flex items-center justify-center gap-0.5">
                                <PiStorefront className="w-2.5 h-2.5" /> Tenant Price
                              </div>
                              <div className="font-bold text-orange-700">{tenantSellingBase > 0 ? fmt(tenantSellingBase) : '—'}</div>
                            </div>
                            <div className="text-gray-400 text-center flex-shrink-0 px-0.5">
                              ×(1−{commissionPct}%)
                            </div>
                            <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg px-1.5 py-2 text-center">
                              <div className="text-blue-500 mb-0.5 text-[9px]">Platform Cost</div>
                              <div className="font-bold text-blue-700">{platformCostBase > 0 ? fmt(platformCostBase) : '—'}</div>
                            </div>
                            <div className="text-gray-400 text-center flex-shrink-0 px-0.5">
                              ×(1+{platformMarkupPct}%)
                            </div>
                            <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-lg px-1.5 py-2 text-center">
                              <div className="text-indigo-500 mb-0.5 text-[9px]">
                                Platform Selling
                              </div>
                              <div className="font-bold text-indigo-700">{platformSellingBase > 0 ? fmt(platformSellingBase) : '—'}</div>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 text-center">
                            platformCost = tenantPrice × (1−{commissionPct}%) · platformSelling = platformCost × (1+{platformMarkupPct}%) · margin = selling − cost
                          </p>
                          {tenantStorePrice != null && tenantStorePrice < tenantSellingBase && (
                            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-[10px]">
                              <div className="text-orange-600 font-medium">Tenant Store Price (with tenant discount): {fmt(tenantStorePrice)}</div>
                              <div className="text-orange-400 text-[9px]">Tenant discount is for tenant store only — does not affect platform pricing</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Editable base website price */}
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-green-700">Final Platform Price (editable)</span>
                          {defaultWebsite > 0 && parseFloat(currentBaseVal) !== defaultWebsite && (
                            <button type="button" onClick={() => setBaseWebsitePrice(String(defaultWebsite))}
                              className="text-[10px] text-green-600 underline">
                              Reset to {fmt(defaultWebsite)}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-green-700">₦</span>
                          <input type="number" min="0" step="50" value={currentBaseVal}
                            onChange={e => setBaseWebsitePrice(e.target.value)}
                            className="flex-1 text-sm font-bold text-green-900 bg-white border border-green-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300" />
                        </div>
                      </div>

                      {/* Summary strip - Platform Margin (live: follows the editable price) */}
                      {(() => {
                        const entered = parseFloat(currentBaseVal);
                        const liveMargin =
                          !isNaN(entered) && entered > 0 && platformCostBase > 0
                            ? parseFloat((entered - platformCostBase).toFixed(2))
                            : platformMargin;
                        return (
                          <div className="mt-3 space-y-2">
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div className="bg-orange-50 rounded-lg px-3 py-2 text-center border border-orange-100">
                                <div className="text-orange-500 mb-0.5">Tenant Price</div>
                                <div className="font-bold text-orange-700">{tenantSellingBase > 0 ? fmt(tenantSellingBase) : '—'}</div>
                              </div>
                              <div className="bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100">
                                <div className="text-gray-400 mb-0.5">Supplier Cost</div>
                                <div className="font-bold text-gray-700">{supplierCostBase > 0 ? fmt(supplierCostBase) : '—'}</div>
                              </div>
                              <div className="bg-blue-50 rounded-lg px-3 py-2 text-center border border-blue-100">
                                <div className="text-blue-500 mb-0.5">Platform Margin</div>
                                <div className={cn('font-bold', liveMargin != null && liveMargin > 0 ? 'text-blue-700' : 'text-red-500')}>
                                  {liveMargin != null ? fmt(liveMargin) : '—'}
                                </div>
                              </div>
                            </div>
                            {revenueModel === 'commission' && (
                              <div className="bg-purple-50 rounded-lg px-3 py-2 text-center border border-purple-100">
                                <div className="text-purple-500 mb-0.5 text-[10px]">Tenant Receives (after {commissionPct}% commission)</div>
                                <div className="font-bold text-purple-700">{tenantReceives != null ? fmt(tenantReceives) : '—'}</div>
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
                  <InfoRow label="Product" value={(sp as any).product?.name} />
                  <InfoRow label="Category" value={(sp as any).product?.category?.name} />
                  <InfoRow label="Brand" value={(sp as any).product?.brand?.name} />
                  <InfoRow label="ABV" value={(sp as any).product?.abv != null ? `${(sp as any).product.abv}%` : null} />
                  <InfoRow label="Volume" value={(sp as any).product?.volumeMl != null ? `${(sp as any).product.volumeMl}ml` : null} />
                  <InfoRow label="Origin" value={(sp as any).product?.originCountry} />
                </Section>

                {/* Sale */}
                {sp.isOnSale && (
                  <>
                    <InfoRow label="Sale Price" value={fmt(sp.salePrice)} />
                    <InfoRow label="Sale Discount" value={sp.saleDiscountPercentage != null ? `${sp.saleDiscountPercentage}%` : null} />
                    <InfoRow label="Sale Start" value={sp.saleStartDate ? new Date(sp.saleStartDate).toLocaleDateString('en-GB') : null} />
                    <InfoRow label="Sale End" value={sp.saleEndDate ? new Date(sp.saleEndDate).toLocaleDateString('en-GB') : null} />
                  </>
                )}

                {/* Inventory */}
                <Section title="Inventory" icon={PiStackBold}>
                  <InfoRow label="Total Stock" value={sp.totalStock != null ? sp.totalStock.toString() : null} />
                  <InfoRow label="Available" value={sp.availableStock != null ? sp.availableStock.toString() : null} />
                  <InfoRow label="Reserved" value={sp.reservedStock != null ? sp.reservedStock.toString() : null} />
                  <InfoRow label="Low Stock Alert" value={sp.lowStockThreshold != null ? `≤ ${sp.lowStockThreshold} units` : null} />
                </Section>

                {/* Size Variants */}
                {sp.sizes && sp.sizes.length > 0 && (() => {
                  // Product-level discount for platform pricing
                  const productDiscount = (sp as any).product?.platformDiscount?.value > 0 && (sp as any).product?.platformDiscount?.type
                    ? { value: (sp as any).product.platformDiscount.value, type: (sp as any).product.platformDiscount.type, start: (sp as any).product.platformDiscount.start, end: (sp as any).product.platformDiscount.end }
                    : null;

                  return (
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <PiRulerBold className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Size Variants ({sp.sizes.length})
                          </span>
                        </div>
                        <span className="text-[10px] text-green-600 font-medium">Website ₦ is editable</span>
                      </div>

                      <div className="space-y-2">
                        {sp.sizes.map((s: any) => {
                          const sizeId = s._id;
                          // Use server-provided size pricing
                          const sizePricing = s.pricing || {};
                          const sizeSupplierCost = sizePricing.costPrice || 0;
                          const sizeSellingPrice = sizePricing.tenantSellingPrice || 0;
                          const sizePlatformCost = sizePricing.platformCostPrice || 0;
                          const sizePlatformSelling = sizePricing.platformSellingPrice || 0;
                          const sizePlatformMargin = sizePricing.platformMargin || 0;
                          const sizeHasDiscount = sizePricing.productDiscount?.active || false;
                          const sizeTenantStorePrice = sizePricing.tenantDiscount?.discountedPrice || null;

                          const defaultWebsite = sizePlatformSelling;
                          const currentVal = sizeWebsitePrices[sizeId] ?? '';
                          // Margin follows the editable price live
                          const enteredSize = parseFloat(currentVal);
                          const liveSizeMargin =
                            !isNaN(enteredSize) && enteredSize > 0 && sizePlatformCost > 0
                              ? parseFloat((enteredSize - sizePlatformCost).toFixed(2))
                              : sizePlatformMargin;

                          return (
                            <div key={sizeId} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-900">{s.size || s.displayName || '-'}</span>
                                <span className="text-[10px] text-gray-400">{s.stock ?? 0} in stock</span>
                              </div>

                              {revenueModel === 'markup' ? (
                                // Markup pipeline: Tenant Price → Supplier Cost → Platform Cost → Platform Selling (includes discount)
                                <div className="space-y-1.5 mb-2">
                                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                    <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center border border-gray-200">
                                      <div className="text-gray-500 mb-0.5">Supplier Cost</div>
                                      <div className="font-bold text-gray-700">
                                        {sizeSupplierCost > 0 ? `₦${sizeSupplierCost.toLocaleString()}` : '—'}
                                      </div>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg px-2 py-1.5 text-center border border-blue-100">
                                      <div className="text-blue-500 mb-0.5">Platform Cost</div>
                                      <div className="font-bold text-blue-700">
                                        {sizePlatformCost > 0 ? `₦${sizePlatformCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px]">
                                    <div className="flex-1 bg-indigo-50 rounded-lg px-2 py-1.5 text-center border border-indigo-100">
                                      <div className="text-indigo-500 mb-0.5">
                                        Platform Selling
                                        {sizeHasDiscount && <span className="text-green-600 ml-1">(after discount)</span>}
                                      </div>
                                      <div className="font-bold text-indigo-700">
                                        {sizePlatformSelling > 0 ? `₦${sizePlatformSelling.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                // Commission pipeline: Tenant Selling Price → Platform Cost → Platform Selling (includes discount)
                                <div className="space-y-1.5 mb-2">
                                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                    <div className="bg-orange-50 rounded-lg px-2 py-1.5 text-center border border-orange-100">
                                      <div className="text-orange-500 mb-0.5 flex items-center justify-center gap-0.5">
                                        <PiStorefront className="w-2.5 h-2.5" /> Tenant Price
                                      </div>
                                      <div className="font-bold text-orange-700">
                                        {sizeSellingPrice > 0 ? `₦${sizeSellingPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                                      </div>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg px-2 py-1.5 text-center border border-blue-100">
                                      <div className="text-blue-500 mb-0.5">Platform Cost</div>
                                      <div className="font-bold text-blue-700">
                                        {sizePlatformCost > 0 ? `₦${sizePlatformCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px]">
                                    <div className="flex-1 bg-indigo-50 rounded-lg px-2 py-1.5 text-center border border-indigo-100">
                                      <div className="text-indigo-500 mb-0.5">
                                        Platform Selling
                                        {sizeHasDiscount && <span className="text-green-600 ml-1">(after discount)</span>}
                                      </div>
                                      <div className="font-bold text-indigo-700">
                                        {sizePlatformSelling > 0 ? `₦${sizePlatformSelling.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-[10px] text-green-700 font-semibold">Final Platform Price (editable)</div>
                                  {defaultWebsite > 0 && parseFloat(currentVal) !== defaultWebsite && (
                                    <button type="button"
                                      onClick={() => setSizeWebsitePrices(prev => ({ ...prev, [sizeId]: String(defaultWebsite) }))}
                                      className="text-[10px] text-green-600 underline">
                                      Reset to ₦{defaultWebsite.toLocaleString()}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-green-700">₦</span>
                                  <input type="number" min="0" step="50" value={currentVal}
                                    onChange={e => setSizeWebsitePrices(prev => ({ ...prev, [sizeId]: e.target.value }))}
                                    className="flex-1 text-sm font-bold text-green-900 bg-white border border-green-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-300" />
                                  {liveSizeMargin != null && (
                                    <span className={cn(
                                      'text-[10px] whitespace-nowrap font-medium',
                                      liveSizeMargin > 0 ? 'text-blue-600' : 'text-red-500'
                                    )}>
                                      Margin: {liveSizeMargin > 0 ? '+' : ''}₦{liveSizeMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-2 px-1 text-[10px] text-gray-400">
                        {revenueModel === 'commission'
                          ? <span>platformCost = tenantPrice × (1−{commissionPct}%) · platformSelling = platformCost × (1+{platformMarkupPct}%) · margin = selling − cost</span>
                          : <span>platformCost = supplierCost × (1+{markupPct}%) · platformSelling = platformCost × (1+{platformMarkupPct}%) · margin = selling − cost</span>
                        }
                      </div>
                    </div>
                  );
                })()}

                {/* Description Overrides */}
                {(sp.shortDescriptionOverride || sp.descriptionOverride) && (
                  <Section title="Description Override" icon={PiNoteBold}>
                    {sp.shortDescriptionOverride && (
                      <div className="py-2">
                        <p className="text-xs text-gray-500 mb-1">Short Description</p>
                        <p className="text-xs text-gray-800 leading-relaxed">{sp.shortDescriptionOverride}</p>
                      </div>
                    )}
                    {sp.descriptionOverride && (
                      <div className="py-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Full Description</p>
                        <p className="text-xs text-gray-800 leading-relaxed line-clamp-6">{sp.descriptionOverride}</p>
                      </div>
                    )}
                  </Section>
                )}

                {/* Images */}
                {sp.imagesOverride && sp.imagesOverride.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <PiImageBold className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Image Overrides ({sp.imagesOverride.length})
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {sp.imagesOverride.slice(0, 6).map((img: any, i: number) => (
                        <div key={i} className="relative">
                          <img src={img.url} alt={img.alt || `Image ${i + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }} />
                          {img.isPrimary && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <PiCheckCircleBold className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shipping */}
                {sp.shipping && Object.values(sp.shipping).some(v => v != null && v !== false) && (
                  <Section title="Shipping" icon={PiTruckBold}>
                    <InfoRow label="Weight" value={sp.shipping.weight != null ? `${sp.shipping.weight} kg` : null} />
                    <InfoRow label="Dimensions" value={
                      sp.shipping.length && sp.shipping.width && sp.shipping.height
                        ? `${sp.shipping.length} × ${sp.shipping.width} × ${sp.shipping.height} cm`
                        : null
                    } />
                    <InfoRow label="Shipping Class" value={sp.shipping.shippingClass} />
                    <InfoRow label="Fragile" value={sp.shipping.fragile ? 'Yes' : null} />
                    <InfoRow label="Age Verification" value={sp.shipping.requiresAgeVerification ? 'Required' : null} />
                    <InfoRow label="Hazmat" value={sp.shipping.hazmat ? 'Yes' : null} />
                  </Section>
                )}

                {/* Flags */}
                <Section title="Flags" icon={PiCheckSquareBold}>
                  <InfoRow label="Featured" value={sp.isFeaturedByTenant ? 'Yes' : null} />
                  <InfoRow label="New Arrival" value={sp.isNewArrival ? 'Yes' : null} />
                  <InfoRow label="Best Seller" value={sp.isBestSeller ? 'Yes' : null} />
                </Section>

                {/* Decline form */}
                {showDeclineForm && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Decline Reason (optional)</label>
                    <Textarea
                      value={declineReason}
                      onChange={(e: any) => setDeclineReason(e.target.value)}
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
          <div className="sticky bottom-0 border-t border-gray-100 bg-white px-5 py-4 flex gap-3">
            {!showDeclineForm ? (
              <>
                <button type="button" onClick={handleApprove} disabled={!!actioning}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl py-2.5 disabled:opacity-60">
                  {actioning === 'approving' ? <PiSpinnerBold className="w-4 h-4 animate-spin" /> : <PiCheckCircleBold className="w-4 h-4" />}
                  Approve
                </button>
                <button type="button" onClick={() => setShowDeclineForm(true)} disabled={!!actioning}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl py-2.5 border border-red-200 disabled:opacity-60">
                  <PiXCircleBold className="w-4 h-4" />
                  Decline
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={handleDecline} disabled={!!actioning}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl py-2.5 disabled:opacity-60">
                  {actioning === 'declining' ? <PiSpinnerBold className="w-4 h-4 animate-spin" /> : <PiXCircleBold className="w-4 h-4" />}
                  Confirm Decline
                </button>
                <button type="button" onClick={() => setShowDeclineForm(false)} disabled={!!actioning}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl py-2.5 disabled:opacity-60">
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

export default function ProductSubProductsPanel({ productId }: { productId: string }) {
  const { data: session } = useSession();
  const [subProducts, setSubProducts] = useState<SubProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // tracks per-row action: { [subProductId]: 'approving' | 'declining' }
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [reviewId, setReviewId] = useState<string | null>(null);

  const fetchSubProducts = useCallback(async () => {
    if (!session?.user?.token || !productId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await subproductService.getSubProductsByProduct(productId, session.user.token);
      const raw = res?.data?.subProducts ?? res?.subProducts ?? res?.data ?? res ?? [];
      setSubProducts(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sub-products');
    } finally {
      setIsLoading(false);
    }
  }, [productId, session?.user?.token]);

  useEffect(() => { fetchSubProducts(); }, [fetchSubProducts]);

  const handleApprove = async (id: string, overrides?: PriceOverrides) => {
    if (!session?.user?.token) return;
    setActionLoading(prev => ({ ...prev, [id]: 'approving' }));
    try {
      await subproductService.adminSetSubProductStatus(id, 'active', session.user.token, overrides);
      setSubProducts(prev => prev.map(sp => sp._id === id ? { ...sp, status: 'active' } : sp));
      toast.success('Sub-product approved — now live on the store');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve sub-product');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const handleDecline = async (id: string, reason?: string) => {
    if (!session?.user?.token) return;
    setActionLoading(prev => ({ ...prev, [id]: 'declining' }));
    try {
      await subproductService.adminSetSubProductStatus(id, 'archived', session.user.token, undefined, reason);
      setSubProducts(prev => prev.map(sp => sp._id === id ? { ...sp, status: 'archived' } : sp));
      toast.success('Sub-product declined');
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline sub-product');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const pendingCount = subProducts.filter(sp => sp.status === 'pending' || sp.status === 'draft').length;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <PiStorefront className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Sub-Products</h3>
            <p className="text-xs text-gray-500">Tenant listings linked to this product</p>
          </div>
          {subProducts.length > 0 && (
            <Badge color="primary" variant="flat" className="text-xs ml-1">
              {subProducts.length} total
            </Badge>
          )}
          {pendingCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <Badge color="warning" variant="flat" className="text-xs animate-pulse">
                {pendingCount} pending review
              </Badge>
            </motion.div>
          )}
        </div>
        <button
          type="button"
          onClick={fetchSubProducts}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <motion.span animate={isLoading ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: isLoading ? Infinity : 0 }}>
            <PiArrowsClockwiseBold className="w-4 h-4" />
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
        <div className="flex items-center gap-3 p-5 m-4 bg-red-50 rounded-xl border border-red-100">
          <PiWarningBold className="w-5 h-5 text-red-500 flex-shrink-0" />
          <Text className="text-sm text-red-700 flex-1">{error}</Text>
          <button
            type="button"
            onClick={fetchSubProducts}
            className="text-xs text-red-600 font-semibold hover:underline whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && subProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <PiPackageBold className="w-7 h-7 text-gray-300" />
          </div>
          <Text className="font-medium text-gray-500">No sub-products yet</Text>
          <Text className="text-sm text-gray-400 mt-1 max-w-xs">
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
              const needsReview = sp.status === 'pending' || sp.status === 'draft';
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
                    'flex items-start sm:items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors',
                    needsReview && 'bg-amber-50/50 hover:bg-amber-50'
                  )}
                >
                  {/* Tenant icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border',
                    needsReview
                      ? 'bg-amber-100 border-amber-200'
                      : 'bg-blue-50 border-blue-100'
                  )}>
                    <PiStorefront className={cn('w-5 h-5', needsReview ? 'text-amber-600' : 'text-blue-500')} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Text className="font-semibold text-gray-900 text-sm truncate">
                        {sp.tenant?.name || 'Unknown Tenant'}
                      </Text>
                      <StatusBadge status={sp.status} />
                      {needsReview && (
                        <Badge color="warning" variant="outline" className="text-xs">
                          Needs Review
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {sp.sku && (
                        <span className="text-xs text-gray-400 font-mono">SKU: {sp.sku}</span>
                      )}
                      {sp.baseSellingPrice != null && (
                        <span className="text-xs text-gray-600 font-medium flex items-center gap-0.5">
                          <PiCurrencyNgnBold className="w-3 h-3" />
                          {sp.baseSellingPrice.toLocaleString()}
                          {sp.currency && sp.currency !== 'NGN' && (
                            <span className="ml-0.5 text-gray-400">{sp.currency}</span>
                          )}
                        </span>
                      )}
                      {sp.availableStock != null && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <PiStackBold className="w-3 h-3" />
                          {sp.availableStock} in stock
                        </span>
                      )}
                      {sp.sizes && sp.sizes.length > 0 && (
                        <span className="text-xs text-gray-400">
                          {sp.sizes.length} size{sp.sizes.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {sp.createdAt && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <PiClockBold className="w-3 h-3" />
                          {new Date(sp.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    {/* Review button — always visible */}
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setReviewId(sp._id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <PiEyeBold className="w-3 h-3" />
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                          {isActioning && actionType === 'approving' ? (
                            <PiSpinnerBold className="w-4 h-4 animate-spin" />
                          ) : (
                            <PiCheckCircleBold className="w-4 h-4" />
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isActioning && actionType === 'declining' ? (
                            <PiSpinnerBold className="w-4 h-4 animate-spin" />
                          ) : (
                            <PiXCircleBold className="w-4 h-4" />
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
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {isActioning ? <PiSpinnerBold className="w-3 h-3 animate-spin" /> : <PiXCircleBold className="w-3 h-3" />}
                            Deactivate
                          </button>
                        )}
                        {sp.status === 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(sp._id)}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:text-green-600 hover:border-green-200 hover:bg-green-50 disabled:opacity-50 transition-colors"
                          >
                            {isActioning ? <PiSpinnerBold className="w-3 h-3 animate-spin" /> : <PiCheckCircleBold className="w-3 h-3" />}
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
