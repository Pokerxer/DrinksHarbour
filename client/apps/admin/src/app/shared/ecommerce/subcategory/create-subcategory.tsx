// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Controller, type SubmitHandler } from 'react-hook-form';
import QuillLoader from '@core/components/loader/quill-loader';
import { Button, Input, Select, Switch, Text, Title, Textarea, type SelectOption } from 'rizzui';
import cn from '@core/utils/class-names';
import { Form } from '@core/ui/form';
import {
  SubCategoryFormInput,
  subCategoryFormSchema,
} from '@/validators/create-subcategory.schema';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createSubCategory, updateSubCategory } from '@/services/subcategory.service';
import { getAdminCategories } from '@/services/category.service';
import { routes } from '@/config/routes';
import toast from 'react-hot-toast';
import { PiTrashBold, PiUploadSimpleBold } from 'react-icons/pi';

const QuillEditor = dynamic(() => import('@core/ui/quill-editor'), {
  ssr: false,
  loading: () => <QuillLoader className="col-span-full h-[168px]" />,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  { value: 'traditional', label: 'Traditional' },
  { value: 'modern', label: 'Modern' },
  { value: 'craft', label: 'Craft' },
  { value: 'artisanal', label: 'Artisanal' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'budget', label: 'Budget' },
  { value: 'mid_range', label: 'Mid Range' },
  { value: 'classic', label: 'Classic' },
  { value: 'innovative', label: 'Innovative' },
  { value: 'experimental', label: 'Experimental' },
  { value: 'organic', label: 'Organic' },
  { value: 'natural', label: 'Natural' },
  { value: 'biodynamic', label: 'Biodynamic' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'coming_soon', label: 'Coming Soon' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── ImagePicker ─────────────────────────────────────────────────────────────

function ImagePicker({
  label,
  currentUrl,
  onFile,
  onClear,
}: {
  label?: string;
  currentUrl?: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }

  function handleClear() {
    setPreview(null);
    onClear();
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      {label && <Text className="text-sm font-medium text-gray-700">{label}</Text>}
      {preview ? (
        <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div className="relative aspect-video w-full">
            <img
              src={preview}
              alt={label || 'SubCategory image'}
              className="h-full w-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:bg-red-50 hover:text-red-500"
          >
            <PiTrashBold className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-7 transition hover:border-primary hover:bg-primary/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <PiUploadSimpleBold className="h-4 w-4 text-gray-400" />
          </div>
          <div className="text-center">
            <Text className="text-xs font-medium text-gray-600">Click to upload</Text>
            <Text className="text-xs text-gray-400">PNG, JPG or WEBP</Text>
          </div>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ─── VisibilityToggle ─────────────────────────────────────────────────────────

function VisibilityToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 flex-1 pr-4">
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
        {description && <Text className="text-xs text-gray-400">{description}</Text>}
      </div>
      <Switch
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CreateSubCategory({
  id,
  subcategory,
  currentImages,
  isModalView = true,
  onSuccess,
  aiDraft,
}: {
  id?: string;
  isModalView?: boolean;
  subcategory?: SubCategoryFormInput;
  currentImages?: { thumbnail?: string; featured?: string; banner?: string };
  onSuccess?: () => void;
  aiDraft?: any;
}) {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;
  const router = useRouter();

  const [isLoading, setLoading] = useState(false);
  const [thumbnailImageFile, setThumbnailImageFile] = useState<File | null>(null);
  const [featuredImageFile, setFeaturedImageFile] = useState<File | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [parentOptions, setParentOptions] = useState<{ value: string; label: string }[]>([]);
  const slugManuallyEdited = useRef(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string> | null>(null);

  async function triggerAiFill(name: string, type: string, parentValue: string) {
    if (!name.trim()) { toast.error('Enter a subcategory name first'); return; }
    setAiLoading(true);
    try {
      const parentName = parentOptions.find((o) => o.value === parentValue)?.label || '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subcategories/admin/ai-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, parentName }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setAiSuggestions(json.data);
      const filled = Object.values(json.data || {}).filter(Boolean).length;
      toast.success(`${filled} fields filled with AI suggestions`);
    } catch (err: any) {
      toast.error(err.message || 'AI fill failed');
    } finally {
      setAiLoading(false);
    }
  }

  // Load parent categories
  useEffect(() => {
    if (!token) return;
    getAdminCategories(token)
      .then(({ categories }) => {
        const opts = categories.map((c) => ({ value: c._id, label: c.name }));
        setParentOptions(opts);
      })
      .catch(() => {});
  }, [token]);

  const onSubmit: SubmitHandler<SubCategoryFormInput> = async (data) => {
    setLoading(true);
    try {
      const rawOrder = data.displayOrder;
      const formData = {
        name: data.name,
        slug: data.slug,
        parent: data.parent,
        type: data.type || '',
        subType: data.subType || '',
        style: data.style || '',
        displayName: data.displayName || '',
        tagline: data.tagline || '',
        description: data.description || '',
        shortDescription: data.shortDescription || '',
        status: data.status || 'draft',
        displayOrder: (rawOrder !== undefined && !isNaN(Number(rawOrder))) ? Number(rawOrder) : 999,
        isFeatured: data.isFeatured ?? false,
        isTrending: data.isTrending ?? false,
        isPopular: data.isPopular ?? false,
        showInMenu: data.showInMenu ?? true,
        color: data.color || '#6B7280',
        icon: data.icon || '',
        notes: data.notes || '',
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
        metaKeywords: data.metaKeywords || '',
        canonicalUrl: data.canonicalUrl || '',
        typicalFlavors: data.typicalFlavors || '',
        commonPairings: data.commonPairings || '',
        seasonalSpring: data.seasonalSpring ?? false,
        seasonalSummer: data.seasonalSummer ?? false,
        seasonalFall: data.seasonalFall ?? false,
        seasonalWinter: data.seasonalWinter ?? false,
        thumbnailImageFile,
        featuredImageFile,
        bannerImageFile,
      };

      if (id) {
        await updateSubCategory(token, id, formData);
        toast.success('SubCategory updated');
      } else {
        await createSubCategory(token, formData);
        toast.success('SubCategory created');
        window.dispatchEvent(new Event('subcategory-created'));
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(routes.eCommerce.subCategories);
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<SubCategoryFormInput>
      validationSchema={subCategoryFormSchema}
      onSubmit={onSubmit}
      useFormProps={{
        mode: 'onChange',
        defaultValues: {
          status: 'draft',
          displayOrder: 999,
          isFeatured: false,
          isTrending: false,
          isPopular: false,
          showInMenu: true,
          seasonalSpring: false,
          seasonalSummer: false,
          seasonalFall: false,
          seasonalWinter: false,
          color: '#6B7280',
          ...subcategory,
        },
      }}
      className="isomorphic-form flex flex-grow flex-col @container"
    >
      {({ register, control, watch, setValue, formState: { errors } }) => {
        const nameValue = watch('name');
        const colorValue = watch('color') || '#6B7280';
        const shortDescValue = watch('shortDescription') || '';

        // Auto-generate slug from name unless manually edited
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (!slugManuallyEdited.current && nameValue && !id) {
            setValue('slug', slugify(nameValue), { shouldValidate: false });
          }
        }, [nameValue]);

        // Apply AI suggestions when available (never touch name/slug/parent)
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (!aiSuggestions) return;
          Object.entries(aiSuggestions).forEach(([k, v]) => {
            if (k === 'name' || k === 'slug' || k === 'parent') return;
            if (v === '' || v === null || v === undefined) return;
            setValue(k as any, v, { shouldValidate: true, shouldDirty: true });
          });
          setAiSuggestions(null);
        }, [aiSuggestions]);

        useEffect(() => {
          if (!aiDraft) return;
          slugManuallyEdited.current = true;
          const fields = [
            'name', 'slug', 'parent', 'displayName', 'tagline', 'shortDescription',
            'type', 'subType', 'style', 'description',
            'typicalFlavors', 'commonPairings',
            'seasonalSpring', 'seasonalSummer', 'seasonalFall', 'seasonalWinter',
            'metaTitle', 'metaDescription', 'metaKeywords', 'canonicalUrl',
            'color', 'icon', 'status',
          ];
          fields.forEach((f) => {
            if (aiDraft[f] === undefined || aiDraft[f] === null || aiDraft[f] === '') return;
            setValue(f as any, aiDraft[f], { shouldValidate: true, shouldDirty: true });
          });
          toast.success('AI draft applied — review and publish');
        }, [aiDraft]);

        return isModalView ? (
          // ── MODAL layout ────────────────────────────────────────────────────
          <>
            <div className="space-y-5 pb-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Parent Category — required, shown first */}
                <div className="col-span-2">
                  <Controller
                    name="parent"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={parentOptions}
                        value={(() => { const found = parentOptions.find((o) => o.value === value); return found ?? ''; })()}
                        onChange={(opt: SelectOption) => onChange((opt as any).value ?? '')}
                        label="Parent Category *"
                        placeholder="Select parent category"
                        error={errors?.parent?.message}
                      />
                    )}
                  />
                </div>
                <Input
                  label="SubCategory Name *"
                  placeholder="e.g. Single Malt"
                  {...register('name')}
                  error={errors.name?.message}
                />
                <Input
                  label="Slug *"
                  placeholder="e.g. single-malt"
                  {...register('slug')}
                  error={errors.slug?.message}
                  onFocus={() => { slugManuallyEdited.current = true; }}
                />
                <Controller
                  name="status"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={STATUS_OPTIONS}
                      value={(() => { const found = STATUS_OPTIONS.find((o) => o.value === value); return found ?? ''; })()}
                      onChange={(opt: SelectOption) => onChange((opt as any).value)}
                      label="Status"
                      placeholder="Select status"
                    />
                  )}
                />
                <div className="col-span-2">
                  <Text className="mb-1 block text-sm font-medium text-gray-700">
                    Short Description{' '}
                    <span className="text-gray-400 font-normal">({shortDescValue.length}/280)</span>
                  </Text>
                  <textarea
                    {...register('shortDescription')}
                    placeholder="Brief summary of the subcategory…"
                    rows={3}
                    maxLength={280}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <Text className="mb-2 block text-sm font-medium text-gray-700">Thumbnail Image</Text>
                  <ImagePicker
                    currentUrl={currentImages?.thumbnail}
                    onFile={(f) => setThumbnailImageFile(f)}
                    onClear={() => setThumbnailImageFile(null)}
                  />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 z-40 -mx-5 flex items-center justify-end gap-3 border-t border-gray-100 bg-white/90 px-5 py-4 backdrop-blur">
              <Button variant="outline" type="button" onClick={onSuccess}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {id ? 'Update' : 'Create'} SubCategory
              </Button>
            </div>
          </>
        ) : (
          // ── FULL PAGE layout ─────────────────────────────────────────────────
          <div className="flex gap-6 @5xl:gap-7">
            {/* ── Left column (main content) ── */}
            <div className="min-w-0 flex-1 space-y-6">

              {/* Basic Information */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-5 flex items-center justify-between">
                  <Title as="h5" className="font-semibold text-gray-800">Basic Information</Title>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={aiLoading}
                    disabled={aiLoading}
                    onClick={() => triggerAiFill(watch('name'), watch('type') || '', watch('parent') || '')}
                    className="gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50"
                  >
                    {!aiLoading && <span>✨</span>}
                    {aiLoading ? 'Generating…' : 'Fill with AI'}
                  </Button>
                </div>
                <div className="space-y-4">
                  {/* Parent Category — required, first field */}
                  <div>
                    <Controller
                      name="parent"
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <Select
                          options={parentOptions}
                          value={(() => { const found = parentOptions.find((o) => o.value === value); return found ?? ''; })()}
                          onChange={(opt: SelectOption) => onChange((opt as any).value ?? '')}
                          label="Parent Category *"
                          placeholder="Select parent category"
                          error={errors?.parent?.message}
                        />
                      )}
                    />
                    <Text className="mt-1 text-xs text-gray-400">
                      Required. Every subcategory must belong to a parent category.
                    </Text>
                  </div>
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                    <Input
                      label="SubCategory Name *"
                      placeholder="e.g. Single Malt"
                      {...register('name')}
                      error={errors.name?.message}
                    />
                    <Input
                      label="Display Name"
                      placeholder="e.g. Single Malt Whiskies"
                      {...register('displayName')}
                      error={errors.displayName?.message}
                    />
                  </div>
                  <div>
                    <Input
                      label="Slug *"
                      placeholder="e.g. single-malt"
                      {...register('slug')}
                      error={errors.slug?.message}
                      prefix={<span className="text-gray-400 text-sm">/</span>}
                      onFocus={() => { slugManuallyEdited.current = true; }}
                    />
                    <Text className="mt-1.5 text-xs text-gray-400">
                      Auto-generated from name. Edit to customise. Lowercase letters, numbers and hyphens only.
                    </Text>
                  </div>
                  <Input
                    label="Tagline"
                    placeholder="e.g. The finest single malts from Scotland"
                    {...register('tagline')}
                    error={errors.tagline?.message}
                  />
                </div>
              </div>

              {/* Classification */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">Classification</Title>
                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <Input
                    label="Type"
                    placeholder="e.g. Scotch, Bourbon, IPA…"
                    {...register('type')}
                    error={errors.type?.message}
                  />
                  <Input
                    label="Sub-type"
                    placeholder="e.g. Peated, Blended"
                    {...register('subType')}
                    error={errors.subType?.message}
                  />
                  <Controller
                    name="style"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={STYLE_OPTIONS}
                        value={(() => { const found = STYLE_OPTIONS.find((o) => o.value === value); return found ?? ''; })()}
                        onChange={(opt: SelectOption) => onChange((opt as any).value ?? '')}
                        label="Style"
                        placeholder="Select style"
                        error={errors?.style?.message}
                      />
                    )}
                  />
                  <Input
                    label="Display Order"
                    type="number"
                    placeholder="999"
                    {...register('displayOrder', {
                      setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? 999 : Number(v)),
                    })}
                    error={errors.displayOrder?.message}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">Description</Title>
                <div className="space-y-4">
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">
                      Short Description{' '}
                      <span className="font-normal text-gray-400">({shortDescValue.length}/280)</span>
                    </Text>
                    <textarea
                      {...register('shortDescription')}
                      placeholder="A brief summary shown in listings and cards…"
                      rows={3}
                      maxLength={280}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {errors.shortDescription?.message && (
                      <Text className="mt-1 text-xs text-red-500">{errors.shortDescription.message}</Text>
                    )}
                  </div>
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">Full Description</Text>
                    <Controller
                      control={control}
                      name="description"
                      render={({ field: { onChange, value } }) => (
                        <QuillEditor
                          value={value}
                          onChange={onChange}
                          className="[&>.ql-container_.ql-editor]:min-h-[160px]"
                          labelClassName="font-medium text-gray-700 dark:text-gray-600 mb-1.5"
                        />
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Flavors & Pairings */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-1 font-semibold text-gray-800">Flavors & Pairings</Title>
                <Text className="mb-5 text-sm text-gray-400">
                  Help customers discover and understand this subcategory.
                </Text>
                <div className="space-y-4">
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">Typical Flavors</Text>
                    <textarea
                      {...register('typicalFlavors')}
                      placeholder="e.g. vanilla, oak, dried fruit, smoke, honey…"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Text className="mt-1 text-xs text-gray-400">Separate with commas.</Text>
                  </div>
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">Common Pairings</Text>
                    <textarea
                      {...register('commonPairings')}
                      placeholder="e.g. dark chocolate, cheese, cigars, steak…"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Text className="mt-1 text-xs text-gray-400">Separate with commas.</Text>
                  </div>
                </div>
              </div>

              {/* SEO */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-1 font-semibold text-gray-800">SEO</Title>
                <Text className="mb-5 text-sm text-gray-400">
                  Optimise how this subcategory appears in search engines.
                </Text>
                <div className="space-y-4">
                  <Input
                    label="Meta Title"
                    placeholder="e.g. Buy Single Malt Whisky Online | DrinksHarbour"
                    {...register('metaTitle')}
                    error={errors.metaTitle?.message}
                  />
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">Meta Description</Text>
                    <textarea
                      {...register('metaDescription')}
                      placeholder="A short description for search engines (up to 320 characters)…"
                      rows={3}
                      maxLength={320}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <Input
                      label="Meta Keywords"
                      placeholder="e.g. whisky, scotch, single malt, premium spirits"
                      {...register('metaKeywords')}
                      error={errors.metaKeywords?.message}
                    />
                    <Text className="mt-1 text-xs text-gray-400">Separate keywords with commas.</Text>
                  </div>
                  <Input
                    label="Canonical URL"
                    placeholder="https://drinksharbour.com/shop/single-malt"
                    {...register('canonicalUrl')}
                    error={errors.canonicalUrl?.message}
                  />
                </div>
              </div>

              {/* Admin Notes */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-1 font-semibold text-gray-800">Admin Notes</Title>
                <Text className="mb-4 text-sm text-gray-400">Internal notes — not shown to customers.</Text>
                <textarea
                  {...register('notes')}
                  placeholder="Any internal notes about this subcategory…"
                  rows={3}
                  maxLength={1000}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* ── Right sidebar ── */}
            <div className="w-72 flex-shrink-0 space-y-6 @5xl:w-80">

              {/* Publish panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-4 font-semibold text-gray-800">Publish</Title>
                <div className="mb-4">
                  <Controller
                    name="status"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={STATUS_OPTIONS}
                        value={(() => { const found = STATUS_OPTIONS.find((o) => o.value === value); return found ?? ''; })()}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Status"
                        placeholder="Select status"
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="submit" isLoading={isLoading} className="w-full">
                    {id ? 'Update SubCategory' : 'Publish SubCategory'}
                  </Button>
                  {!id && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      isLoading={isLoading}
                      onClick={() => {
                        setValue('status', 'draft');
                        setTimeout(() => {
                          (document.querySelector('.isomorphic-form') as HTMLFormElement)?.requestSubmit();
                        }, 50);
                      }}
                    >
                      Save as Draft
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="flat"
                    className="w-full"
                    onClick={() => router.push(routes.eCommerce.subCategories)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              {/* Images panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-4 font-semibold text-gray-800">Images</Title>
                <div className="space-y-5">
                  <ImagePicker
                    label="Thumbnail"
                    currentUrl={currentImages?.thumbnail}
                    onFile={(f) => setThumbnailImageFile(f)}
                    onClear={() => setThumbnailImageFile(null)}
                  />
                  <ImagePicker
                    label="Featured Image"
                    currentUrl={currentImages?.featured}
                    onFile={(f) => setFeaturedImageFile(f)}
                    onClear={() => setFeaturedImageFile(null)}
                  />
                  <ImagePicker
                    label="Banner Image"
                    currentUrl={currentImages?.banner}
                    onFile={(f) => setBannerImageFile(f)}
                    onClear={() => setBannerImageFile(null)}
                  />
                </div>
              </div>

              {/* Visibility panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-2 font-semibold text-gray-800">Visibility</Title>
                <div className="divide-y divide-gray-100">
                  <Controller
                    name="isFeatured"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Featured"
                        description="Highlight in featured sections"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="isTrending"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Trending"
                        description="Show in trending lists"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="isPopular"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Popular"
                        description="Mark as a popular subcategory"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="showInMenu"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Show in Menu"
                        description="Include in navigation menu"
                        checked={value !== undefined ? !!value : true}
                        onChange={onChange}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Seasonal panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-2 font-semibold text-gray-800">Seasonal</Title>
                <Text className="mb-3 text-xs text-gray-400">Mark seasons when this subcategory is especially relevant.</Text>
                <div className="divide-y divide-gray-100">
                  <Controller
                    name="seasonalSpring"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Spring"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="seasonalSummer"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Summer"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="seasonalFall"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Fall / Autumn"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="seasonalWinter"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Winter"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Appearance panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-4 font-semibold text-gray-800">Appearance</Title>
                <div className="space-y-4">
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">Accent Colour</Text>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colorValue}
                        onChange={(e) => setValue('color', e.target.value)}
                        className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                      />
                      <input
                        type="text"
                        value={colorValue}
                        onChange={(e) => setValue('color', e.target.value)}
                        placeholder="#6B7280"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        maxLength={7}
                      />
                    </div>
                    {errors.color?.message && (
                      <Text className="mt-1 text-xs text-red-500">{errors.color.message}</Text>
                    )}
                  </div>
                  <Input
                    label="Icon (emoji or text)"
                    placeholder="e.g. 🥃 or whisky-icon"
                    {...register('icon')}
                    error={errors.icon?.message}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </Form>
  );
}
