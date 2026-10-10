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
import { useAuthorization } from '@/hooks/use-authorization';
import {
  EMPTY_BANNER_FORM,
  bannerFormValues,
  bannerLinkedTarget,
} from './form-data';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import { bannerService } from '@/services/banner.service';
import BannerSaveBar from './save-bar';
import { BannerFormHeader, BannerFormLoading } from './form-chrome';
import toast from 'react-hot-toast';
import type { Banner, BannerFormData } from '@/types/banner.types';
import { useBannerAI } from './use-banner-ai';
import GenerateModal from './ai/generate-modal';
import BannerEditorSections from './editor-sections';
import { FormSidebar } from './form-sidebar';

interface CreateEditBannerProps {
  bannerId?: string;
  initialData?: Banner;
}

export default function CreateEditBanner({
  bannerId,
  initialData,
}: CreateEditBannerProps) {
  const router = useRouter();
  const { role } = useAuthorization();
  const canManageGlobal = ['super_admin', 'admin'].includes(role);
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
  }, [bannerId, initialData, token]);

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
    setFormData(bannerFormValues(data));
    setDeviceTargeting(
      data.deviceTargeting || { desktop: true, mobile: true, tablet: true }
    );

    setTargetProduct(
      bannerLinkedTarget(
        data.targetProduct,
        data.linkType,
        'product',
        data.ctaLink || ''
      )
    );
    setTargetCategory(
      bannerLinkedTarget(
        data.targetCategory,
        data.linkType,
        'category',
        data.ctaLink || ''
      )
    );
    setTargetBrand(
      bannerLinkedTarget(
        data.targetBrand,
        data.linkType,
        'brand',
        data.ctaLink || ''
      )
    );
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
        isGlobal: canManageGlobal && formData.isGlobal,
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

  if (loading) return <BannerFormLoading />;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!canManageGlobal && (
        <p className="rounded-xl border border-muted bg-white p-4 text-sm text-gray-600">
          Create banners for your store. Active banners are available to your
          website through the storefront API.{' '}
          <a
            className="font-semibold text-primary underline"
            href="/settings/api-keys/documentation#banners"
          >
            View API guide
          </a>
        </p>
      )}
      <BannerFormHeader
        isEdit={isEdit}
        hasUnsavedChanges={hasUnsavedChanges}
        submitting={submitting}
        onGenerate={ai.openModal}
        onCancel={() => router.push(routes.eCommerce.banners)}
      />

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
        <BannerEditorSections
          formData={formData}
          set={set}
          token={token}
          targetProduct={targetProduct ?? undefined}
          targetCategory={targetCategory ?? undefined}
          targetBrand={targetBrand ?? undefined}
          onProductSelect={setTargetProduct}
          onCategorySelect={setTargetCategory}
          onBrandSelect={setTargetBrand}
          enhancingField={ai.enhancingField}
          onEnhanceField={ai.handleEnhanceField}
          deviceTargeting={deviceTargeting}
          setDeviceTargeting={setDeviceTargeting}
          canManageGlobal={canManageGlobal}
        />

        {/* Right column — live preview + quick info */}
        <div className="lg:col-span-1">
          <FormSidebar formData={formData} deviceTargeting={deviceTargeting} />
        </div>
      </div>

      <BannerSaveBar
        title={formData.title}
        hasUnsavedChanges={hasUnsavedChanges}
        submitting={submitting}
        isEdit={isEdit}
        onCancel={() => router.push(routes.eCommerce.banners)}
      />
      <div className="h-16" />
    </form>
  );
}
