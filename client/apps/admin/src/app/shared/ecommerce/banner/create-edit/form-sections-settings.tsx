// @ts-nocheck
'use client';

/**
 * Create/edit form sections — settings side: scheduling, status & visibility,
 * device targeting, tags and internal notes.
 */

import { Input, Textarea, Select, Switch } from 'rizzui';
import {
  PiCalendarBold,
  PiGlobeBold,
  PiDeviceMobileBold,
  PiTagBold,
  PiInfoBold,
} from 'react-icons/pi';
import {
  BANNER_STATUS_OPTIONS,
  BANNER_VISIBLE_TO_OPTIONS,
} from '@/types/banner.types';
import { CollapsibleSection, TagsInput } from './form-fields';
import type { SectionBaseProps } from './form-sections-content';

type DeviceTargeting = { desktop: boolean; mobile: boolean; tablet: boolean };

interface SettingsProps extends SectionBaseProps {
  deviceTargeting: DeviceTargeting;
  setDeviceTargeting: React.Dispatch<React.SetStateAction<DeviceTargeting>>;
}

export function SchedulingSection({ formData, set }: SettingsProps) {
  return (
    <CollapsibleSection
      icon={<PiCalendarBold className="h-5 w-5 text-amber-600" />}
      iconBg="bg-amber-100"
      title="Scheduling"
      subtitle="Set display schedule (optional)"
      defaultOpen={false}
    >
      <div className="space-y-4">
        <Switch
          checked={formData.isScheduled}
          onChange={(checked) => set('isScheduled', checked)}
          label="Enable Scheduling"
        />
        {formData.isScheduled && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate || ''}
              onChange={(e) => set('startDate', e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate || ''}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

export function StatusVisibilitySection({
  formData,
  set,
}: SettingsProps) {
  return (
    <CollapsibleSection
      icon={<PiGlobeBold className="h-5 w-5 text-cyan-600" />}
      iconBg="bg-cyan-100"
      title="Status & Visibility"
      subtitle="Control where and when the banner is shown"
      defaultOpen={false}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status"
            options={BANNER_STATUS_OPTIONS}
            value={formData.status}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) => v}
            onChange={(v: any) => set('status', v?.value ?? v)}
          />
          <Select
            label="Visible To"
            options={BANNER_VISIBLE_TO_OPTIONS}
            value={formData.visibleTo}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) => v}
            onChange={(v: any) => set('visibleTo', v?.value ?? v)}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <p className="font-medium text-gray-900">Active</p>
            <p className="text-sm text-gray-500">Banner will be displayed</p>
          </div>
          <Switch checked={formData.isActive} onChange={(checked) => set('isActive', checked)} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <p className="font-medium text-gray-900">Global Banner</p>
            <p className="text-sm text-gray-500">Available across all tenants</p>
          </div>
          <Switch checked={formData.isGlobal} onChange={(checked) => set('isGlobal', checked)} />
        </div>
      </div>
    </CollapsibleSection>
  );
}

export function DeviceTargetingSection({
  deviceTargeting,
  setDeviceTargeting,
}: Omit<SettingsProps, 'formData' | 'set'>) {
  return (
    <CollapsibleSection
      icon={<PiDeviceMobileBold className="h-5 w-5 text-indigo-600" />}
      iconBg="bg-indigo-100"
      title="Device Targeting"
      subtitle="Choose which devices show this banner"
      defaultOpen={false}
    >
      <div className="grid grid-cols-3 gap-4">
        {(['desktop', 'mobile', 'tablet'] as const).map((device) => (
          <div
            key={device}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
          >
            <span className="font-medium capitalize text-gray-900">{device}</span>
            <Switch
              checked={deviceTargeting[device]}
              onChange={(checked) =>
                setDeviceTargeting((prev) => ({ ...prev, [device]: checked }))
              }
            />
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

export function TagsSection({ formData, set }: SettingsProps) {
  return (
    <CollapsibleSection
      icon={<PiTagBold className="h-5 w-5 text-orange-600" />}
      iconBg="bg-orange-100"
      title="Tags"
      subtitle="Organize with tags"
      defaultOpen={false}
    >
      <TagsInput tags={formData.tags || []} onChange={(tags) => set('tags', tags)} />
    </CollapsibleSection>
  );
}

export function NotesSection({ formData, set }: SettingsProps) {
  return (
    <CollapsibleSection
      icon={<PiInfoBold className="h-5 w-5 text-gray-600" />}
      iconBg="bg-gray-100"
      title="Internal Notes"
      subtitle="Notes for your team"
      defaultOpen={false}
    >
      <Textarea
        placeholder="Add any internal notes about this banner..."
        value={formData.notes || ''}
        onChange={(e) => set('notes', e.target.value)}
        rows={3}
      />
    </CollapsibleSection>
  );
}
