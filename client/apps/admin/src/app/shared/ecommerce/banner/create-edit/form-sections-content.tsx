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
              disabled={
                enhancingField === 'title' || !(formData.title || '').trim()
              }
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
              disabled={
                enhancingField === 'subtitle' ||
                !(formData.subtitle || '').trim()
              }
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
                <span
                  className={`h-2 w-2 rounded-full ${PRIORITY_DOTS[opt.value]}`}
                />
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
  const isPopup = formData.placement === 'popup';

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
          aspectRatio={isPopup ? 'portrait' : 'video'}
        />
        <ImageUploadField
          label="Mobile Image"
          value={formData.mobileImage?.url || ''}
          onChange={(url) =>
            set('mobileImage', { ...formData.mobileImage, url })
          }
          token={token}
          folder="banners"
          aspectRatio={isPopup ? 'portrait' : 'wide'}
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
  targetBrand,
  onProductSelect,
  onCategorySelect,
  onBrandSelect,
  enhancingField,
  onEnhanceField,
}: SectionBaseProps & {
  token: string;
  targetProduct?: { _id: string; name: string };
  targetCategory?: { _id: string; name: string };
  targetBrand?: { _id: string; name: string };
  onProductSelect: (p: { _id: string; name: string } | null) => void;
  onCategorySelect: (c: { _id: string; name: string } | null) => void;
  onBrandSelect: (b: { _id: string; name: string } | null) => void;
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
            onBrandSelect(null);
            set('ctaLink', '');
          }}
        />
        <LinkSelector
          key={formData.linkType}
          linkType={formData.linkType}
          targetProduct={targetProduct}
          targetCategory={targetCategory}
          targetBrand={targetBrand}
          onProductSelect={(product) => {
            onProductSelect(product);
            onCategorySelect(null);
            onBrandSelect(null);
            if (product) {
              // Canonical storefront path — `_id` is the slug
              set('ctaLink', `/product/${product._id}`);
            }
          }}
          onCategorySelect={(category) => {
            onCategorySelect(category);
            onProductSelect(null);
            onBrandSelect(null);
            if (category) {
              // Canonical storefront path — `_id` is the slug
              set('ctaLink', `/categories/${category._id}`);
            }
          }}
          onBrandSelect={(brand) => {
            onBrandSelect(brand);
            onProductSelect(null);
            onCategorySelect(null);
            if (brand) {
              // Canonical storefront path — `_id` is the slug
              set('ctaLink', `/brands/${brand._id}`);
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
              disabled={
                enhancingField === 'ctaText' || !(formData.ctaText || '').trim()
              }
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
          hint={
            formData.linkType === 'internal' || formData.linkType === 'page'
              ? 'Path relative to storefront, e.g. /shop'
              : formData.linkType === 'external'
                ? 'Full URL including https://'
                : undefined
          }
        />
        {/* Whole-banner click-through */}
        <div
          className={`flex items-center justify-between rounded-lg border p-4 ${
            formData.ctaLink
              ? 'border-gray-200'
              : 'border-gray-100 bg-gray-50/50'
          }`}
        >
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
            disabled={!formData.ctaLink}
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
        <Select
          label="Image Fit"
          options={[
            { value: 'cover', label: 'Cover (crop to fill)' },
            { value: 'contain', label: 'Contain (fit whole image)' },
          ]}
          value={formData.imageFit}
          getOptionValue={(o) => o.value}
          displayValue={(v: any) => v}
          onChange={(v: any) => set('imageFit', v?.value ?? v)}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Gradient Intensity:{' '}
            <span className="font-semibold">{formData.gradientIntensity}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={formData.gradientIntensity}
            onChange={(e) => set('gradientIntensity', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <p className="mt-1 text-xs text-gray-400">
            Dims the hero&apos;s cinematic gradient and vignette. 0% removes it.
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Blur Intensity:{' '}
            <span className="font-semibold">{formData.blurIntensity}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={formData.blurIntensity}
            onChange={(e) => set('blurIntensity', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <p className="mt-1 text-xs text-gray-400">
            Scales the slide transition blur and the frosted buttons and badges.
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ── Popup behaviour — when this banner's placement is 'popup' ────────────────
export function PopupBehaviorSection({ formData, set }: SectionBaseProps) {
  const popup = formData.popup || {};
  const pset = (field: string, value: any) =>
    set('popup', { ...formData.popup, [field]: value });

  return (
    <CollapsibleSection
      icon={<PiInfo className="h-5 w-5 text-red-600" />}
      iconBg="bg-red-100"
      title="Popup Behaviour"
      subtitle="When it appears, how often, and how it is dismissed"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Best practice: let engaged visitors meet the popup (15s+ dwell or
          40% scroll, or on exit), cap it at once per day, and never stack
          popups — the storefront already enforces a 30-minute quiet window
          after any popup shows.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Trigger
            </label>
            <Select
              size="sm"
              value={popup.trigger || 'time_delay'}
              onChange={(v: any) => pset('trigger', v?.value ?? v)}
              getOptionValue={(o) => o.value}
              displayValue={(v: any) => v}
              options={[
                { value: 'time_delay', label: 'Time delay (recommended)' },
                { value: 'scroll_depth', label: 'Scroll depth' },
                { value: 'exit_intent', label: 'Exit intent (desktop)' },
                { value: 'page_load', label: 'Immediately on page load' },
                { value: 'inactivity', label: 'Visitor inactivity' },
              ]}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              How often it may show
            </label>
            <Select
              size="sm"
              value={popup.frequency || 'once_per_day'}
              onChange={(v: any) => pset('frequency', v?.value ?? v)}
              getOptionValue={(o) => o.value}
              displayValue={(v: any) => v}
              options={[
                { value: 'once_per_day', label: 'Once per day (recommended)' },
                { value: 'once_per_session', label: 'Once per session' },
                { value: 'once_ever', label: 'Once ever' },
                { value: 'every_visit', label: 'Every visit (annoying)' },
              ]}
            />
          </div>
          {(popup.trigger || 'time_delay') === 'time_delay' ||
          (popup.trigger || '') === 'inactivity' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Delay (seconds):{' '}
                <span className="font-semibold">{popup.delaySeconds ?? 15}</span>
              </label>
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={popup.delaySeconds ?? 15}
                onChange={(e) => pset('delaySeconds', Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <p className="mt-1 text-xs text-gray-400">5–60 seconds.</p>
            </div>
          ) : null}
          {(popup.trigger || '') === 'scroll_depth' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Scroll depth:{' '}
                <span className="font-semibold">{popup.scrollDepthPercent ?? 40}%</span>
              </label>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={popup.scrollDepthPercent ?? 40}
                onChange={(e) =>
                  pset('scrollDepthPercent', Number(e.target.value))
                }
                className="w-full accent-blue-600"
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Layout
            </label>
            <Select
              size="sm"
              value={popup.variant || 'modal'}
              onChange={(v: any) => pset('variant', v?.value ?? v)}
              getOptionValue={(o) => o.value}
              displayValue={(v: any) => v}
              options={[
                { value: 'modal', label: 'Center modal' },
                { value: 'slide_in', label: 'Slide-in corner' },
                { value: 'notification', label: 'Notification' },
                { value: 'full_screen', label: 'Full screen (mobile risk)' },
              ]}
            />
          </div>
          {(popup.variant || 'modal') === 'slide_in' ||
          (popup.variant || '') === 'notification' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Corner position
              </label>
              <Select
                size="sm"
                value={popup.position || 'bottom-right'}
                onChange={(v: any) => pset('position', v?.value ?? v)}
              getOptionValue={(o) => o.value}
              displayValue={(v: any) => v}
                options={[
                  { value: 'bottom-right', label: 'Bottom right' },
                  { value: 'bottom-left', label: 'Bottom left' },
                  { value: 'top-right', label: 'Top right' },
                  { value: 'top-left', label: 'Top left' },
                ]}
              />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Switch
              size="sm"
              checked={popup.showCloseButton ?? true}
              onChange={(v: boolean) => pset('showCloseButton', v)}
            />
            Show close button
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Switch
              size="sm"
              checked={popup.closeOnBackdrop ?? true}
              onChange={(v: boolean) => pset('closeOnBackdrop', v)}
            />
            Click outside closes
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Switch
              size="sm"
              checked={popup.collectEmail ?? false}
              onChange={(v: boolean) => pset('collectEmail', v)}
            />
            Capture email in the popup
          </label>
          {(popup.collectEmail ?? false) && (
            <Input
              size="sm"
              placeholder="Coupon code shown after signup (optional)"
              value={popup.couponCode || ''}
              onChange={(e: any) => pset('couponCode', e.target.value)}
            />
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}
