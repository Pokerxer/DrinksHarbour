// @ts-nocheck
'use client';

/**
 * Create/edit form sections — content side: basic info, images,
 * call-to-action and styling. All state flows in via props; the form owns it.
 */

import { Input, Textarea, Select, Switch } from 'rizzui';
import {
  PiInfoBold,
  PiImageBold,
  PiLinkBold,
  PiPaletteBold,
  PiInfo,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import {
  BANNER_TYPE_OPTIONS,
  BANNER_PLACEMENT_OPTIONS,
  BANNER_PRIORITY_OPTIONS,
  BANNER_CTA_STYLE_OPTIONS,
  BANNER_CONTENT_POSITION_OPTIONS,
  BANNER_LINK_TYPE_OPTIONS,
  BannerFormData,
} from '@/types/banner.types';
import {
  CollapsibleSection,
  ImageUploadField,
  FieldSparkle,
} from './form-fields';
import LinkSelector from './link-selector';
import { PLACEMENT_TYPE_HINT } from './placement';

export interface SectionBaseProps {
  formData: BannerFormData;
  set: (field: keyof BannerFormData, value: any) => void;
}

const PRIORITY_DOTS: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

const PRIORITY_ACTIVE_CLS: Record<string, string> = {
  low: 'border-gray-300 bg-gray-50 text-gray-700',
  medium: 'border-amber-300 bg-amber-50 text-amber-700',
  high: 'border-orange-300 bg-orange-50 text-orange-700',
  urgent: 'border-red-300 bg-red-50 text-red-700',
};

export function BasicInfoSection({
  formData,
  set,
  enhancingField,
  onEnhanceField,
}: SectionBaseProps & {
  enhancingField: string | null;
  onEnhanceField: (field: 'title' | 'subtitle' | 'ctaText') => void;
}) {
  const recommended = PLACEMENT_TYPE_HINT[formData.placement];
  const mismatch =
    recommended &&
    formData.type !== recommended &&
    formData.type !== 'custom' &&
    formData.type !== 'promotional';

  return (
    <CollapsibleSection
      icon={<PiInfoBold className="h-5 w-5 text-blue-600" />}
      iconBg="bg-blue-100"
      title="Basic Information"
      subtitle="Title, subtitle, type and placement"
    >
      <div className="space-y-4">
        <Input
          label="Title"
          placeholder="Enter banner title"
          value={formData.title || ''}
          onChange={(e) => set('title', e.target.value)}
          className="w-full"
          hint="Optional — leave empty for an image-only banner"
          suffix={
            <FieldSparkle
              field="title"
              busy={enhancingField === 'title'}
              disabled={enhancingField === 'title' || !(formData.title || '').trim()}
              onClick={() => onEnhanceField('title')}
            />
          }
        />
        <Input
          label="Subtitle"
          placeholder="Enter subtitle (optional)"
          value={formData.subtitle || ''}
          onChange={(e) => set('subtitle', e.target.value)}
          className="w-full"
          suffix={
            <FieldSparkle
              field="subtitle"
              busy={enhancingField === 'subtitle'}
              disabled={enhancingField === 'subtitle' || !(formData.subtitle || '').trim()}
              onClick={() => onEnhanceField('subtitle')}
            />
          }
        />
        <Textarea
          label="Description"
          placeholder="Enter description (optional)"
          value={formData.description || ''}
          onChange={(e) => set('description', e.target.value)}
          rows={2}
          className="w-full"
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type"
            options={BANNER_TYPE_OPTIONS}
            value={formData.type}
            onChange={(v: any) => set('type', v?.value ?? v)}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) => v}
          />
          <Select
            label="Placement"
            options={BANNER_PLACEMENT_OPTIONS}
            value={formData.placement}
            onChange={(v: any) => set('placement', v?.value ?? v)}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) => v}
          />
        </div>

        {/* Type + Placement combination hint */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
            mismatch ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-600'
          )}
        >
          <PiInfo className="h-3.5 w-3.5 flex-shrink-0" />
          {mismatch ? (
            <span>
              Tip: <strong className="capitalize">{recommended}</strong> type is
              typically used for{' '}
              <strong className="capitalize">
                {String(formData.placement).replace(/_/g, ' ')}
              </strong>
              . Your current type is{' '}
              <strong className="capitalize">{formData.type}</strong>.
            </span>
          ) : (
            <span>
              Preview shows how this banner renders on the storefront as a{' '}
              <strong className="capitalize">
                {String(formData.placement).replace(/_/g, ' ')}
              </strong>
              .
            </span>
          )}
        </div>

        {/* Priority — visual segmented control with color dots */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Priority
          </label>
          <div className="grid grid-cols-4 gap-2">
            {BANNER_PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('priority', opt.value)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border-2 py-2 text-xs font-semibold transition ${
                  formData.priority === opt.value
                    ? PRIORITY_ACTIVE_CLS[opt.value]
                    : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${PRIORITY_DOTS[opt.value]}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Display Order"
          type="number"
          min={0}
          value={formData.displayOrder}
          onChange={(e) => set('displayOrder', parseInt(e.target.value) || 0)}
          hint="Lower numbers appear first"
        />
      </div>
    </CollapsibleSection>
  );
}

export function ImagesSection({
  formData,
  set,
  token,
}: SectionBaseProps & { token: string }) {
  return (
    <CollapsibleSection
      icon={<PiImageBold className="h-5 w-5 text-purple-600" />}
      iconBg="bg-purple-100"
      title="Banner Images"
      subtitle="Desktop and mobile images"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ImageUploadField
          label="Desktop Image"
          required
          value={formData.image?.url || ''}
          onChange={(url) => set('image', { ...formData.image, url })}
          token={token}
          folder="banners"
          aspectRatio="video"
        />
        <ImageUploadField
          label="Mobile Image"
          value={formData.mobileImage?.url || ''}
          onChange={(url) => set('mobileImage', { ...formData.mobileImage, url })}
          token={token}
          folder="banners"
          aspectRatio="wide"
        />
      </div>
    </CollapsibleSection>
  );
}

export function CtaSection({
  formData,
  set,
  token,
  targetProduct,
  targetCategory,
  onProductSelect,
  onCategorySelect,
  enhancingField,
  onEnhanceField,
}: SectionBaseProps & {
  token: string;
  targetProduct?: { _id: string; name: string };
  targetCategory?: { _id: string; name: string };
  onProductSelect: (p: { _id: string; name: string } | null) => void;
  onCategorySelect: (c: { _id: string; name: string } | null) => void;
  enhancingField: string | null;
  onEnhanceField: (field: 'title' | 'subtitle' | 'ctaText') => void;
}) {
  return (
    <CollapsibleSection
      icon={<PiLinkBold className="h-5 w-5 text-green-600" />}
      iconBg="bg-green-100"
      title="Call to Action"
      subtitle="Button text and link"
      defaultOpen={false}
    >
      <div className="space-y-4">
        <Select
          label="Link Type"
          options={BANNER_LINK_TYPE_OPTIONS}
          value={formData.linkType}
          getOptionValue={(o) => o.value}
          displayValue={(v: any) => v}
          onChange={(v: any) => {
            set('linkType', v?.value ?? v);
            onProductSelect(null);
            onCategorySelect(null);
            set('ctaLink', '');
          }}
        />
        <LinkSelector
          key={formData.linkType}
          linkType={formData.linkType}
          targetProduct={targetProduct}
          targetCategory={targetCategory}
          onProductSelect={(product) => {
            onProductSelect(product);
            onCategorySelect(null);
            if (product) {
              set('ctaLink', `/shop?search=${encodeURIComponent(product.name)}`);
            }
          }}
          onCategorySelect={(category) => {
            onCategorySelect(category);
            onProductSelect(null);
            if (category) {
              set('ctaLink', `/shop?category=${category._id}`);
            }
          }}
          token={token}
        />
        <Input
          label="CTA Button Text"
          placeholder="Shop Now"
          value={formData.ctaText || ''}
          onChange={(e) => set('ctaText', e.target.value)}
          suffix={
            <FieldSparkle
              field="ctaText"
              busy={enhancingField === 'ctaText'}
              disabled={enhancingField === 'ctaText' || !(formData.ctaText || '').trim()}
              onClick={() => onEnhanceField('ctaText')}
            />
          }
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            CTA Style
          </label>
          <div className="flex flex-wrap gap-2">
            {BANNER_CTA_STYLE_OPTIONS.map((opt) => {
              const active = formData.ctaStyle === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('ctaStyle', opt.value)}
                  className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-orange-300 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <Input
          label="CTA Link / URL"
          placeholder="https://example.com/shop"
          value={formData.ctaLink || ''}
          onChange={(e) => set('ctaLink', e.target.value)}
        />
        {/* Whole-banner click-through */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <p className="font-medium text-gray-900">Whole Banner Clickable</p>
            <p className="text-sm text-gray-500">
              {formData.ctaLink
                ? 'Clicking anywhere on the banner opens this link — no button text needed'
                : 'Set a CTA link first, then clicking the banner opens it'}
            </p>
          </div>
          <Switch
            checked={formData.imageClickable ?? true}
            onChange={(checked) => set('imageClickable', checked)}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}

export function StylingSection({ formData, set }: SectionBaseProps) {
  return (
    <CollapsibleSection
      icon={<PiPaletteBold className="h-5 w-5 text-pink-600" />}
      iconBg="bg-pink-100"
      title="Styling"
      subtitle="Colors and text alignment"
      defaultOpen={false}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Background Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.backgroundColor}
                onChange={(e) => set('backgroundColor', e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-gray-200"
              />
              <Input
                value={formData.backgroundColor}
                onChange={(e) => set('backgroundColor', e.target.value)}
                size="sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Text Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.textColor}
                onChange={(e) => set('textColor', e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-gray-200"
              />
              <Input
                value={formData.textColor}
                onChange={(e) => set('textColor', e.target.value)}
                size="sm"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Text Alignment"
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
            value={formData.textAlignment}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) => v}
            onChange={(v: any) => set('textAlignment', v?.value ?? v)}
          />
          <Select
            label="Content Position"
            options={BANNER_CONTENT_POSITION_OPTIONS}
            value={formData.contentPosition}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) => v}
            onChange={(v: any) => set('contentPosition', v?.value ?? v)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Overlay Opacity:{' '}
            <span className="font-semibold">{formData.overlayOpacity}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={formData.overlayOpacity}
            onChange={(e) => set('overlayOpacity', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
