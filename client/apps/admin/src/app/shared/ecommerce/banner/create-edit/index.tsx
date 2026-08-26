// @ts-nocheck
'use client';

/**
 * Banner create/edit form — orchestrator.
 *
 * Owns form state + persistence; composition lives in sibling modules:
 * - placement/preview   → storefront-accurate live preview
 * - form-fields         → section shell, uploads, tags, AI sparkle
 * - form-sections-*     → the collapsible form sections
 * - use-banner-ai + ai/ → AI generator modal
 * See banner-details/ for the read-only view of a saved banner.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import { bannerService } from '@/services/banner.service';
import { Button } from 'rizzui';
import { PiSparkleBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import type { Banner, BannerFormData } from '@/types/banner.types';
import { useBannerAI } from './use-banner-ai';
import GenerateModal from './ai/generate-modal';
import { BannerPreview } from './preview';
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
import { FormSidebar } from './form-sidebar';

export const EMPTY_BANNER_FORM: BannerFormData = {
  title: '',
  subtitle: '',
  description: '',
  image: { url: '' },
  mobileImage: { url: '' },
  type: 'promotional',
  placement: 'home_hero',
  displayOrder: 0,
  priority: 'medium',
  ctaText: '',
  ctaLink: '',
  ctaStyle: 'primary',
  linkType: 'internal',
  imageClickable: true,
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  overlayOpacity: 0,
  imageFit: 'cover',
  gradientIntensity: 100,
  blurIntensity: 100,
  textAlignment: 'center',
  contentPosition: 'center',
  startDate: '',
  endDate: '',
  isScheduled: false,
  isActive: true,
  status: 'active',
  visibleTo: 'all',
  isGlobal: true,
  tags: [],
  notes: '',
};

interface CreateEditBannerProps {
  bannerId?: string;
  initialData?: Banner;
}

export default function CreateEditBanner({
  bannerId,
  initialData,
}: CreateEditBannerProps) {
  const router = useRouter();
  const { data: session }: any = useSession();
  const token = session?.token || session?.user?.token || '';

  const isEdit = !!bannerId;
  const [loading, setLoading] = useState(isEdit && !initialData);
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [formData, setFormData] = useState<BannerFormData>({
    ...EMPTY_BANNER_FORM,
  });
  const [deviceTargeting, setDeviceTargeting] = useState({
    desktop: true,
    mobile: true,
    tablet: true,
  });
  const [targetProduct, setTargetProduct] = useState<{
    _id: string;
    name: string;
  } | null>(null);
  const [targetCategory, setTargetCategory] = useState<{
    _id: string;
    name: string;
  } | null>(null);
  // Banner.targetBrand exists on the model but nothing ever set it — a
  // brand-targeted banner saved with no brand ref at all.
  const [targetBrand, setTargetBrand] = useState<{
    _id: string;
    name: string;
  } | null>(null);

  const set = useCallback((field: keyof BannerFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  }, []);

  const ai = useBannerAI({
    token,
    formData,
    setField: set,
    setTargetProduct,
    setTargetCategory,
    setTargetBrand,
  });

  useEffect(() => {
    if (bannerId && !initialData) {
      fetchBanner();
    } else if (initialData) {
      populateForm(initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerId, initialData]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  async function fetchBanner() {
    if (!token || !bannerId) return;
    try {
      const response = await bannerService.getBannerById(bannerId, token);
      if (response.success) {
        populateForm(response.data.banner || response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch banner');
      router.push(routes.eCommerce.banners);
    } finally {
      setLoading(false);
    }
  }

  function populateForm(data: Banner) {
    setFormData({
      title: data.title || '',
      subtitle: data.subtitle || '',
      description: data.description || '',
      image: data.image || { url: '' },
      mobileImage: data.mobileImage || { url: '' },
      type: data.type || 'promotional',
      placement: data.placement || 'home_hero',
      displayOrder: data.displayOrder || 0,
      priority: data.priority || 'medium',
      ctaText: data.ctaText || '',
      ctaLink: data.ctaLink || '',
      ctaStyle: data.ctaStyle || 'primary',
      linkType: data.linkType || 'internal',
      imageClickable: data.imageClickable ?? true,
      backgroundColor: data.backgroundColor || '#FFFFFF',
      textColor: data.textColor || '#000000',
      overlayOpacity: data.overlayOpacity || 0,
      imageFit: data.imageFit || 'cover',
      // `?? 100` not `|| 100` — a deliberate 0 must survive the round-trip.
      gradientIntensity: data.gradientIntensity ?? 100,
      blurIntensity: data.blurIntensity ?? 100,
      textAlignment: data.textAlignment || 'center',
      contentPosition: data.contentPosition || 'center',
      startDate: data.startDate
        ? new Date(data.startDate).toISOString().split('T')[0]
        : '',
      endDate: data.endDate
        ? new Date(data.endDate).toISOString().split('T')[0]
        : '',
      isScheduled: data.isScheduled || false,
      isActive: data.isActive ?? true,
      status: data.status || 'draft',
      visibleTo: data.visibleTo || 'all',
      isGlobal: data.isGlobal ?? false,
      tags: data.tags || [],
      notes: data.notes || '',
    });
    setDeviceTargeting(
      data.deviceTargeting || { desktop: true, mobile: true, tablet: true }
    );

    if (data.targetProduct) {
      const p = data.targetProduct as any;
      setTargetProduct({
        _id: typeof p === 'object' ? p.slug || p._id : p,
        name: typeof p === 'object' ? p.name || '' : '',
      });
    }
    if (data.targetCategory) {
      const c = data.targetCategory as any;
      setTargetCategory({
        _id: typeof c === 'object' ? c.slug || c._id : c,
        name: typeof c === 'object' ? c.name || '' : '',
      });
    }
    if ((data as any).targetBrand) {
      const b = (data as any).targetBrand;
      setTargetBrand({
        _id: typeof b === 'object' ? b._id || b.id : b,
        name: typeof b === 'object' ? b.name || '' : '',
      });
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.image?.url?.trim()) {
      toast.error('Banner image is required');
      return;
    }
    if (!token) {
      toast.error('Authentication required');
      return;
    }
    // Title is intentionally optional — text-free (image-only) banners are a
    // supported pattern; the server slugifies from placement + timestamp.

    setSubmitting(true);
    try {
      // targetProduct/targetCategory are ObjectId refs on the Banner model, but
      // the link selectors store a slug in _id to build the CTA URL. Only send
      // real ObjectIds so the save never fails casting a slug; the ctaLink
      // already carries the destination for slug-based targets.
      const isObjectId = (v?: string) => !!v && /^[a-f\d]{24}$/i.test(v);
      const payload = {
        ...formData,
        deviceTargeting,
        targetProduct: isObjectId(targetProduct?._id)
          ? targetProduct!._id
          : undefined,
        targetCategory: isObjectId(targetCategory?._id)
          ? targetCategory!._id
          : undefined,
        targetBrand: isObjectId(targetBrand?._id)
          ? targetBrand!._id
          : undefined,
      };
      const response =
        isEdit && bannerId
          ? await bannerService.updateBanner(bannerId, payload, token)
          : await bannerService.createBanner(payload, token);

      if (response.success) {
        toast.success(isEdit ? 'Banner updated' : 'Banner created');
        setHasUnsavedChanges(false);
        router.push(routes.eCommerce.banners);
      } else {
        toast.error(response.message || 'Failed to save banner');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save banner');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
          <div className="flex gap-2">
            <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-gray-100"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Banner' : 'Create New Banner'}
          </h2>
          {hasUnsavedChanges ? (
            <span className="mt-1 flex items-center gap-1.5 text-sm text-amber-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          ) : isEdit ? (
            <span className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              All changes saved
            </span>
          ) : (
            <p className="mt-1 text-sm text-gray-400">
              Fill in the details below to create a banner
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={ai.openModal}
            type="button"
            className="border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            <PiSparkleBold className="mr-2 h-4 w-4" />
            AI Generate
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(routes.eCommerce.banners)}
            type="button"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={submitting}
            className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]"
          >
            {isEdit ? 'Update Banner' : 'Create Banner'}
          </Button>
        </div>
      </div>

      {/* AI Generator modal */}
      <GenerateModal
        ai={ai}
        contextLabels={{
          product: ai.contextProducts.find(
            (p: any) => p.id === ai.contextData.productId
          )?.name,
          category: ai.contextCategories.find(
            (c: any) => c.id === ai.contextData.categoryId
          )?.name,
          subcategory: ai.contextSubcategories.find(
            (s: any) => s.id === ai.contextData.subcategoryId
          )?.name,
          brand: ai.contextBrands.find(
            (b: any) => b.id === ai.contextData.brandId
          )?.name,
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — form sections */}
        <div className="space-y-4 lg:col-span-2">
          <BasicInfoSection
            formData={formData}
            set={set}
            enhancingField={ai.enhancingField}
            onEnhanceField={ai.handleEnhanceField}
          />
          <ImagesSection formData={formData} set={set} token={token} />
          <CtaSection
            formData={formData}
            set={set}
            token={token}
            targetProduct={targetProduct ?? undefined}
            targetCategory={targetCategory ?? undefined}
            onProductSelect={setTargetProduct}
            onCategorySelect={setTargetCategory}
            enhancingField={ai.enhancingField}
            onEnhanceField={ai.handleEnhanceField}
          />
          <StylingSection formData={formData} set={set} />
          <SchedulingSection
            formData={formData}
            set={set}
            deviceTargeting={deviceTargeting}
            setDeviceTargeting={setDeviceTargeting}
          />
          <StatusVisibilitySection
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

        {/* Right column — live preview + quick info */}
        <div className="lg:col-span-1">
          <FormSidebar formData={formData} deviceTargeting={deviceTargeting} />
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(16,24,40,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm text-gray-500">
              {formData.title || 'Untitled banner'}
            </p>
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Unsaved
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:ms-auto">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(routes.eCommerce.banners)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              className="border-0 bg-[#b20202] text-white hover:bg-[#9f0101]"
            >
              {isEdit ? 'Update Banner' : 'Create Banner'}
            </Button>
          </div>
        </div>
      </div>
      <div className="h-16" />
    </form>
  );
}
