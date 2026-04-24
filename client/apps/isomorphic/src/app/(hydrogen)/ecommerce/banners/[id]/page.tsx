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
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4"
    >
      <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 text-gray-500">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function getStatusBadge(status: string) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    draft:     { label: 'Draft',     bg: 'bg-gray-100', text: 'text-gray-700' },
    scheduled: { label: 'Scheduled',  bg: 'bg-amber-100', text: 'text-amber-700' },
    active:    { label: 'Active',    bg: 'bg-green-100', text: 'text-green-700' },
    paused:    { label: 'Paused',    bg: 'bg-orange-100', text: 'text-orange-700' },
    expired:   { label: 'Expired',   bg: 'bg-red-100', text: 'text-red-700' },
    archived:  { label: 'Archived',  bg: 'bg-gray-100', text: 'text-gray-700' },
  };
  return badges[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
}

function StatusBadge({ status }: { status: string }) {
  const badge = getStatusBadge(status);
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

export default function BannerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!banner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Text className="text-lg font-semibold text-gray-900 mb-2">Banner not found</Text>
        <Link href={routes.eCommerce.banners}>
          <Button variant="outline">Back to Banners</Button>
        </Link>
      </div>
    );
  }

  const statusBadge = getStatusBadge(banner.status);
  const isActive = banner.status === 'active';
  const isPaused = banner.status === 'paused';

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
        <div className="mt-4 flex items-center gap-3 @lg:mt-0 flex-wrap">
          {(isActive || isPaused) && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange(isActive ? 'paused' : 'active')}
            >
              {isActive ? <><PiPauseBold className="mr-2 h-4 w-4" />Pause</> : <><PiPlayBold className="mr-2 h-4 w-4" />Activate</>}
            </Button>
          )}
          <Link href={routes.eCommerce.editBanner(id)}>
            <Button variant="outline">
              <PiPencilLineBold className="mr-2 h-4 w-4" />Edit
            </Button>
          </Link>
          <Button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white border-0">
            <PiTrashBold className="mr-2 h-4 w-4" />Delete
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-6">
        {/* Preview */}
        {banner.image?.url && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100"
            style={{ backgroundColor: banner.backgroundColor }}
          >
            <img src={banner.image.url} alt={banner.title} className="w-full h-64 md:h-80 object-cover" />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${(banner.overlayOpacity || 0) / 100})` }}
            />
            <div className="absolute top-4 left-4 flex gap-2">
              <StatusBadge status={banner.status} />
              {banner.type && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                  {banner.type}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* Analytics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<PiEyeBold className="w-5 h-5" />} label="Impressions" value={(banner.impressions || 0).toLocaleString()} />
          <StatCard icon={<PiMouseBold className="w-5 h-5" />} label="Clicks" value={(banner.clicks || 0).toLocaleString()} />
          <StatCard icon={<PiCursorBold className="w-5 h-5" />} label="CTR" value={`${(banner.clickThroughRate || 0).toFixed(2)}%`} />
          <StatCard icon={<PiArrowsClockwiseBold className="w-5 h-5" />} label="Conversions" value={banner.conversionCount || 0} sub={`${(banner.conversionRate || 0).toFixed(2)}% rate`} />
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Banner Details</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  ['Placement', banner.placement],
                  ['Priority', banner.priority],
                  ['Display Order', banner.displayOrder ?? '-'],
                  ['Visible To', banner.visibleTo],
                  ['Global', banner.isGlobal ? 'Yes' : 'No'],
                  ['Link Type', banner.linkType],
                  ['CTA Text', banner.ctaText || '-'],
                  ['CTA Link', banner.ctaLink || '-'],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-gray-400 font-medium">{label}</dt>
                    <dd className="text-gray-900 mt-0.5 truncate">{value as string}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {(banner.description || banner.subtitle) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Content</h3>
                {banner.subtitle && <p className="text-sm font-medium text-gray-700 mb-1">{banner.subtitle}</p>}
                {banner.description && <p className="text-sm text-gray-500">{banner.description}</p>}
              </div>
            )}

            {banner.notes && (
              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
                <h3 className="font-semibold text-amber-900 mb-2">Internal Notes</h3>
                <p className="text-sm text-amber-800">{banner.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Schedule */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <PiCalendarBold className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900 text-sm">Schedule</h3>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-400">Scheduled</dt>
                  <dd className="text-gray-900">{banner.isScheduled ? 'Yes' : 'No'}</dd>
                </div>
                {banner.startDate && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Start</dt>
                    <dd className="text-gray-900">{new Date(banner.startDate).toLocaleDateString()}</dd>
                  </div>
                )}
                {banner.endDate && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">End</dt>
                    <dd className="text-gray-900">{new Date(banner.endDate).toLocaleDateString()}</dd>
                  </div>
                )}
                {banner.daysUntilExpiration !== null && banner.daysUntilExpiration !== undefined && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Expires in</dt>
                    <dd className={banner.daysUntilExpiration <= 3 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                      {banner.daysUntilExpiration}d
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Device targeting */}
            {banner.deviceTargeting && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <PiDeviceMobileBold className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 text-sm">Device Targeting</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['desktop', 'mobile', 'tablet'] as const).map(d => (
                    <span
                      key={d}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${
                        banner.deviceTargeting[d]
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400 line-through'
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {banner.tags?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <PiTagBold className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 text-sm">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {banner.tags.map((tag: string) => (
                    <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Timestamps</h3>
              <dl className="space-y-2 text-sm">
                {banner.createdAt && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Created</dt>
                    <dd className="text-gray-900">{new Date(banner.createdAt).toLocaleDateString()}</dd>
                  </div>
                )}
                {banner.updatedAt && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Updated</dt>
                    <dd className="text-gray-900">{new Date(banner.updatedAt).toLocaleDateString()}</dd>
                  </div>
                )}
                {banner.publishedAt && (
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Published</dt>
                    <dd className="text-gray-900">{new Date(banner.publishedAt).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
