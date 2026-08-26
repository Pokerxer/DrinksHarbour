// @ts-nocheck
'use client';

/**
 * Right-hand sidebar of the create/edit form: live preview + quick info panel.
 */

import { PiEyeBold } from 'react-icons/pi';
import {
  BANNER_TYPE_OPTIONS,
  BANNER_PLACEMENT_OPTIONS,
  BANNER_STATUS_OPTIONS,
  BANNER_CTA_STYLE_OPTIONS,
} from '@/types/banner.types';
import { PriorityBadge } from '@/app/shared/ecommerce/banner/banner-shared';
import { BannerPreview } from './preview';

export function FormSidebar({
  formData,
  deviceTargeting,
}: {
  formData: any;
  deviceTargeting: { desktop: boolean; mobile: boolean; tablet: boolean };
}) {
  const devices = [
    deviceTargeting.desktop && 'Desktop',
    deviceTargeting.mobile && 'Mobile',
    deviceTargeting.tablet && 'Tablet',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <PiEyeBold className="h-4 w-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Live Preview</h3>
        </div>
        <BannerPreview formData={formData} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-gray-900">Quick Info</h3>
        <dl className="space-y-2 text-sm">
          <QuickRow
            label="Type"
            value={BANNER_TYPE_OPTIONS.find((t) => t.value === formData.type)?.label}
          />
          <QuickRow
            label="Placement"
            value={
              BANNER_PLACEMENT_OPTIONS.find((p) => p.value === formData.placement)?.label
            }
          />
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">Priority</dt>
            <dd>
              <PriorityBadge priority={formData.priority} size="sm" />
            </dd>
          </div>
          <QuickRow
            label="CTA Style"
            value={
              BANNER_CTA_STYLE_OPTIONS.find((c) => c.value === formData.ctaStyle)?.label ||
              'Primary'
            }
          />
          <QuickRow
            label="Status"
            value={BANNER_STATUS_OPTIONS.find((s) => s.value === formData.status)?.label}
          />
          <QuickRow label="Global" value={formData.isGlobal ? 'Yes' : 'No'} />
          <QuickRow label="Devices" value={devices || 'None'} />
        </dl>
      </div>
    </div>
  );
}

function QuickRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium capitalize text-gray-900">{value || '—'}</dd>
    </div>
  );
}
