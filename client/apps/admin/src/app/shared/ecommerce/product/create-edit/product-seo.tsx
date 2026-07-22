// @ts-nocheck
'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Input, Textarea, Text, Badge, Tooltip, Button, Select, type SelectOption } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';
import { motion } from 'framer-motion';
import { useState, useEffect, Fragment } from 'react';
import {
  Search,
  FileText,
  Tag,
  Star,
  MessageSquare,
  ShieldCheck,
  Info,
  Check,
  AlertCircle,
  Globe,
  Link,
  Hash,
  Zap,
} from 'lucide-react';
import { PiSparkle, PiSpinner } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import toast from 'react-hot-toast';

interface ProductSeoProps {
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export default function ProductSeo({ className }: ProductSeoProps) {
  const { data: session } = useSession();
  const {
    register,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const productName = watch('name') || '';
  const shortDesc = watch('shortDescription') || '';
  const fullDesc = watch('description') || '';
  const metaTitle = watch('metaTitle') || '';
  const seoH1 = watch('seoH1') || '';
  const metaDescription = watch('metaDescription') || '';
  const metaKeywords = watch('metaKeywords') || [];
  const isAlcoholic = watch('isAlcoholic');
  const brand = watch('brand') || '';
  const type = watch('type') || '';
  const subType = watch('subType') || '';
  const originCountry = watch('originCountry') || '';
  const region = watch('region') || '';
  const abv = watch('abv');
  const slug = watch('slug') || '';
  // useWatch creates a proper reactive subscription — reads current form store value
  // even when this component mounts after methods.reset() has already been called
  const isPublished = useWatch({ control, name: 'isPublished' });
  const [appendKeywords, setAppendKeywords] = useState(false);

  // Auto-set publishedAt when isPublished changes
  useEffect(() => {
    if (isPublished) {
      setValue('publishedAt', new Date());
    }
  }, [isPublished, setValue]);

  // Initialize publishedAt on mount if isPublished is already true
  useEffect(() => {
    const currentPublishedAt = watch('publishedAt');
    if (isPublished && !currentPublishedAt) {
      setValue('publishedAt', new Date());
    }
  }, []);

  const [seoScore, setSeoScore] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState<{ label: string; score: number; max: number; ok: boolean }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  // Calculate SEO score — 100pt system across 6 criteria
  useEffect(() => {
    const titleLen = metaTitle.length;
    const descLen = metaDescription.length;
    const kwCount = Array.isArray(metaKeywords) ? metaKeywords.length : 0;
    const titleLower = metaTitle.toLowerCase();
    const nameLower = productName.toLowerCase();
    const brandLower = (typeof brand === 'string' ? brand : '').toLowerCase();

    // 1. Meta title quality (25 pts)
    let titleScore = 0;
    if (titleLen >= 40 && titleLen <= 60) titleScore = 25;
    else if (titleLen >= 30 && titleLen < 40) titleScore = 20;
    else if (titleLen >= 20) titleScore = 15;
    else if (titleLen > 0) titleScore = 8;
    const titleHasName = nameLower && titleLower.includes(nameLower.split(' ')[0]);
    if (titleLen > 0 && !titleHasName) titleScore = Math.max(titleScore - 3, 0);

    // 2. Meta description quality (25 pts)
    let descScore = 0;
    if (descLen >= 130 && descLen <= 160) descScore = 25;
    else if (descLen >= 100 && descLen < 130) descScore = 20;
    else if (descLen >= 70) descScore = 15;
    else if (descLen >= 40) descScore = 10;
    else if (descLen > 0) descScore = 5;
    const descHasCta = /order|shop|buy|discover|get yours|available|check|view/i.test(metaDescription);
    if (descLen >= 70 && descHasCta && descScore < 25) descScore = Math.min(descScore + 3, 25);

    // 3. Keywords (20 pts)
    let kwScore = 0;
    if (kwCount >= 6) kwScore = 20;
    else if (kwCount >= 4) kwScore = 16;
    else if (kwCount >= 3) kwScore = 12;
    else if (kwCount >= 1) kwScore = 6;

    // 4. Brand presence (15 pts)
    const brandScore = brandLower ? 15 : 0;

    // 5. Slug set (8 pts)
    const slugScore = slug && slug.length > 2 ? 8 : 0;

    // 6. Product description (7 pts)
    const descPresent = (shortDesc && shortDesc.length > 20) || (fullDesc && fullDesc.length > 20);
    const productDescScore = descPresent ? 7 : 0;

    const total = Math.min(titleScore + descScore + kwScore + brandScore + slugScore + productDescScore, 100);
    setSeoScore(total);
    setScoreBreakdown([
      { label: 'Meta Title', score: titleScore, max: 25, ok: titleScore >= 20 },
      { label: 'Meta Description', score: descScore, max: 25, ok: descScore >= 20 },
      { label: 'Keywords', score: kwScore, max: 20, ok: kwScore >= 16 },
      { label: 'Brand', score: brandScore, max: 15, ok: brandScore === 15 },
      { label: 'URL Slug', score: slugScore, max: 8, ok: slugScore === 8 },
      { label: 'Description', score: productDescScore, max: 7, ok: productDescScore === 7 },
    ]);
  }, [metaTitle, metaDescription, metaKeywords, brand, productName, shortDesc, fullDesc, slug]);

  // Auto-enable age verification for alcoholic products
  useEffect(() => {
    if (isAlcoholic) {
      setValue('requiresAgeVerification', true);
    }
  }, [isAlcoholic, setValue]);

  const titleLength = metaTitle.length;
  const descLength = metaDescription.length;

  // Generate meta title
  const handleGenerateTitle = async () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return;
    }
    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setGeneratingField('title');
    try {
      const response = await geminiService.generateMetaTitle(productName, session.user.token, brand, type, {
        subType,
        originCountry,
        region,
      });
      if (response.data.metaTitle) {
        setValue('metaTitle', response.data.metaTitle);
        toast.success('Meta title generated!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate meta title');
    } finally {
      setGeneratingField(null);
    }
  };

  // Generate SEO H1 heading (uses the combined SEO generator, which returns seoH1)
  const handleGenerateSeoH1 = async () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return;
    }
    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setGeneratingField('seoH1');
    try {
      const response = await geminiService.generateSeo(
        productName,
        session.user.token,
        shortDesc,
        type,
        typeof brand === 'string' ? brand : ''
      );
      if (response.data.seoH1) {
        setValue('seoH1', response.data.seoH1);
        toast.success('SEO heading generated!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate SEO heading');
    } finally {
      setGeneratingField(null);
    }
  };

  // Generate meta description
  const handleGenerateDescription = async () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return;
    }
    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setGeneratingField('description');
    try {
      const response = await geminiService.generateMetaDescription(
        productName,
        session.user.token,
        brand,
        type,
        shortDesc,
        { subType, originCountry, region, abv }
      );
      if (response.data.metaDescription) {
        setValue('metaDescription', response.data.metaDescription);
        toast.success('Meta description generated!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate meta description');
    } finally {
      setGeneratingField(null);
    }
  };

  // Generate keywords
  const handleGenerateKeywords = async () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return;
    }
    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setGeneratingField('keywords');
    try {
      const currentKeywords = Array.isArray(metaKeywords) ? metaKeywords : [];
      const response = await geminiService.generateKeywords(productName, session.user.token, {
        brand,
        type,
        subType,
        originCountry,
        region,
        abv,
        shortDescription: shortDesc,
        existingKeywords: appendKeywords && currentKeywords.length > 0 ? currentKeywords : undefined,
      });
      if (response.data.keywords?.length) {
        const newKeywords = appendKeywords
          ? [...new Set([...currentKeywords, ...response.data.keywords])]
          : response.data.keywords;
        setValue('metaKeywords', newKeywords);
        toast.success(appendKeywords ? `${response.data.keywords.length} keywords added!` : 'Keywords generated!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate keywords');
    } finally {
      setGeneratingField(null);
    }
  };

  // Auto-fill all SEO with AI
  const handleAutoFill = async () => {
    if (!productName || productName.length < 3) {
      toast.error('Please enter a product name first');
      return;
    }

    if (!session?.user?.token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setIsGenerating(true);
    toast.loading('Generating SEO content with AI...', { id: 'ai-seo' });

    try {
      // Generate all in parallel with full context
      const [titleRes, descRes, keywordsRes] = await Promise.all([
        geminiService.generateMetaTitle(productName, session.user.token, brand, type, { subType, originCountry, region }),
        geminiService.generateMetaDescription(productName, session.user.token, brand, type, shortDesc, { subType, originCountry, region, abv }),
        geminiService.generateKeywords(productName, session.user.token, {
          brand,
          type,
          subType,
          originCountry,
          region,
          abv,
          shortDescription: shortDesc,
        }),
      ]);

      if (titleRes.data.metaTitle) setValue('metaTitle', titleRes.data.metaTitle);
      if (descRes.data.metaDescription) setValue('metaDescription', descRes.data.metaDescription);
      if (keywordsRes.data.keywords) setValue('metaKeywords', keywordsRes.data.keywords);

      toast.success('SEO content generated!', { id: 'ai-seo' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error.message || 'Failed to generate SEO content', { id: 'ai-seo' });
    } finally {
      setIsGenerating(false);
    }
  };

  const keywordsArray = Array.isArray(metaKeywords) ? metaKeywords : (typeof metaKeywords === 'string' ? metaKeywords.split(',').map(k => k.trim()).filter(Boolean) : []);

  return (
    <FormGroup
      title="Search Engine Optimization"
      description="Optimize your product for search engines and social media"
      className={cn(className)}
    >

      <motion.div
        className="grid w-full gap-6 @2xl:grid-cols-2"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* SEO Score Card */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className={cn(
            'rounded-xl border p-5',
            seoScore >= 90 ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50'
            : seoScore >= 70 ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50'
            : seoScore >= 50 ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50'
            : 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50'
          )}>
            <div className="flex flex-col gap-4 @md:flex-row @md:items-start @md:justify-between">
              {/* Score circle + label */}
              <div className="flex items-center gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={seoScore >= 90 ? '#10b981' : seoScore >= 70 ? '#3b82f6' : seoScore >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray={`${seoScore} ${100 - seoScore}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className={cn(
                    'text-xl font-bold',
                    seoScore >= 90 ? 'text-green-600' : seoScore >= 70 ? 'text-blue-600' : seoScore >= 50 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {seoScore}
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900">
                    {seoScore >= 90 ? 'Excellent SEO' : seoScore >= 75 ? 'Almost There!' : seoScore >= 50 ? 'Needs Work' : 'Get Started'}
                  </h4>
                  <p className="mt-0.5 text-xs text-gray-600 max-w-[220px]">
                    {seoScore >= 90
                      ? 'Your product is fully optimized for search engines.'
                      : seoScore >= 75
                        ? `${90 - seoScore} points to excellent! Fill remaining items.`
                        : seoScore >= 50
                          ? 'Fill all SEO fields and use AI to boost your score.'
                          : 'Use "Generate All" to quickly optimize your product.'}
                  </p>
                  {seoScore < 90 && (
                    <button
                      type="button"
                      onClick={handleAutoFill}
                      disabled={!productName || productName.length < 3 || isGenerating}
                      className="mt-2 flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-blue-600 shadow-sm ring-1 ring-blue-200 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {isGenerating ? <PiSpinner className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                      Generate All SEO
                    </button>
                  )}
                </div>
              </div>

              {/* Per-criteria breakdown */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 @sm:grid-cols-3">
                {scoreBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      item.ok ? 'bg-green-500' : item.score > 0 ? 'bg-amber-400' : 'bg-gray-300'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs text-gray-600">{item.label}</span>
                        <span className={cn(
                          'shrink-0 text-xs font-semibold',
                          item.ok ? 'text-green-600' : item.score > 0 ? 'text-amber-600' : 'text-gray-400'
                        )}>
                          {item.score}/{item.max}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1 w-full rounded-full bg-gray-200">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            item.ok ? 'bg-green-500' : item.score > 0 ? 'bg-amber-400' : 'bg-gray-300'
                          )}
                          style={{ width: `${(item.score / item.max) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Meta Title */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Search className="h-4 w-4 text-blue-500" />
                Meta Title
                <Tooltip content="The title that appears in search engine results">
                  <Info className="h-4 w-4 cursor-help text-gray-400" />
                </Tooltip>
              </label>
              <Button
                type="button"
                size="xs"
                variant="text"
                color="primary"
                disabled={!productName || generatingField === 'title'}
                onClick={handleGenerateTitle}
                className="gap-1"
              >
                {generatingField === 'title' ? (
                  <PiSpinner className="h-3 w-3 animate-spin" />
                ) : (
                  <PiSparkle className="h-3 w-3" />
                )}
                Generate
              </Button>
            </div>

            <Input
              placeholder={productName ? `${productName} | Premium Quality` : 'Product meta title'}
              {...register('metaTitle')}
              className="w-full"
            />

            <div className="mt-2 flex items-center justify-between">
              <div className="relative h-1.5 flex-1 rounded-full bg-gray-200">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors',
                    titleLength > 60 ? 'bg-red-500' : titleLength >= 40 ? 'bg-green-500' : titleLength >= 30 ? 'bg-amber-500' : 'bg-gray-400'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((titleLength / 60) * 100, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
                {/* Target zone markers */}
                <div className="absolute top-0 h-full w-px bg-amber-400 opacity-60" style={{ left: '50%' }} title="30 chars" />
                <div className="absolute top-0 h-full w-px bg-green-500 opacity-60" style={{ left: '66.7%' }} title="40 chars" />
              </div>
              <span className={cn(
                'ml-2 text-xs font-medium',
                titleLength > 60 ? 'text-red-500' : titleLength >= 40 ? 'text-green-600' : titleLength >= 30 ? 'text-amber-600' : 'text-gray-500'
              )}>
                {titleLength}/60
                {titleLength >= 40 && titleLength <= 60 && <span className="ml-1 text-green-500">✓</span>}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Optimal: 40–60 characters · Current: {titleLength < 40 ? `${40 - titleLength} chars short` : titleLength > 60 ? `${titleLength - 60} chars over` : 'in range'}
            </p>

            {/* Google Preview */}
            {metaTitle && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-8 w-8 shrink-0 rounded bg-gray-100 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm text-blue-800 line-clamp-1 hover:underline cursor-pointer">
                      {metaTitle || 'Page Title'}
                    </p>
                    <p className="mt-1 text-xs text-green-700">
                      https://drinksharbour.com/products/{productName.toLowerCase().replace(/\s+/g, '-') || 'product-name'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {metaDescription || 'Product description will appear here in search results...'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* SEO H1 Heading */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Hash className="h-4 w-4 text-rose-500" />
                SEO H1 Heading
                <Tooltip content="The visible on-page headline. Include the product name and its beverage type — falls back to the product name when left empty.">
                  <Info className="h-4 w-4 cursor-help text-gray-400" />
                </Tooltip>
              </label>
              <Button
                type="button"
                size="xs"
                variant="text"
                color="primary"
                disabled={!productName || generatingField === 'seoH1'}
                onClick={handleGenerateSeoH1}
                className="gap-1"
              >
                {generatingField === 'seoH1' ? (
                  <PiSpinner className="h-3 w-3 animate-spin" />
                ) : (
                  <PiSparkle className="h-3 w-3" />
                )}
                Generate
              </Button>
            </div>

            <Input
              placeholder={productName ? `${productName}${type ? ` ${String(type).replace(/_/g, ' ')}` : ''}` : 'On-page H1 headline'}
              maxLength={80}
              {...register('seoH1')}
              className="w-full"
            />

            <div className="mt-2 flex items-center justify-between">
              <span className={cn(
                'text-xs font-medium',
                seoH1.length > 70 ? 'text-red-500' : seoH1.length >= 20 ? 'text-green-600' : 'text-gray-500'
              )}>
                {seoH1.length}/70
                {seoH1.length >= 20 && seoH1.length <= 70 && <span className="ml-1 text-green-500">✓</span>}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              The keyword-rich H1 shown on the product page. Include the product name + beverage type; no “Buy”/price/“Nigeria” filler.
            </p>
          </div>
        </motion.div>

        {/* Meta Description */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FileText className="h-4 w-4 text-indigo-500" />
                Meta Description
                <Tooltip content="The description that appears in search engine results">
                  <Info className="h-4 w-4 cursor-help text-gray-400" />
                </Tooltip>
              </label>
              <Button
                type="button"
                size="xs"
                variant="text"
                color="primary"
                disabled={!productName || generatingField === 'description'}
                onClick={handleGenerateDescription}
                className="gap-1"
              >
                {generatingField === 'description' ? (
                  <PiSpinner className="h-3 w-3 animate-spin" />
                ) : (
                  <PiSparkle className="h-3 w-3" />
                )}
                Generate
              </Button>
            </div>

            <Textarea
              placeholder={shortDesc || 'Brief product description for search results (120-160 characters)'}
              maxLength={160}
              {...register('metaDescription')}
              className="min-h-[100px] resize-none"
            />

            <div className="mt-2 flex items-center justify-between">
              <div className="relative h-1.5 flex-1 rounded-full bg-gray-200">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors',
                    descLength > 160 ? 'bg-red-500' : descLength >= 130 ? 'bg-green-500' : descLength >= 80 ? 'bg-amber-500' : 'bg-gray-400'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((descLength / 160) * 100, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
                <div className="absolute top-0 h-full w-px bg-amber-400 opacity-60" style={{ left: '50%' }} title="80 chars" />
                <div className="absolute top-0 h-full w-px bg-green-500 opacity-60" style={{ left: '81.25%' }} title="130 chars" />
              </div>
              <span className={cn(
                'ml-2 text-xs font-medium',
                descLength > 160 ? 'text-red-500' : descLength >= 130 ? 'text-green-600' : descLength >= 80 ? 'text-amber-600' : 'text-gray-500'
              )}>
                {descLength}/160
                {descLength >= 130 && descLength <= 160 && <span className="ml-1 text-green-500">✓</span>}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Optimal: 130–160 characters · {descLength < 130 ? `${130 - descLength} chars short` : descLength > 160 ? `${descLength - 160} chars over` : 'in range'}
            </p>
          </div>
        </motion.div>

        {/* Meta Keywords */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Hash className="h-4 w-4 text-purple-500" />
                Meta Keywords
                <Tooltip content="Important keywords for search indexing (8-12 recommended)">
                  <Info className="h-4 w-4 cursor-help text-gray-400" />
                </Tooltip>
                <span className={cn(
                  'ml-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  keywordsArray.length >= 8 ? 'bg-green-100 text-green-700' :
                  keywordsArray.length >= 5 ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                )}>
                  {keywordsArray.length}
                </span>
              </label>
              <div className="flex items-center gap-2">
                {keywordsArray.length > 0 && (
                  <Tooltip content={appendKeywords ? 'Will add to existing keywords' : 'Will replace existing keywords'}>
                    <button
                      type="button"
                      onClick={() => setAppendKeywords(v => !v)}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                        appendKeywords
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      )}
                    >
                      {appendKeywords ? '+ Append' : '↺ Replace'}
                    </button>
                  </Tooltip>
                )}
                <Button
                  type="button"
                  size="xs"
                  variant="text"
                  color="primary"
                  disabled={!productName || generatingField === 'keywords'}
                  onClick={handleGenerateKeywords}
                  className="gap-1"
                >
                  {generatingField === 'keywords' ? (
                    <PiSpinner className="h-3 w-3 animate-spin" />
                  ) : (
                    <PiSparkle className="h-3 w-3" />
                  )}
                  Generate
                </Button>
              </div>
            </div>

            {/* Tag input area */}
            <div className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-gray-50 p-2 focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-400">
              <div className="flex flex-wrap gap-1.5">
                {keywordsArray.map((keyword, idx) => (
                  <motion.span
                    key={`${keyword}-${idx}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-sm text-purple-700"
                  >
                    <Hash className="h-2.5 w-2.5 shrink-0" />
                    {keyword}
                    <button
                      type="button"
                      onClick={() => {
                        setValue('metaKeywords', keywordsArray.filter((_, i) => i !== idx));
                      }}
                      className="ml-0.5 rounded-full text-purple-400 hover:text-purple-700"
                      aria-label={`Remove ${keyword}`}
                    >
                      ×
                    </button>
                  </motion.span>
                ))}
                <input
                  type="text"
                  placeholder={keywordsArray.length === 0 ? 'Type a keyword and press Enter or comma...' : 'Add more...'}
                  className="min-w-[180px] flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !keywordsArray.includes(val)) {
                        setValue('metaKeywords', [...keywordsArray, val]);
                      }
                      (e.target as HTMLInputElement).value = '';
                    } else if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && keywordsArray.length > 0) {
                      setValue('metaKeywords', keywordsArray.slice(0, -1));
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && !keywordsArray.includes(val)) {
                      setValue('metaKeywords', [...keywordsArray, val]);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>

            <Text className="mt-2 text-xs text-gray-500">
              Press <kbd className="rounded border border-gray-200 bg-gray-100 px-1 text-xs">Enter</kbd> or <kbd className="rounded border border-gray-200 bg-gray-100 px-1 text-xs">,</kbd> to add a keyword. Aim for 6+ keywords — add brand, type, origin, flavor notes, and purchase intent terms.
            </Text>
          </div>
        </motion.div>

        {/* URL Slug */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Link className="h-4 w-4 text-cyan-500" />
              URL Slug
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">drinksharbour.com/products/</span>
              <Input
                placeholder={productName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product-url-slug'}
                {...register('slug')}
                className="flex-1"
              />
            </div>

            <Text className="mt-2 text-xs text-gray-500">
              URL-friendly version of the product name
            </Text>
          </div>
        </motion.div>

        {/* Canonical URL */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Globe className="h-4 w-4 text-teal-500" />
              Canonical URL
              <Tooltip content="Primary URL for this product (prevents duplicate content issues)">
                <Info className="h-4 w-4 cursor-help text-gray-400" />
              </Tooltip>
            </label>

            <Input
              placeholder="https://drinksharbour.com/products/..."
              {...register('canonicalUrl')}
              className="w-full"
            />

            <Text className="mt-2 text-xs text-gray-500">
              Leave empty to auto-generate from product URL
            </Text>
          </div>
        </motion.div>

        {/* Product Settings */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Star className="h-4 w-4 text-amber-500" />
              Product Settings
            </label>

            <div className="grid gap-3 @md:grid-cols-2 @xl:grid-cols-4">
              {/* Featured Product */}
              <motion.label
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-200 bg-white p-4 transition-all hover:border-amber-300 hover:bg-amber-50/30"
              >
                <input
                  type="checkbox"
                  {...register('isFeatured')}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-gray-900">
                    Featured Product
                  </span>
                  <span className="block text-xs text-gray-500">
                    Display in featured sections
                  </span>
                </div>
              </motion.label>

              {/* Allow Reviews */}
              <motion.label
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-200 bg-white p-4 transition-all hover:border-blue-300 hover:bg-blue-50/30"
              >
                <input
                  type="checkbox"
                  {...register('allowReviews')}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-gray-900">
                    <MessageSquare className="mr-1 inline h-4 w-4" />
                    Allow Reviews
                  </span>
                  <span className="block text-xs text-gray-500">
                    Customers can rate this product
                  </span>
                </div>
              </motion.label>

              {/* Publish Product */}
              <motion.label
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all',
                  isPublished
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/30'
                )}
              >
                <input
                  type="checkbox"
                  checked={!!isPublished}
                  onChange={(e) => setValue('isPublished', e.target.checked, { shouldDirty: true, shouldValidate: true })}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-gray-900">
                    <Globe className="mr-1 inline h-4 w-4" />
                    Published
                  </span>
                  <span className="block text-xs text-gray-500">
                    {isPublished ? 'Visible on the shop' : 'Hidden from the shop'}
                  </span>
                </div>
                {isPublished && (
                  <Badge color="success" className="ml-auto shrink-0 text-xs">
                    Live
                  </Badge>
                )}
              </motion.label>

              {/* Age Verification */}
              <motion.label
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all',
                  isAlcoholic
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/30'
                )}
              >
                <input
                  type="checkbox"
                  {...register('requiresAgeVerification')}
                  disabled={isAlcoholic}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="block text-sm font-semibold text-gray-900">
                    <ShieldCheck className="mr-1 inline h-4 w-4" />
                    Age Verification
                  </span>
                  <span className="block text-xs text-gray-500">
                    {isAlcoholic
                      ? 'Auto-enabled for alcoholic'
                      : 'Require age verification'}
                  </span>
                </div>
                {isAlcoholic && (
                  <Badge color="success" className="ml-auto text-xs">
                    Auto
                  </Badge>
                )}
              </motion.label>
            </div>
          </div>
        </motion.div>

        {/* SEO Tips */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
              <div>
                <h4 className="font-semibold text-blue-900">Quick Tips for 90+ Score</h4>
                <ul className="mt-2 space-y-1 text-sm text-blue-800">
                  <li>• <strong>Title:</strong> 40-60 chars, include product name and brand</li>
                  <li>• <strong>Description:</strong> 100-160 chars, add a call-to-action</li>
                  <li>• <strong>Keywords:</strong> 6+ keywords covering brand, type, origin, features</li>
                  <li>• <strong>Brand:</strong> Required — adds 15 points to your score</li>
                  <li>• <strong>URL Slug:</strong> Auto-generated from product name</li>
                  <li>• <strong>Tip:</strong> Use "Generate All SEO" for instant optimization</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
