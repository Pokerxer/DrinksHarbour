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
  CategoryFormInput,
  categoryFormSchema,
} from '@/validators/create-category.schema';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createCategory, updateCategory, getAdminCategories } from '@/services/category.service';
import { routes } from '@/config/routes';
import toast from 'react-hot-toast';
import { PiTrashBold, PiUploadSimpleBold } from 'react-icons/pi';

const QuillEditor = dynamic(() => import('@core/ui/quill-editor'), {
  ssr: false,
  loading: () => <QuillLoader className="col-span-full h-[168px]" />,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'beer', label: 'Beer' },
  { value: 'cider', label: 'Cider' },
  { value: 'wine', label: 'Wine' },
  { value: 'red_wine', label: 'Red Wine' },
  { value: 'white_wine', label: 'White Wine' },
  { value: 'rose_wine', label: 'Rosé Wine' },
  { value: 'sparkling_wine', label: 'Sparkling Wine' },
  { value: 'champagne', label: 'Champagne' },
  { value: 'fortified_wine', label: 'Fortified Wine' },
  { value: 'dessert_wine', label: 'Dessert Wine' },
  { value: 'whiskey', label: 'Whiskey' },
  { value: 'scotch', label: 'Scotch' },
  { value: 'bourbon', label: 'Bourbon' },
  { value: 'rye_whiskey', label: 'Rye Whiskey' },
  { value: 'vodka', label: 'Vodka' },
  { value: 'gin', label: 'Gin' },
  { value: 'rum', label: 'Rum' },
  { value: 'tequila', label: 'Tequila' },
  { value: 'brandy', label: 'Brandy' },
  { value: 'cognac', label: 'Cognac' },
  { value: 'soju', label: 'Soju' },
  { value: 'baijiu', label: 'Baijiu' },
  { value: 'shochu', label: 'Shochu' },
  { value: 'mezcal', label: 'Mezcal' },
  { value: 'liqueur', label: 'Liqueur' },
  { value: 'aperitif', label: 'Aperitif' },
  { value: 'digestif', label: 'Digestif' },
  { value: 'cocktail', label: 'Cocktail' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'tea', label: 'Tea' },
  { value: 'juice', label: 'Juice' },
  { value: 'soda', label: 'Soda' },
  { value: 'water', label: 'Water' },
  { value: 'milk', label: 'Milk' },
  { value: 'yogurt_drink', label: 'Yogurt Drink' },
  { value: 'soft_drink', label: 'Soft Drink' },
  { value: 'dairy_alternatives', label: 'Dairy Alternatives' },
  { value: 'functional_drink', label: 'Functional Drink' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'bitters', label: 'Bitters' },
  { value: 'glassware', label: 'Glassware' },
  { value: 'bar_tools', label: 'Bar Tools' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'gift_set', label: 'Gift Set' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'other', label: 'Other' },
];

const ALCOHOL_CATEGORY_OPTIONS = [
  { value: 'alcoholic', label: 'Alcoholic' },
  { value: 'non_alcoholic', label: 'Non-Alcoholic' },
  { value: 'low_alcohol', label: 'Low Alcohol' },
  { value: 'alcohol_free', label: 'Alcohol Free' },
  { value: 'mixed', label: 'Mixed' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'coming_soon', label: 'Coming Soon' },
];

const DEFAULT_SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name (A–Z)' },
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
              alt={label || 'Category image'}
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

export default function CreateCategory({
  id,
  category,
  currentImages,
  isModalView = true,
  onSuccess,
  aiDraft,
}: {
  id?: string;
  isModalView?: boolean;
  category?: CategoryFormInput;
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
  const [parentOptions, setParentOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'None (top-level)' },
  ]);
  const slugManuallyEdited = useRef(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string> | null>(null);

  async function triggerAiFill(name: string, type: string, alcoholCategory: string) {
    if (!name.trim()) { toast.error('Enter a category name first'); return; }
    setAiLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories/admin/ai-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, alcoholCategory }),
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
        const opts = [{ value: '', label: 'None (top-level)' }];
        categories
          .filter((c) => c._id !== id)
          .forEach((c) => opts.push({ value: c._id, label: c.name }));
        setParentOptions(opts);
      })
      .catch(() => {});
  }, [token, id]);

  const onSubmit: SubmitHandler<CategoryFormInput> = async (data) => {
    setLoading(true);
    try {
      const rawOrder = data.displayOrder;
      const formData = {
        name: data.name,
        slug: data.slug,
        type: data.type,
        displayName: data.displayName || '',
        tagline: data.tagline || '',
        subType: data.subType || '',
        alcoholCategory: data.alcoholCategory || 'alcoholic',
        description: data.description || '',
        shortDescription: data.shortDescription || '',
        status: data.status || 'draft',
        displayOrder: (rawOrder !== undefined && !isNaN(Number(rawOrder))) ? Number(rawOrder) : 999,
        parent: data.parentCategory || undefined,
        defaultSort: data.defaultSort || 'relevance',
        isFeatured: data.isFeatured ?? false,
        isTrending: data.isTrending ?? false,
        isPopular: data.isPopular ?? false,
        isNewArrival: data.isNewArrival ?? false,
        showInMenu: data.showInMenu ?? true,
        showOnHomepage: data.showOnHomepage ?? false,
        color: data.color || '#6B7280',
        icon: data.icon || '',
        notes: data.notes || '',
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
        metaKeywords: data.metaKeywords || '',
        canonicalUrl: data.canonicalUrl || '',
        thumbnailImageFile,
        featuredImageFile,
        bannerImageFile,
      };

      if (id) {
        await updateCategory(token, id, formData);
        toast.success('Category updated');
      } else {
        await createCategory(token, formData);
        toast.success('Category created');
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(routes.eCommerce.categories);
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<CategoryFormInput>
      validationSchema={categoryFormSchema}
      onSubmit={onSubmit}
      useFormProps={{
        mode: 'onChange',
        defaultValues: {
          status: 'draft',
          alcoholCategory: 'alcoholic',
          displayOrder: 999,
          isFeatured: false,
          isTrending: false,
          isPopular: false,
          isNewArrival: false,
          showInMenu: true,
          showOnHomepage: false,
          color: '#6B7280',
          ...category,
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
            if (k === 'name' || k === 'slug' || k === 'parentCategory') return;
            if (v === '' || v === null || v === undefined) return;
            setValue(k as any, v, { shouldValidate: true, shouldDirty: true });
          });
          setAiSuggestions(null);
        }, [aiSuggestions]);

        useEffect(() => {
          if (!aiDraft) return;
          slugManuallyEdited.current = true;
          const VALID_TYPES = TYPE_OPTIONS.map((o) => o.value);
          const VALID_ALCOHOL = ALCOHOL_CATEGORY_OPTIONS.map((o) => o.value);
          const VALID_STATUS = STATUS_OPTIONS.map((o) => o.value);
          const coerce = (f: string, v: any) => {
            if (f === 'type') return VALID_TYPES.includes(v) ? v : '';
            if (f === 'alcoholCategory') return VALID_ALCOHOL.includes(v) ? v : 'alcoholic';
            if (f === 'status') return VALID_STATUS.includes(v) ? v : 'draft';
            return v;
          };
          const fields = [
            'name', 'slug', 'displayName', 'tagline', 'shortDescription',
            'type', 'subType', 'alcoholCategory', 'description',
            'metaTitle', 'metaDescription', 'metaKeywords', 'canonicalUrl',
            'color', 'icon', 'status',
          ];
          fields.forEach((f) => {
            const v = aiDraft[f];
            if (v === undefined || v === null) return;
            const coerced = coerce(f, v);
            if (coerced === '') return;
            setValue(f as any, coerced, { shouldValidate: true, shouldDirty: true });
          });
          if (!aiDraft.type || !VALID_TYPES.includes(aiDraft.type)) {
            toast.error('AI did not return a valid Type — please select one before saving');
          }
          toast.success('AI draft applied — review and publish');
        }, [aiDraft]);

        return isModalView ? (
          // ── MODAL layout ────────────────────────────────────────────────────
          <>
            <div className="space-y-5 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Category Name *"
                  placeholder="e.g. Single Malt Whisky"
                  {...register('name')}
                  error={errors.name?.message}
                />
                <Input
                  label="Slug *"
                  placeholder="e.g. single-malt-whisky"
                  {...register('slug')}
                  error={errors.slug?.message}
                  onFocus={() => { slugManuallyEdited.current = true; }}
                />
                <Controller
                  name="type"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={TYPE_OPTIONS}
                      value={(() => { const found = TYPE_OPTIONS.find((o) => o.value === value); return found ?? ''; })()}
                      onChange={(opt: SelectOption) => onChange((opt as any).value)}
                      label="Type *"
                      placeholder="Select type"
                      error={errors?.type?.message}
                    />
                  )}
                />
                <Controller
                  name="alcoholCategory"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={ALCOHOL_CATEGORY_OPTIONS}
                      value={(() => { const found = ALCOHOL_CATEGORY_OPTIONS.find((o) => o.value === value); return found ?? ''; })()}
                      onChange={(opt: SelectOption) => onChange((opt as any).value)}
                      label="Alcohol Category"
                      placeholder="Select alcohol category"
                    />
                  )}
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
                    placeholder="Brief summary of the category…"
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
                {id ? 'Update' : 'Create'} Category
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
                    onClick={() => triggerAiFill(watch('name'), watch('type'), watch('alcoholCategory') || 'alcoholic')}
                    className="gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50"
                  >
                    {!aiLoading && <span>✨</span>}
                    {aiLoading ? 'Generating…' : 'Fill with AI'}
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                    <Input
                      label="Category Name *"
                      placeholder="e.g. Single Malt Whisky"
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
                      placeholder="e.g. single-malt-whisky"
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
                  <Controller
                    name="type"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={TYPE_OPTIONS}
                        value={(() => { const found = TYPE_OPTIONS.find((o) => o.value === value); return found ?? ''; })()}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Beverage Type *"
                        placeholder="Select type"
                        error={errors?.type?.message}
                      />
                    )}
                  />
                  <Controller
                    name="alcoholCategory"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={ALCOHOL_CATEGORY_OPTIONS}
                        value={(() => { const found = ALCOHOL_CATEGORY_OPTIONS.find((o) => o.value === value); return found ?? ''; })()}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Alcohol Category"
                        placeholder="Select alcohol category"
                      />
                    )}
                  />
                  <Input
                    label="Sub-type"
                    placeholder="e.g. Peated, Blended"
                    {...register('subType')}
                    error={errors.subType?.message}
                  />
                  <Controller
                    name="parentCategory"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={parentOptions}
                        value={(() => { const found = parentOptions.find((o) => o.value === value); return found ?? ''; })()}
                        onChange={(opt: SelectOption) => onChange((opt as any).value ?? '')}
                        label="Parent Category"
                        placeholder="None (top-level)"
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
                  <Controller
                    name="defaultSort"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={DEFAULT_SORT_OPTIONS}
                        value={(() => { const found = DEFAULT_SORT_OPTIONS.find((o) => o.value === value); return found ?? ''; })()}
                        onChange={(opt: SelectOption) => onChange((opt as any).value)}
                        label="Default Sort"
                        placeholder="Select sort order"
                      />
                    )}
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

              {/* SEO */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-1 font-semibold text-gray-800">SEO</Title>
                <Text className="mb-5 text-sm text-gray-400">
                  Optimise how this category appears in search engines.
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
                    placeholder="https://drinksharbour.com/shop/whisky"
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
                  placeholder="Any internal notes about this category…"
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
                    {id ? 'Update Category' : 'Publish Category'}
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
                    onClick={() => router.push(routes.eCommerce.categories)}
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
                        description="Mark as a popular category"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="isNewArrival"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="New Arrival"
                        description="Display new arrival badge"
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
                  <Controller
                    name="showOnHomepage"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Show on Homepage"
                        description="Display on the homepage"
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
