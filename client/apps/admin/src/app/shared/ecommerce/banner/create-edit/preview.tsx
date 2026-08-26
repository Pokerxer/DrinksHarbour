// @ts-nocheck
'use client';

/**
 * Placement-accurate live preview of a banner.
 * Each storefront layout family (hero strip, compact bar, footer, sidebar,
 * popup modal, announcement bar) renders with its own chrome so what the admin
 * sees here matches the platform render.
 */

import { PiImageBold, PiX } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { BannerFormData } from '@/types/banner.types';
import { PLACEMENT_PREVIEW } from './placement';
import {
  POSITION_GRID_CLS,
  CTA_STYLE_STATIC_CLS,
} from '@/app/shared/ecommerce/banner/banner-shared';

/** Image + dark overlay + positioned copy block, shared by image-backed layouts. */
function PositionedContent({
  formData,
  overlay,
  posCls,
  children,
}: {
  formData: BannerFormData;
  overlay: number;
  posCls: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={formData.image?.url}
        alt="Preview"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {overlay > 0 && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${overlay})` }}
        />
      )}
      <div className={cn('absolute inset-0 flex flex-col', posCls)}>
        {children}
      </div>
    </>
  );
}

function Caption({ label }: { label: string }) {
  return <p className="text-[11px] text-gray-400">{label}</p>;
}

/**
 * Wraps the rendered banner in its CTA link when whole-banner click-through
 * is on — the preview behaves like the storefront (cursor + hover ring).
 */
export function BannerPreview(props: { formData: BannerFormData }) {
  const { formData } = props;
  const clickable =
    Boolean(formData.ctaLink) && formData.imageClickable !== false;
  const external = /^https?:\/\//i.test(formData.ctaLink || '');
  const inner = <BannerPreviewInner formData={formData} />;

  if (!clickable) return inner;

  return (
    <a
      href={formData.ctaLink}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={(e) => e.preventDefault()}
      title={`Opens ${formData.ctaLink}`}
      className="group block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <div className="rounded-xl ring-transparent transition group-hover:ring-2 group-hover:ring-orange-300">
        {inner}
      </div>
    </a>
  );
}

function BannerPreviewInner({ formData }: { formData: BannerFormData }) {
  const placement =
    PLACEMENT_PREVIEW[formData.placement] || PLACEMENT_PREVIEW.home_hero;
  const posCls =
    POSITION_GRID_CLS[formData.contentPosition] || POSITION_GRID_CLS.center;
  const ctaCls =
    CTA_STYLE_STATIC_CLS[formData.ctaStyle] || CTA_STYLE_STATIC_CLS.primary;
  const overlay = (formData.overlayOpacity || 0) / 100;
  const textColor = formData.textColor || '#fff';

  if (!formData.image?.url) {
    return (
      <div
        className={`flex ${placement.aspect || 'aspect-[3/1]'} items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50`}
      >
        <div className="text-center text-gray-400">
          <PiImageBold className="mx-auto mb-2 h-10 w-10" />
          <p className="text-sm">Upload an image to preview</p>
          <p className="mt-0.5 text-[11px]">{placement.label}</p>
        </div>
      </div>
    );
  }

  // Header — thin announcement bar
  if (placement.layout === 'bar') {
    return (
      <div className="space-y-2">
        <div
          className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5"
          style={{ backgroundColor: formData.backgroundColor || '#7C1D1D' }}
        >
          <p className="truncate text-sm font-bold" style={{ color: textColor }}>
            {formData.title}
          </p>
          {formData.ctaText && (
            <span
              className={cn(
                'flex-shrink-0 rounded-lg px-3 py-1 text-xs font-bold',
                ctaCls
              )}
            >
              {formData.ctaText}
            </span>
          )}
        </div>
        <Caption label={placement.label} />
      </div>
    );
  }

  // Checkout — compact inline strip
  if (placement.layout === 'compact') {
    return (
      <div className="space-y-2">
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: formData.backgroundColor || '#1A1A2E' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={formData.image.url}
            alt="Preview"
            className="hidden h-12 w-20 flex-shrink-0 rounded-lg object-cover sm:block"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold" style={{ color: textColor }}>
              {formData.title}
            </p>
            {formData.subtitle && (
              <p
                className="truncate text-xs opacity-70"
                style={{ color: textColor }}
              >
                {formData.subtitle}
              </p>
            )}
          </div>
          {formData.ctaText && (
            <span
              className={cn(
                'flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold',
                ctaCls
              )}
            >
              {formData.ctaText}
            </span>
          )}
        </div>
        <Caption label={placement.label} />
      </div>
    );
  }

  // Footer — promo strip with background image at 30%
  if (placement.layout === 'footer') {
    return (
      <div className="space-y-2">
        <div
          className="relative overflow-hidden rounded-xl"
          style={{ backgroundColor: formData.backgroundColor || '#7C1D1D' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={formData.image.url}
            alt="Preview"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="relative flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="min-w-0">
              <p
                className="truncate text-base font-black"
                style={{ color: textColor }}
              >
                {formData.title}
              </p>
              {formData.subtitle && (
                <p
                  className="truncate text-sm opacity-70"
                  style={{ color: textColor }}
                >
                  {formData.subtitle}
                </p>
              )}
            </div>
            {formData.ctaText && (
              <span
                className={cn(
                  'flex-shrink-0 rounded-xl px-4 py-2 text-sm font-bold',
                  ctaCls
                )}
              >
                {formData.ctaText}
              </span>
            )}
          </div>
        </div>
        <Caption label={placement.label} />
      </div>
    );
  }

  // Sidebar — narrow vertical card
  if (placement.layout === 'sidebar') {
    return (
      <div className="space-y-2">
        <div
          className="relative mx-auto aspect-[3/4] w-48 overflow-hidden rounded-xl border border-gray-200"
          style={{ backgroundColor: formData.backgroundColor }}
        >
          <PositionedContent
            formData={formData}
            overlay={overlay}
            posCls={`${posCls} gap-1 p-3`}
          >
            {formData.subtitle && (
              <p
                className="text-[10px] font-medium drop-shadow"
                style={{ color: formData.textColor }}
              >
                {formData.subtitle}
              </p>
            )}
            <p
              className="text-sm font-black leading-tight drop-shadow-lg"
              style={{ color: formData.textColor }}
            >
              {formData.title}
            </p>
            {formData.ctaText && (
              <span
                className={cn(
                  'mt-1 inline-flex w-fit rounded px-2 py-1 text-[10px] font-bold',
                  ctaCls
                )}
              >
                {formData.ctaText}
              </span>
            )}
          </PositionedContent>
        </div>
        <Caption label={placement.label} />
      </div>
    );
  }

  // Popup — modal frame
  if (placement.layout === 'modal') {
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl border border-gray-200 bg-black/40 p-4">
          <div
            className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl border-2 border-white/20 shadow-2xl"
            style={{ backgroundColor: formData.backgroundColor }}
          >
            <PositionedContent
              formData={formData}
              overlay={overlay}
              posCls={`${posCls} gap-1.5 p-5`}
            >
              {formData.subtitle && (
                <p
                  className="text-xs font-medium drop-shadow"
                  style={{ color: formData.textColor }}
                >
                  {formData.subtitle}
                </p>
              )}
              <p
                className="text-lg font-black leading-tight drop-shadow-lg"
                style={{ color: formData.textColor }}
              >
                {formData.title}
              </p>
              {formData.ctaText && (
                <span
                  className={cn(
                    'mt-1 inline-flex w-fit rounded-lg px-3 py-1.5 text-xs font-bold',
                    ctaCls
                  )}
                >
                  {formData.ctaText}
                </span>
              )}
            </PositionedContent>
            <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white">
              <PiX className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
        <Caption label={placement.label} />
      </div>
    );
  }

  // Hero / default — wide banner with positioned content
  return (
    <div className="space-y-2">
      <div
        className={`relative ${placement.aspect} overflow-hidden rounded-xl border border-gray-200`}
        style={{ backgroundColor: formData.backgroundColor }}
      >
        <PositionedContent
          formData={formData}
          overlay={overlay}
          posCls={`${posCls} gap-1.5 p-6`}
        >
          {formData.subtitle && (
            <p
              className="text-sm font-medium drop-shadow"
              style={{
                color: formData.textColor,
                textAlign: formData.textAlignment as any,
              }}
            >
              {formData.subtitle}
            </p>
          )}
          {formData.title && (
            <p
              className="text-xl font-black drop-shadow-lg"
              style={{
                color: formData.textColor,
                textAlign: formData.textAlignment as any,
              }}
            >
              {formData.title}
            </p>
          )}
          {formData.description && (
            <p
              className="line-clamp-2 max-w-xs text-xs drop-shadow"
              style={{
                color: formData.textColor
                  ? `${formData.textColor}b0`
                  : undefined,
                textAlign: formData.textAlignment as any,
              }}
            >
              {formData.description}
            </p>
          )}
          {formData.ctaText && (
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold shadow-lg',
                ctaCls
              )}
            >
              {formData.ctaText}
            </span>
          )}
        </PositionedContent>
      </div>
      <Caption label={placement.label} />
    </div>
  );
}
