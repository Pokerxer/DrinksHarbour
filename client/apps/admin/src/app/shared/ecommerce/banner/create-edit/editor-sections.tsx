'use client';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import type { BannerDeviceTargeting } from '@/types/banner.types';
import {
  BasicInfoSection,
  ImagesSection,
  CtaSection,
  StylingSection,
} from './form-sections-content';
import {
  SchedulingSection,
  StatusVisibilitySection,
  DeviceTargetingSection,
  TagsSection,
  NotesSection,
} from './form-sections-settings';
type Props = ComponentProps<typeof CtaSection> & {
  deviceTargeting: BannerDeviceTargeting;
  setDeviceTargeting: Dispatch<SetStateAction<BannerDeviceTargeting>>;
  canManageGlobal: boolean;
};
export default function BannerEditorSections({
  formData,
  set,
  token,
  targetProduct,
  targetCategory,
  targetBrand,
  onProductSelect,
  onCategorySelect,
  onBrandSelect,
  enhancingField,
  onEnhanceField,
  deviceTargeting,
  setDeviceTargeting,
  canManageGlobal,
}: Props) {
  return (
    <div className="space-y-4 lg:col-span-2">
      <BasicInfoSection
        formData={formData}
        set={set}
        enhancingField={enhancingField}
        onEnhanceField={onEnhanceField}
      />
      <ImagesSection formData={formData} set={set} token={token} />
      <CtaSection
        formData={formData}
        set={set}
        token={token}
        targetProduct={targetProduct ?? undefined}
        targetCategory={targetCategory ?? undefined}
        targetBrand={targetBrand ?? undefined}
        onProductSelect={onProductSelect}
        onCategorySelect={onCategorySelect}
        onBrandSelect={onBrandSelect}
        enhancingField={enhancingField}
        onEnhanceField={onEnhanceField}
      />
      <StylingSection formData={formData} set={set} />
      <SchedulingSection
        formData={formData}
        set={set}
        deviceTargeting={deviceTargeting}
        setDeviceTargeting={setDeviceTargeting}
      />
      <StatusVisibilitySection
        canManageGlobal={canManageGlobal}
        formData={formData}
        set={set}
        deviceTargeting={deviceTargeting}
        setDeviceTargeting={setDeviceTargeting}
      />
      <DeviceTargetingSection
        deviceTargeting={deviceTargeting}
        setDeviceTargeting={setDeviceTargeting}
      />
      <TagsSection
        formData={formData}
        set={set}
        deviceTargeting={deviceTargeting}
        setDeviceTargeting={setDeviceTargeting}
      />
      <NotesSection
        formData={formData}
        set={set}
        deviceTargeting={deviceTargeting}
        setDeviceTargeting={setDeviceTargeting}
      />
    </div>
  );
}
