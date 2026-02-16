// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
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
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const productName = watch('name') || '';
  const shortDesc = watch('shortDescription') || '';
  const fullDesc = watch('description') || '';
  const metaTitle = watch('metaTitle') || '';
  const metaDescription = watch('metaDescription') || '';
  const metaKeywords = watch('metaKeywords') || [];
  const isAlcoholic = watch('isAlcoholic');
  const brand = watch('brand') || '';
  const type = watch('type') || '';
  const originCountry = watch('originCountry') || '';
  const region = watch('region') || '';

  const [seoScore, setSeoScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  // Calculate SEO score
  useEffect(() => {
    const titleScore = metaTitle.length >= 30 && metaTitle.length <= 60 ? 25 : metaTitle.length > 0 ? 15 : 0;
    const descScore = metaDescription.length >= 120 && metaDescription.length <= 160 ? 25 : metaDescription.length > 0 ? 15 : 0;
    const keywordsScore = metaKeywords.length >= 5 ? 25 : metaKeywords.length > 0 ? 15 : 0;
    const brandScore = brand ? 25 : 0;
    const totalScore = titleScore + descScore + keywordsScore + brandScore;
    setSeoScore(Math.min(totalScore, 100));
  }, [metaTitle, metaDescription, metaKeywords, brand]);

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
      const response = await geminiService.generateMetaTitle(productName, session.user.token, brand, type);
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
        shortDesc
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
      const response = await geminiService.generateKeywords(productName, session.user.token, brand, type, region);
      if (response.data.keywords) {
        setValue('metaKeywords', response.data.keywords);
        toast.success('Keywords generated!');
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
      // Generate all in parallel
      const [titleRes, descRes, keywordsRes] = await Promise.all([
        geminiService.generateMetaTitle(productName, session.user.token, brand, type),
        geminiService.generateMetaDescription(productName, session.user.token, brand, type, shortDesc),
        geminiService.generateKeywords(productName, session.user.token, brand, type, region),
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
      {/* AI Auto-fill Button */}
      <div className="mb-4 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          color="primary"
          disabled={!productName || productName.length < 3 || isGenerating}
          onClick={handleAutoFill}
          className="gap-1"
        >
          {isGenerating ? (
            <>
              <PiSpinner className="h-3 w-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="h-3 w-3" />
              Generate All
            </>
          )}
        </Button>
      </div>

      <motion.div
        className="grid w-full gap-6 @2xl:grid-cols-2"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* SEO Score Card */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold',
                    seoScore >= 75
                      ? 'bg-green-500 text-white'
                      : seoScore >= 50
                        ? 'bg-amber-500 text-white'
                        : 'bg-red-500 text-white'
                  )}
                >
                  {seoScore}%
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">SEO Score</h4>
                  <p className="text-sm text-gray-600">
                    {seoScore >= 75
                      ? 'Excellent! Your product is well optimized for search engines.'
                      : seoScore >= 50
                        ? 'Good progress. Complete all fields for better visibility.'
                        : 'Needs improvement. Fill in all SEO fields to boost rankings.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded-full', metaTitle.length >= 30 && metaTitle.length <= 60 ? 'bg-green-500' : metaTitle.length > 0 ? 'bg-amber-500' : 'bg-gray-300')} />
                  <span className="text-gray-600">Title</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded-full', descLength >= 120 && descLength <= 160 ? 'bg-green-500' : descLength > 0 ? 'bg-amber-500' : 'bg-gray-300')} />
                  <span className="text-gray-600">Description</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded-full', keywordsArray.length >= 5 ? 'bg-green-500' : keywordsArray.length > 0 ? 'bg-amber-500' : 'bg-gray-300')} />
                  <span className="text-gray-600">Keywords</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded-full', brand ? 'bg-green-500' : 'bg-gray-300')} />
                  <span className="text-gray-600">Brand</span>
                </div>
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
              <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors',
                    titleLength > 60 ? 'bg-red-500' : titleLength >= 50 ? 'bg-green-500' : 'bg-amber-500'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((titleLength / 60) * 100, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className={cn(
                'ml-2 text-xs font-medium',
                titleLength > 60 ? 'text-red-500' : titleLength >= 50 ? 'text-green-500' : 'text-gray-500'
              )}>
                {titleLength}/60
              </span>
            </div>

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
              <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors',
                    descLength > 160 ? 'bg-red-500' : descLength >= 120 ? 'bg-green-500' : 'bg-amber-500'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((descLength / 160) * 100, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className={cn(
                'ml-2 text-xs font-medium',
                descLength > 160 ? 'text-red-500' : descLength >= 120 ? 'text-green-500' : 'text-gray-500'
              )}>
                {descLength}/160
              </span>
            </div>
          </div>
        </motion.div>

        {/* Meta Keywords */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Hash className="h-4 w-4 text-purple-500" />
                Meta Keywords
                <Tooltip content="Important keywords for search indexing (5-10 recommended)">
                  <Info className="h-4 w-4 cursor-help text-gray-400" />
                </Tooltip>
              </label>
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

            <Input
              placeholder="Enter keywords separated by commas..."
              value={keywordsArray.join(', ')}
              onChange={(e) => {
                const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                setValue('metaKeywords', keywords);
              }}
              className="w-full"
            />

            {keywordsArray.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 flex flex-wrap gap-2"
              >
                {keywordsArray.map((keyword, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700"
                  >
                    <Hash className="h-3 w-3" />
                    {keyword}
                    <button
                      type="button"
                      onClick={() => {
                        const newKeywords = keywordsArray.filter((_, i) => i !== idx);
                        setValue('metaKeywords', newKeywords);
                      }}
                      className="ml-1 text-purple-500 hover:text-purple-700"
                    >
                      ×
                    </button>
                  </motion.span>
                ))}
              </motion.div>
            )}

            <Text className="mt-2 text-xs text-gray-500">
              Include product type, brand, origin, key features, and related search terms.
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

            <div className="grid gap-3 @md:grid-cols-3">
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
                <h4 className="font-semibold text-blue-900">SEO Best Practices</h4>
                <ul className="mt-2 space-y-1 text-sm text-blue-800">
                  <li>• Include primary keyword in the title (within first 50 characters)</li>
                  <li>• Keep title under 60 characters to prevent truncation</li>
                  <li>• Write compelling descriptions (150-160 chars) that encourage clicks</li>
                  <li>• Use 5-10 relevant keywords including brand, type, origin, and features</li>
                  <li>• Include your brand name in the title for brand recognition</li>
                  <li>• Update SEO when product details change</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
