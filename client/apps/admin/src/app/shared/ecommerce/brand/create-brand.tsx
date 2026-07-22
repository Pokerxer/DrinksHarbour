// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Controller, type SubmitHandler } from 'react-hook-form';
import QuillLoader from '@core/components/loader/quill-loader';
import {
  Button,
  Input,
  Select,
  Switch,
  Text,
  Title,
  Textarea,
  type SelectOption,
} from 'rizzui';
import { Form } from '@core/ui/form';
import {
  BrandFormInput,
  brandFormSchema,
} from '@/validators/create-brand.schema';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createBrand, updateBrand } from '@/services/brand.service';
import { routes } from '@/config/routes';
import toast from 'react-hot-toast';
import { PiTrashBold, PiUploadSimpleBold } from 'react-icons/pi';

const QuillEditor = dynamic(() => import('@core/ui/quill-editor'), {
  ssr: false,
  loading: () => <QuillLoader className="col-span-full h-[168px]" />,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_TYPE_OPTIONS = [
  { value: 'brewery', label: 'Brewery' },
  { value: 'microbrewery', label: 'Microbrewery' },
  { value: 'craft_brewery', label: 'Craft Brewery' },
  { value: 'brewpub', label: 'Brewpub' },
  { value: 'winery', label: 'Winery' },
  { value: 'vineyard', label: 'Vineyard' },
  { value: 'wine_estate', label: 'Wine Estate' },
  { value: 'distillery', label: 'Distillery' },
  { value: 'craft_distillery', label: 'Craft Distillery' },
  { value: 'spirits_producer', label: 'Spirits Producer' },
  { value: 'beverage_company', label: 'Beverage Company' },
  { value: 'drinks_manufacturer', label: 'Drinks Manufacturer' },
  { value: 'coffee_roaster', label: 'Coffee Roaster' },
  { value: 'tea_company', label: 'Tea Company' },
  { value: 'soft_drink_manufacturer', label: 'Soft Drink Manufacturer' },
  { value: 'water_brand', label: 'Water Brand' },
  { value: 'importer', label: 'Importer' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'private_label', label: 'Private Label' },
  { value: 'house_brand', label: 'House Brand' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'premium', label: 'Premium' },
  { value: 'mass_market', label: 'Mass Market' },
  { value: 'champagne_house', label: 'Champagne House' },
  { value: 'coffee_company', label: 'Coffee Company' },
  { value: 'juice_company', label: 'Juice Company' },
  { value: 'other', label: 'Other' },
];

const PRIMARY_CATEGORY_OPTIONS = [
  { value: 'beer', label: 'Beer' },
  { value: 'wine', label: 'Wine' },
  { value: 'spirits', label: 'Spirits' },
  { value: 'liqueurs', label: 'Liqueurs' },
  { value: 'cocktails', label: 'Cocktails' },
  { value: 'champagne', label: 'Champagne' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'tea', label: 'Tea' },
  { value: 'soft_drinks', label: 'Soft Drinks' },
  { value: 'water', label: 'Water' },
  { value: 'juice', label: 'Juice' },
  { value: 'energy_drinks', label: 'Energy Drinks' },
  { value: 'sports_drinks', label: 'Sports Drinks' },
  { value: 'mixers', label: 'Mixers' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'multi_category', label: 'Multi-Category' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'archived', label: 'Archived' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── ImagePicker ──────────────────────────────────────────────────────────────

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
      {label && (
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
      )}
      {preview ? (
        <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div className="relative aspect-video w-full">
            <img
              src={preview}
              alt={label || 'Brand image'}
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
            <Text className="text-xs font-medium text-gray-600">
              Click to upload
            </Text>
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
        {description && (
          <Text className="text-xs text-gray-400">{description}</Text>
        )}
      </div>
      <Switch
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

// ─── ColorPicker ──────────────────────────────────────────────────────────────

function ColorInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const safe = value || '#6B7280';
  return (
    <div>
      <Text className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </Text>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border border-gray-200 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6B7280"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={7}
        />
      </div>
      {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CreateBrand({
  id,
  brand,
  currentImages,
  isModalView = true,
  onSuccess,
}: {
  id?: string;
  isModalView?: boolean;
  brand?: BrandFormInput;
  currentImages?: { logo?: string; featured?: string; banner?: string };
  onSuccess?: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string;
  const router = useRouter();

  const [isLoading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [featuredImageFile, setFeaturedImageFile] = useState<File | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const slugManuallyEdited = useRef(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<
    string,
    string
  > | null>(null);

  async function triggerAiFill(
    name: string,
    brandType: string,
    primaryCategory: string,
    countryOfOrigin: string
  ) {
    if (!name.trim()) {
      toast.error('Enter a brand name first');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/brands/admin/ai-fill`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            brandType,
            primaryCategory,
            countryOfOrigin,
          }),
        }
      );
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

  const onSubmit: SubmitHandler<BrandFormInput> = async (data) => {
    setLoading(true);
    try {
      const formData = {
        name: data.name,
        slug: data.slug,
        legalName: data.legalName || '',
        tradingAs: data.tradingAs || '',
        description: data.description || '',
        shortDescription: data.shortDescription || '',
        tagline: data.tagline || '',
        story: data.story || '',
        founded: data.founded !== undefined ? Number(data.founded) : undefined,
        founderName: data.founderName || '',
        brandType: data.brandType || undefined,
        primaryCategory: data.primaryCategory || undefined,
        specializations: data.specializations || '',
        countryOfOrigin: data.countryOfOrigin || '',
        region: data.region || '',
        hqCity: data.hqCity || '',
        hqCountry: data.hqCountry || '',
        website: data.website || '',
        email: data.email || '',
        phone: data.phone || '',
        socialFacebook: data.socialFacebook || '',
        socialInstagram: data.socialInstagram || '',
        socialTwitter: data.socialTwitter || '',
        socialYoutube: data.socialYoutube || '',
        socialLinkedin: data.socialLinkedin || '',
        socialTiktok: data.socialTiktok || '',
        brandColorPrimary: data.brandColorPrimary || '',
        brandColorSecondary: data.brandColorSecondary || '',
        brandColorAccent: data.brandColorAccent || '',
        status: data.status || 'active',
        isFeatured: data.isFeatured ?? false,
        isPopular: data.isPopular ?? false,
        isTrending: data.isTrending ?? false,
        isPremium: data.isPremium ?? false,
        isCraft: data.isCraft ?? false,
        isLocal: data.isLocal ?? false,
        verified: data.verified ?? false,
        displayOrder: data.displayOrder ?? 999,
        metaTitle: data.metaTitle || '',
        seoH1: data.seoH1 || '',
        metaDescription: data.metaDescription || '',
        metaKeywords: data.metaKeywords || '',
        canonicalUrl: data.canonicalUrl || '',
        notes: data.notes || '',
        logoFile,
        featuredImageFile,
        bannerImageFile,
      };

      if (id) {
        await updateBrand(token, id, formData);
        toast.success('Brand updated');
      } else {
        await createBrand(token, formData);
        toast.success('Brand created');
        window.dispatchEvent(new Event('brand-created'));
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(routes.eCommerce.brands);
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<BrandFormInput>
      validationSchema={brandFormSchema}
      onSubmit={onSubmit}
      useFormProps={{
        mode: 'onChange',
        defaultValues: {
          status: 'active',
          displayOrder: 999,
          isFeatured: false,
          isPopular: false,
          isTrending: false,
          isPremium: false,
          isCraft: false,
          isLocal: false,
          verified: false,
          brandColorPrimary: '',
          brandColorSecondary: '',
          brandColorAccent: '',
          ...brand,
        },
      }}
      className="isomorphic-form flex flex-grow flex-col @container"
    >
      {({ register, control, watch, setValue, formState: { errors } }) => {
        const nameValue = watch('name');
        const shortDescValue = watch('shortDescription') || '';
        const colorPrimary = watch('brandColorPrimary') || '';
        const colorSecondary = watch('brandColorSecondary') || '';
        const colorAccent = watch('brandColorAccent') || '';

        // Auto-generate slug from name unless manually edited
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (!slugManuallyEdited.current && nameValue && !id) {
            setValue('slug', slugify(nameValue), { shouldValidate: false });
          }
        }, [nameValue]);

        // Apply AI suggestions when available (never touch name/slug)
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (!aiSuggestions) return;
          Object.entries(aiSuggestions).forEach(([k, v]) => {
            if (k === 'name' || k === 'slug') return;
            if (v === '' || v === null || v === undefined) return;
            setValue(k as any, v, { shouldValidate: true, shouldDirty: true });
          });
          setAiSuggestions(null);
        }, [aiSuggestions]);

        return isModalView ? (
          // ── MODAL layout ──────────────────────────────────────────────────
          <>
            <div className="space-y-5 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Brand Name *"
                  placeholder="e.g. Glenfiddich"
                  {...register('name')}
                  error={errors.name?.message}
                />
                <Input
                  label="Slug *"
                  placeholder="e.g. glenfiddich"
                  {...register('slug')}
                  error={errors.slug?.message}
                  onFocus={() => {
                    slugManuallyEdited.current = true;
                  }}
                />
                <Controller
                  name="brandType"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={BRAND_TYPE_OPTIONS}
                      value={
                        BRAND_TYPE_OPTIONS.find((o) => o.value === value) ?? ''
                      }
                      onChange={(opt: SelectOption) =>
                        onChange((opt as any).value)
                      }
                      label="Brand Type"
                      placeholder="Select brand type"
                    />
                  )}
                />
                <Controller
                  name="primaryCategory"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={PRIMARY_CATEGORY_OPTIONS}
                      value={
                        PRIMARY_CATEGORY_OPTIONS.find(
                          (o) => o.value === value
                        ) ?? ''
                      }
                      onChange={(opt: SelectOption) =>
                        onChange((opt as any).value)
                      }
                      label="Primary Category"
                      placeholder="Select category"
                    />
                  )}
                />
                <Controller
                  name="status"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Select
                      options={STATUS_OPTIONS}
                      value={
                        STATUS_OPTIONS.find((o) => o.value === value) ??
                        STATUS_OPTIONS[0]
                      }
                      onChange={(opt: SelectOption) =>
                        onChange((opt as any).value)
                      }
                      label="Status"
                      placeholder="Select status"
                    />
                  )}
                />
                <div className="col-span-2">
                  <Text className="mb-1 block text-sm font-medium text-gray-700">
                    Short Description{' '}
                    <span className="font-normal text-gray-400">
                      ({shortDescValue.length}/280)
                    </span>
                  </Text>
                  <textarea
                    {...register('shortDescription')}
                    placeholder="Brief summary of the brand…"
                    rows={3}
                    maxLength={280}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <Text className="mb-2 block text-sm font-medium text-gray-700">
                    Logo
                  </Text>
                  <ImagePicker
                    currentUrl={currentImages?.logo}
                    onFile={(f) => setLogoFile(f)}
                    onClear={() => setLogoFile(null)}
                  />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 z-40 -mx-5 flex items-center justify-end gap-3 border-t border-gray-100 bg-white/90 px-5 py-4 backdrop-blur">
              <Button variant="outline" type="button" onClick={onSuccess}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {id ? 'Update' : 'Create'} Brand
              </Button>
            </div>
          </>
        ) : (
          // ── FULL PAGE layout ──────────────────────────────────────────────
          <div className="flex gap-6 @5xl:gap-7">
            {/* ── Left column ── */}
            <div className="min-w-0 flex-1 space-y-6">
              {/* Brand Identity */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-5 flex items-center justify-between">
                  <Title as="h5" className="font-semibold text-gray-800">
                    Brand Identity
                  </Title>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={aiLoading}
                    disabled={aiLoading}
                    onClick={() =>
                      triggerAiFill(
                        watch('name'),
                        watch('brandType') || '',
                        watch('primaryCategory') || '',
                        watch('countryOfOrigin') || ''
                      )
                    }
                    className="gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50"
                  >
                    {!aiLoading && <span>✨</span>}
                    {aiLoading ? 'Generating…' : 'Fill with AI'}
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                    <Input
                      label="Brand Name *"
                      placeholder="e.g. Glenfiddich"
                      {...register('name')}
                      error={errors.name?.message}
                    />
                    <Input
                      label="Legal Name"
                      placeholder="e.g. William Grant & Sons Ltd"
                      {...register('legalName')}
                      error={errors.legalName?.message}
                    />
                  </div>
                  <div>
                    <Input
                      label="Slug *"
                      placeholder="e.g. glenfiddich"
                      {...register('slug')}
                      error={errors.slug?.message}
                      prefix={<span className="text-sm text-gray-400">/</span>}
                      onFocus={() => {
                        slugManuallyEdited.current = true;
                      }}
                    />
                    <Text className="mt-1.5 text-xs text-gray-400">
                      Auto-generated from name. Lowercase letters, numbers and
                      hyphens only.
                    </Text>
                  </div>
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                    <Input
                      label="Tagline"
                      placeholder="e.g. The World's Most Awarded Single Malt"
                      {...register('tagline')}
                      error={errors.tagline?.message}
                    />
                    <div>
                      <Input
                        label="Trading Names"
                        placeholder="e.g. Glenfiddich, The Glenfiddich Distillery"
                        {...register('tradingAs')}
                        error={errors.tradingAs?.message}
                      />
                      <Text className="mt-1 text-xs text-gray-400">
                        Separate multiple names with commas.
                      </Text>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                    <Input
                      label="Founded (Year)"
                      type="number"
                      placeholder="e.g. 1887"
                      {...register('founded', {
                        setValueAs: (v) =>
                          v === '' || v === null ? undefined : Number(v),
                      })}
                      error={errors.founded?.message}
                    />
                    <Input
                      label="Founder Name"
                      placeholder="e.g. William Grant"
                      {...register('founderName')}
                      error={errors.founderName?.message}
                    />
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">
                  Classification
                </Title>
                <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                  <Controller
                    name="brandType"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={BRAND_TYPE_OPTIONS}
                        value={
                          BRAND_TYPE_OPTIONS.find((o) => o.value === value) ??
                          ''
                        }
                        onChange={(opt: SelectOption) =>
                          onChange((opt as any).value)
                        }
                        label="Brand Type"
                        placeholder="Select brand type"
                      />
                    )}
                  />
                  <Controller
                    name="primaryCategory"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={PRIMARY_CATEGORY_OPTIONS}
                        value={
                          PRIMARY_CATEGORY_OPTIONS.find(
                            (o) => o.value === value
                          ) ?? ''
                        }
                        onChange={(opt: SelectOption) =>
                          onChange((opt as any).value)
                        }
                        label="Primary Category"
                        placeholder="Select category"
                      />
                    )}
                  />
                  <div>
                    <Input
                      label="Specializations"
                      placeholder="e.g. Single Malt Whisky, Aged Spirits"
                      {...register('specializations')}
                    />
                    <Text className="mt-1 text-xs text-gray-400">
                      Separate with commas.
                    </Text>
                  </div>
                  <Input
                    label="Country of Origin"
                    placeholder="e.g. Scotland"
                    {...register('countryOfOrigin')}
                    error={errors.countryOfOrigin?.message}
                  />
                  <Input
                    label="Region"
                    placeholder="e.g. Speyside"
                    {...register('region')}
                    error={errors.region?.message}
                  />
                  <Input
                    label="Display Order"
                    type="number"
                    placeholder="999"
                    {...register('displayOrder', {
                      setValueAs: (v) =>
                        v === '' || v === null || isNaN(Number(v))
                          ? 999
                          : Number(v),
                    })}
                    error={errors.displayOrder?.message}
                  />
                  <Input
                    label="HQ City"
                    placeholder="e.g. Dufftown"
                    {...register('hqCity')}
                  />
                  <Input
                    label="HQ Country"
                    placeholder="e.g. United Kingdom"
                    {...register('hqCountry')}
                  />
                </div>
              </div>

              {/* About */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">
                  About
                </Title>
                <div className="space-y-4">
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">
                      Short Description{' '}
                      <span className="font-normal text-gray-400">
                        ({shortDescValue.length}/280)
                      </span>
                    </Text>
                    <textarea
                      {...register('shortDescription')}
                      placeholder="A brief summary shown in brand listings and cards…"
                      rows={3}
                      maxLength={280}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {errors.shortDescription?.message && (
                      <Text className="mt-1 text-xs text-red-500">
                        {errors.shortDescription.message}
                      </Text>
                    )}
                  </div>
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">
                      Full Description
                    </Text>
                    <Controller
                      control={control}
                      name="description"
                      render={({ field: { onChange, value } }) => (
                        <QuillEditor
                          value={value}
                          onChange={onChange}
                          className="[&>.ql-container_.ql-editor]:min-h-[160px]"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">
                      Brand Story
                    </Text>
                    <textarea
                      {...register('story')}
                      placeholder="The brand's heritage, history and mission…"
                      rows={6}
                      maxLength={5000}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {errors.story?.message && (
                      <Text className="mt-1 text-xs text-red-500">
                        {errors.story.message}
                      </Text>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact & Social */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-5 font-semibold text-gray-800">
                  Contact & Social Media
                </Title>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
                    <Input
                      label="Website"
                      placeholder="https://glenfiddich.com"
                      {...register('website')}
                      error={errors.website?.message}
                    />
                    <Input
                      label="Email"
                      type="email"
                      placeholder="info@brand.com"
                      {...register('email')}
                      error={errors.email?.message}
                    />
                    <Input
                      label="Phone"
                      placeholder="+1 234 567 8900"
                      {...register('phone')}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
                    <Input
                      label="Facebook"
                      placeholder="https://facebook.com/brandpage"
                      {...register('socialFacebook')}
                    />
                    <Input
                      label="Instagram"
                      placeholder="https://instagram.com/brandpage"
                      {...register('socialInstagram')}
                    />
                    <Input
                      label="Twitter / X"
                      placeholder="https://twitter.com/brandpage"
                      {...register('socialTwitter')}
                    />
                    <Input
                      label="YouTube"
                      placeholder="https://youtube.com/@brandchannel"
                      {...register('socialYoutube')}
                    />
                    <Input
                      label="LinkedIn"
                      placeholder="https://linkedin.com/company/brand"
                      {...register('socialLinkedin')}
                    />
                    <Input
                      label="TikTok"
                      placeholder="https://tiktok.com/@brandpage"
                      {...register('socialTiktok')}
                    />
                  </div>
                </div>
              </div>

              {/* SEO */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-1 font-semibold text-gray-800">
                  SEO
                </Title>
                <Text className="mb-5 text-sm text-gray-400">
                  Optimise how this brand appears in search engines.
                </Text>
                <div className="space-y-4">
                  <Input
                    label="Meta Title"
                    placeholder="e.g. Glenfiddich Single Malt Whisky | DrinksHarbour"
                    {...register('metaTitle')}
                    error={errors.metaTitle?.message}
                  />
                  <Input
                    label="SEO H1 Heading"
                    placeholder="e.g. Buy Glenfiddich Online in Nigeria"
                    {...register('seoH1')}
                    error={errors.seoH1?.message}
                  />
                  <div>
                    <Text className="mb-1.5 block text-sm font-medium text-gray-700">
                      Meta Description
                    </Text>
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
                      placeholder="e.g. glenfiddich, single malt whisky, scotch whisky"
                      {...register('metaKeywords')}
                    />
                    <Text className="mt-1 text-xs text-gray-400">
                      Separate keywords with commas.
                    </Text>
                  </div>
                  <Input
                    label="Canonical URL"
                    placeholder="https://drinksharbour.com/brands/glenfiddich"
                    {...register('canonicalUrl')}
                    error={errors.canonicalUrl?.message}
                  />
                </div>
              </div>

              {/* Admin Notes */}
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <Title as="h5" className="mb-1 font-semibold text-gray-800">
                  Admin Notes
                </Title>
                <Text className="mb-4 text-sm text-gray-400">
                  Internal notes — not shown to customers.
                </Text>
                <textarea
                  {...register('notes')}
                  placeholder="Any internal notes about this brand…"
                  rows={3}
                  maxLength={2000}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* ── Right sidebar ── */}
            <div className="w-72 flex-shrink-0 space-y-6 @5xl:w-80">
              {/* Publish panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-4 font-semibold text-gray-800">
                  Publish
                </Title>
                <div className="mb-4">
                  <Controller
                    name="status"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Select
                        options={STATUS_OPTIONS}
                        value={
                          STATUS_OPTIONS.find((o) => o.value === value) ??
                          STATUS_OPTIONS[0]
                        }
                        onChange={(opt: SelectOption) =>
                          onChange((opt as any).value)
                        }
                        label="Status"
                        placeholder="Select status"
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    isLoading={isLoading}
                    className="w-full"
                  >
                    {id ? 'Update Brand' : 'Save Brand'}
                  </Button>
                  <Button
                    type="button"
                    variant="flat"
                    className="w-full"
                    onClick={() => router.push(routes.eCommerce.brands)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              {/* Images panel */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-4 font-semibold text-gray-800">
                  Images
                </Title>
                <div className="space-y-5">
                  <ImagePicker
                    label="Logo"
                    currentUrl={currentImages?.logo}
                    onFile={(f) => setLogoFile(f)}
                    onClear={() => setLogoFile(null)}
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

              {/* Brand Flags */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-2 font-semibold text-gray-800">
                  Brand Flags
                </Title>
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
                    name="isPopular"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Popular"
                        description="Mark as a popular brand"
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
                    name="isPremium"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Premium"
                        description="Mark as a premium brand"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="isCraft"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Craft"
                        description="Mark as a craft producer"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="isLocal"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Local"
                        description="Local / Nigerian brand"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                  <Controller
                    name="verified"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <VisibilityToggle
                        label="Verified"
                        description="Brand identity verified"
                        checked={!!value}
                        onChange={onChange}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Brand Colours */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <Title as="h6" className="mb-4 font-semibold text-gray-800">
                  Brand Colours
                </Title>
                <div className="space-y-4">
                  <ColorInput
                    label="Primary Colour"
                    value={colorPrimary}
                    onChange={(v) => setValue('brandColorPrimary', v)}
                    error={errors.brandColorPrimary?.message}
                  />
                  <ColorInput
                    label="Secondary Colour"
                    value={colorSecondary}
                    onChange={(v) => setValue('brandColorSecondary', v)}
                    error={errors.brandColorSecondary?.message}
                  />
                  <ColorInput
                    label="Accent Colour"
                    value={colorAccent}
                    onChange={(v) => setValue('brandColorAccent', v)}
                    error={errors.brandColorAccent?.message}
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
