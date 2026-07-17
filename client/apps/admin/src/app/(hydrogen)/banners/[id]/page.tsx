// @ts-nocheck
'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import { bannerService } from '@/services/banner.service';
import { Button, Text } from 'rizzui';
import {
  PiPencilLineBold,
  PiTrashBold,
  PiPlayBold,
  PiPauseBold,
  PiArrowsClockwiseBold,
  PiEyeBold,
  PiMouseBold,
  PiCursorBold,
  PiCalendarBold,
  PiDeviceMobileBold,
  PiTagBold,
  PiArrowUpBold,
  PiArrowRightBold,
  PiClockBold,
  PiCopyBold,
  PiImageBold,
  PiSparkleBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  BANNER_TYPE_OPTIONS,
  BANNER_PLACEMENT_OPTIONS,
  BANNER_CTA_STYLE_OPTIONS,
} from '@/types/banner.types';
import {
  BannerPreview,
  PlacementThumb,
  PLACEMENT_PREVIEW,
} from '@/app/shared/ecommerce/banner/create-edit';

// ─── Priority badge (matches list table colors) ──────────────────────────────

const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string; ring: string }
> = {
  low: {
    label: 'Low',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
    ring: 'ring-gray-200',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
  },
  high: {
    label: 'High',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    ring: 'ring-orange-200',
  },
  urgent: {
    label: 'Urgent',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    ring: 'ring-red-200',
  },
};

function PriorityBadge({
  priority,
  size = 'md',
}: {
  priority?: string;
  size?: 'sm' | 'md';
}) {
  if (!priority) return <span className="text-sm text-gray-400">—</span>;
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.low;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring} ${pad}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  draft: {
    label: 'Draft',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  },
  scheduled: {
    label: 'Scheduled',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  active: {
    label: 'Active',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  paused: {
    label: 'Paused',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
  },
  expired: {
    label: 'Expired',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text} ring-current/10 ring-1`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent || 'bg-gray-50 text-gray-500'}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {label}
          </p>
          <p className="text-xl font-black tabular-nums text-gray-900">
            {value}
          </p>
        </div>
      </div>
      {sub && <p className="mt-1.5 text-xs text-gray-400">{sub}</p>}
    </motion.div>
  );
}

// ─── Content-position → grid classes ─────────────────────────────────────────

const POSITION_GRID: Record<string, string> = {
  'top-left': 'items-start justify-start text-left',
  'top-center': 'items-start justify-center text-center',
  'top-right': 'items-start justify-end text-right',
  'center-left': 'items-center justify-start text-left',
  center: 'items-center justify-center text-center',
  'center-right': 'items-center justify-end text-right',
  'bottom-left': 'items-end justify-start text-left',
  'bottom-center': 'items-end justify-center text-center',
  'bottom-right': 'items-end justify-end text-right',
};

// 3×3 grid positions for the visual indicator
const POSITION_CELLS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

function PositionGridIndicator({ position }: { position?: string }) {
  const active = position || 'center';
  return (
    <div className="grid w-20 grid-cols-3 gap-1">
      {POSITION_CELLS.map((pos) => (
        <div
          key={pos}
          className={`h-5 rounded-sm transition ${
            pos === active
              ? 'bg-orange-500 ring-2 ring-orange-300 ring-offset-1'
              : 'bg-gray-100'
          }`}
        />
      ))}
    </div>
  );
}

// ─── CTA style → button classes ──────────────────────────────────────────────

const CTA_STYLE_CLS: Record<string, string> = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600',
  secondary: 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-300',
  outline: 'bg-transparent text-white border-2 border-white hover:bg-white/10',
  text: 'text-white underline underline-offset-4 hover:decoration-2',
  custom: 'bg-gray-900 text-white hover:bg-gray-800',
};

// ─── Info row helper ─────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  badge,
}: {
  label: string;
  value?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="flex items-center gap-2 truncate text-sm font-medium text-gray-900">
        {badge || value || '—'}
      </dd>
    </div>
  );
}

// ─── Card wrapper ────────────────────────────────────────────────────────────

function Card({
  icon,
  title,
  children,
  className = '',
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200/70 bg-white shadow-sm ${className}`}
    >
      <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BannerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession() as any;
  const token = session?.token || session?.user?.token || '';
  const router = useRouter();

  const [banner, setBanner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && id) fetchBanner();
  }, [token, id]);

  const fetchBanner = async () => {
    try {
      const res = await bannerService.getBannerById(id, token);
      setBanner(res.data?.banner || res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load banner');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this banner? This cannot be undone.')) return;
    try {
      await bannerService.deleteBanner(id, token);
      toast.success('Banner deleted');
      router.push(routes.eCommerce.banners);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await bannerService.updateBannerStatus(id, status, token);
      toast.success(`Banner ${status}`);
      fetchBanner();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleClone = async () => {
    try {
      const res = await bannerService.cloneBanner(id, token);
      toast.success('Banner cloned');
      router.push(
        routes.eCommerce.editBanner(res.data?.banner?._id || res.data?._id)
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to clone');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-orange-500" />
      </div>
    );
  }

  if (!banner) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <Text className="mb-2 text-lg font-semibold text-gray-900">
          Banner not found
        </Text>
        <Link href={routes.eCommerce.banners}>
          <Button variant="outline">Back to Banners</Button>
        </Link>
      </div>
    );
  }

  const isActive = banner.status === 'active';
  const isPaused = banner.status === 'paused';
  const posCls = POSITION_GRID[banner.contentPosition] || POSITION_GRID.center;
  const ctaCls = CTA_STYLE_CLS[banner.ctaStyle] || CTA_STYLE_CLS.primary;
  const typeLabel =
    BANNER_TYPE_OPTIONS.find((t) => t.value === banner.type)?.label ||
    banner.type;
  const placementLabel =
    BANNER_PLACEMENT_OPTIONS.find((p) => p.value === banner.placement)?.label ||
    banner.placement;
  const ctaStyleLabel =
    BANNER_CTA_STYLE_OPTIONS.find((c) => c.value === banner.ctaStyle)?.label ||
    banner.ctaStyle;

  return (
    <>
      <PageHeader
        title={banner.title || 'Banner Details'}
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
          { href: routes.eCommerce.banners, name: 'Banners' },
          { name: banner.title || id },
        ]}
      >
        <div className="mt-4 flex flex-wrap items-center gap-2 @lg:mt-0">
          <PriorityBadge priority={banner.priority} />
          {(isActive || isPaused) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange(isActive ? 'paused' : 'active')}
            >
              {isActive ? (
                <>
                  <PiPauseBold className="mr-1.5 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <PiPlayBold className="mr-1.5 h-4 w-4" />
                  Activate
                </>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleClone}>
            <PiCopyBold className="mr-1.5 h-4 w-4" />
            Clone
          </Button>
          <Link href={routes.eCommerce.editBanner(id)}>
            <Button variant="outline" size="sm">
              <PiPencilLineBold className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handleDelete}
            className="border-0 bg-red-500 text-white hover:bg-red-600"
          >
            <PiTrashBold className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-5">
        {/* ─── Live Preview — placement-accurate render ─────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={banner.status} />
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {typeLabel}
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white">
                {placementLabel}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {PLACEMENT_PREVIEW[banner.placement]?.label ||
                'Live preview as rendered on the storefront'}
            </p>
          </div>
          <BannerPreview formData={banner} />
        </div>

        {/* ─── Analytics ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={<PiEyeBold className="h-5 w-5" />}
            label="Impressions"
            value={(banner.impressions || 0).toLocaleString()}
            accent="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={<PiMouseBold className="h-5 w-5" />}
            label="Clicks"
            value={(banner.clicks || 0).toLocaleString()}
            accent="bg-purple-50 text-purple-600"
          />
          <StatCard
            icon={<PiCursorBold className="h-5 w-5" />}
            label="CTR"
            value={`${(banner.clickThroughRate || 0).toFixed(2)}%`}
            sub={`${banner.clicks || 0} of ${banner.impressions || 0} impressions`}
            accent="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            icon={<PiArrowsClockwiseBold className="h-5 w-5" />}
            label="Conversions"
            value={banner.conversionCount || 0}
            sub={`${(banner.conversionRate || 0).toFixed(2)}% rate`}
            accent="bg-orange-50 text-orange-600"
          />
        </div>

        {/* ─── Two-column layout ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left — main details */}
          <div className="space-y-5 lg:col-span-2">
            <Card
              icon={
                <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                  <PiTagBold className="h-4 w-4" />
                </span>
              }
              title="Banner Details"
            >
              <dl>
                <InfoRow
                  label="Type"
                  badge={<span className="capitalize">{typeLabel}</span>}
                />
                <InfoRow
                  label="Placement"
                  badge={<span className="capitalize">{placementLabel}</span>}
                />
                <InfoRow
                  label="Priority"
                  badge={<PriorityBadge priority={banner.priority} size="sm" />}
                />
                <InfoRow
                  label="Display Order"
                  value={String(banner.displayOrder ?? 0)}
                />
                <InfoRow
                  label="Visible To"
                  value={
                    banner.visibleTo
                      ? String(banner.visibleTo).replace(/_/g, ' ')
                      : 'All'
                  }
                />
                <InfoRow
                  label="Global"
                  badge={
                    banner.isGlobal ? (
                      <span className="text-emerald-600">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )
                  }
                />
              </dl>
              {/* Where this banner renders on the storefront */}
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="w-24 flex-shrink-0">
                  <PlacementThumb placement={banner.placement} selected />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700">
                    {placementLabel}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {PLACEMENT_PREVIEW[banner.placement]?.label ||
                      'Storefront placement'}
                  </p>
                </div>
              </div>
            </Card>

            {/* CTA card */}
            <Card
              icon={
                <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                  <PiArrowRightBold className="h-4 w-4" />
                </span>
              }
              title="Call to Action"
            >
              <dl>
                <InfoRow label="CTA Text" value={banner.ctaText || '—'} />
                <InfoRow
                  label="CTA Style"
                  badge={<span className="capitalize">{ctaStyleLabel}</span>}
                />
                <InfoRow
                  label="Link Type"
                  value={
                    banner.linkType
                      ? String(banner.linkType).replace(/_/g, ' ')
                      : '—'
                  }
                />
              </dl>
              {banner.ctaLink && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <PiArrowRightBold className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <a
                    href={
                      banner.ctaLink.startsWith('http')
                        ? banner.ctaLink
                        : `https://drinksharbour.com${banner.ctaLink}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-blue-600 hover:underline"
                  >
                    {banner.ctaLink}
                  </a>
                </div>
              )}
              {banner.ctaText && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Preview
                  </p>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold ${ctaCls}`}
                  >
                    {banner.ctaText}
                    <PiArrowRightBold className="h-3.5 w-3.5" />
                  </span>
                </div>
              )}
            </Card>

            {/* Styling card */}
            <Card
              icon={
                <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                  <PiSparkleBold className="h-4 w-4" />
                </span>
              }
              title="Styling"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Background
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-8 w-8 rounded-lg border border-gray-200"
                      style={{
                        backgroundColor: banner.backgroundColor || '#fff',
                      }}
                    />
                    <code className="text-sm text-gray-700">
                      {banner.backgroundColor || '#FFFFFF'}
                    </code>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Text Color
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-8 w-8 rounded-lg border border-gray-200"
                      style={{ backgroundColor: banner.textColor || '#000' }}
                    />
                    <code className="text-sm text-gray-700">
                      {banner.textColor || '#000000'}
                    </code>
                  </div>
                </div>
              </div>
              <dl className="mt-4">
                <InfoRow
                  label="Text Alignment"
                  value={
                    banner.textAlignment
                      ? String(banner.textAlignment).charAt(0).toUpperCase() +
                        banner.textAlignment.slice(1)
                      : '—'
                  }
                />
                <InfoRow
                  label="Overlay Opacity"
                  value={`${banner.overlayOpacity ?? 0}%`}
                />
              </dl>
              {/* Content position visual indicator */}
              <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Content Position
                  </p>
                  <p className="text-sm font-medium capitalize text-gray-900">
                    {String(banner.contentPosition || 'center').replace(
                      /-/g,
                      ' '
                    )}
                  </p>
                </div>
                <div className="ms-auto">
                  <PositionGridIndicator position={banner.contentPosition} />
                </div>
              </div>
            </Card>

            {/* Mobile image preview */}
            {banner.mobileImage?.url && (
              <Card
                icon={
                  <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                    <PiDeviceMobileBold className="h-4 w-4" />
                  </span>
                }
                title="Mobile Image"
              >
                <div
                  className="relative mx-auto w-32 overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                  style={{ aspectRatio: '16/9' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={banner.mobileImage.url}
                    alt="Mobile banner"
                    className="h-full w-full object-cover"
                  />
                </div>
                {banner.mobileImage?.alt && (
                  <p className="mt-2 text-center text-xs text-gray-400">
                    {banner.mobileImage.alt}
                  </p>
                )}
              </Card>
            )}

            {/* Content */}
            {(banner.description || banner.subtitle) && (
              <Card
                icon={
                  <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                    <PiImageBold className="h-4 w-4" />
                  </span>
                }
                title="Content"
              >
                {banner.subtitle && (
                  <p className="mb-1 text-sm font-semibold text-gray-800">
                    {banner.subtitle}
                  </p>
                )}
                {banner.description && (
                  <p className="text-sm leading-relaxed text-gray-500">
                    {banner.description}
                  </p>
                )}
              </Card>
            )}

            {banner.notes && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
                <h3 className="mb-2 text-sm font-semibold text-amber-900">
                  Internal Notes
                </h3>
                <p className="text-sm text-amber-800">{banner.notes}</p>
              </div>
            )}
          </div>

          {/* Right — sidebar */}
          <div className="space-y-4">
            {/* Schedule */}
            <Card
              icon={
                <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                  <PiCalendarBold className="h-4 w-4" />
                </span>
              }
              title="Schedule"
            >
              <dl>
                <InfoRow
                  label="Scheduled"
                  badge={
                    banner.isScheduled ? (
                      <span className="text-amber-600">Yes</span>
                    ) : (
                      <span className="text-gray-500">No</span>
                    )
                  }
                />
                {banner.startDate && (
                  <InfoRow
                    label="Start"
                    value={new Date(banner.startDate).toLocaleDateString()}
                  />
                )}
                {banner.endDate && (
                  <InfoRow
                    label="End"
                    value={new Date(banner.endDate).toLocaleDateString()}
                  />
                )}
                {banner.daysUntilExpiration != null && (
                  <InfoRow
                    label="Expires in"
                    badge={
                      <span
                        className={
                          banner.daysUntilExpiration <= 3
                            ? 'font-bold text-red-600'
                            : 'text-gray-900'
                        }
                      >
                        {banner.daysUntilExpiration}d
                      </span>
                    }
                  />
                )}
              </dl>
            </Card>

            {/* Device targeting */}
            {banner.deviceTargeting && (
              <Card
                icon={
                  <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                    <PiDeviceMobileBold className="h-4 w-4" />
                  </span>
                }
                title="Device Targeting"
              >
                <div className="flex flex-wrap gap-2">
                  {(['desktop', 'mobile', 'tablet'] as const).map((d) => (
                    <span
                      key={d}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize ${
                        banner.deviceTargeting[d]
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-gray-100 text-gray-400 line-through'
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Tags */}
            {banner.tags?.length > 0 && (
              <Card
                icon={
                  <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                    <PiTagBold className="h-4 w-4" />
                  </span>
                }
                title="Tags"
              >
                <div className="flex flex-wrap gap-2">
                  {banner.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Timestamps */}
            <Card
              icon={
                <span className="flex h-5 w-5 items-center justify-center text-gray-500">
                  <PiClockBold className="h-4 w-4" />
                </span>
              }
              title="Timestamps"
            >
              <dl>
                {banner.createdAt && (
                  <InfoRow
                    label="Created"
                    value={new Date(banner.createdAt).toLocaleDateString()}
                  />
                )}
                {banner.updatedAt && (
                  <InfoRow
                    label="Updated"
                    value={new Date(banner.updatedAt).toLocaleDateString()}
                  />
                )}
                {banner.publishedAt && (
                  <InfoRow
                    label="Published"
                    value={new Date(banner.publishedAt).toLocaleDateString()}
                  />
                )}
              </dl>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky mobile action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-2.5 shadow-[0_-4px_12px_rgba(16,24,40,0.06)] backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <Link href={routes.eCommerce.editBanner(id)} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <PiPencilLineBold className="mr-1.5 h-4 w-4" /> Edit
            </Button>
          </Link>
          {(isActive || isPaused) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange(isActive ? 'paused' : 'active')}
              className="flex-1"
            >
              {isActive ? (
                <>
                  <PiPauseBold className="mr-1.5 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <PiPlayBold className="mr-1.5 h-4 w-4" />
                  Activate
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleDelete}
            className="flex-1 border-0 bg-red-500 text-white hover:bg-red-600"
          >
            <PiTrashBold className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
      <div className="h-14 lg:hidden" />
    </>
  );
}
