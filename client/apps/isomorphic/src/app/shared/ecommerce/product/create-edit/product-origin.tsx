// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Text, Tooltip, Badge, Button, Select, type SelectOption } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import { countries } from './form-utils';
import FormGroup from '@/app/shared/form-group';
import { motion } from 'framer-motion';
import { useState, useEffect, Fragment } from 'react';
import {
  Globe,
  MapPin,
  Award,
  Building,
  Tag,
  Calendar,
  Clock,
  Factory,
  Beer,
  Grape,
  Flame,
  Wine,
  Info,
} from 'lucide-react';
import { PiSparkle, PiSpinner } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import { brandService } from '@/services/brand.service';
import toast from 'react-hot-toast';

interface ProductOriginProps {
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

// Country flags mapping
const countryFlags: Record<string, string> = {
  scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  ireland: '🇮🇪',
  usa: '🇺🇸',
  canada: '🇨🇦',
  japan: '🇯🇵',
  france: '🇫🇷',
  italy: '🇮🇹',
  spain: '🇪🇸',
  germany: '🇩🇪',
  england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  india: '🇮🇳',
  australia: '🇦🇺',
  mexico: '🇲🇽',
  'new_zealand': '🇳🇿',
  argentina: '🇦🇷',
  chile: '🇨🇱',
  'south_africa': '🇿🇦',
  portugal: '🇵🇹',
  netherlands: '🇳🇱',
  belgium: '🇧🇪',
  sweden: '🇸🇪',
  denmark: '🇩🇰',
  norway: '🇳🇴',
  finland: '🇫🇮',
  poland: '🇵🇱',
  russia: '🇷🇺',
  china: '🇨🇳',
  taiwan: '🇹🇼',
  brazil: '🇧🇷',
  cuba: '🇨🇺',
  jamaica: '🇯🇲',
  barbados: '🇧🇧',
  guyana: '🇬🇾',
};

const productionMethods = [
  { value: '', label: 'Select production method', icon: Factory },
  { value: 'traditional', label: 'Traditional', icon: Clock },
  { value: 'modern', label: 'Modern', icon: Factory },
  { value: 'organic', label: 'Organic', icon: Grape },
  { value: 'biodynamic', label: 'Biodynamic', icon: Globe },
  { value: 'pot_still', label: 'Pot Still', icon: Flame },
  { value: 'column_still', label: 'Column Still', icon: Factory },
  { value: 'barrel_aged', label: 'Barrel Aged', icon: Wine },
  { value: 'oak_aged', label: 'Oak Aged', icon: Wine },
  { value: 'single_malt', label: 'Single Malt', icon: Tag },
  { value: 'blended', label: 'Blended', icon: Wine },
  { value: 'small_batch', label: 'Small Batch', icon: Award },
  { value: 'limited_edition', label: 'Limited Edition', icon: Award },
];

export default function ProductOrigin({
  className,
}: ProductOriginProps) {
  const { data: session } = useSession();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateProductInput>();

  const [isGenerating, setIsGenerating] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const selectedCountry = watch('originCountry');
  const vintage = watch('vintage');
  const productionMethod = watch('productionMethod');
  const productName = watch('name') || '';
  const currentYear = new Date().getFullYear();

  // Fetch brands on mount
  useEffect(() => {
    const fetchBrands = async () => {
      if (!session?.user?.token) return;
      setIsLoadingBrands(true);
      try {
        const fetchedBrands = await brandService.getBrands(session.user.token, { limit: 100 });
        setBrands(fetchedBrands);
      } catch (error) {
        console.error('Failed to fetch brands:', error);
        setBrands([]);
      } finally {
        setIsLoadingBrands(false);
      }
    };
    fetchBrands();
  }, [session]);

  // Get flag for selected country
  const getCountryFlag = (code: string) => countryFlags[code] || '🌍';

  // Calculate age from vintage if available
  const calculateAge = (year: number | undefined) => {
    if (!year || year > currentYear) return null;
    return currentYear - year;
  };

  const estimatedAge = calculateAge(vintage);

  // Auto-fill origin with AI - calls individual endpoints for each field
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
    toast.loading('Generating origin details with AI...', { id: 'ai-origin' });

    try {
      // Generate origin country
      const countryRes = await geminiService.generateOriginCountry(
        productName,
        session.user.token,
        watch('type'),
        watch('brand')
      );
      setValue('originCountry', countryRes.data.originCountry || '');

      // Generate region
      const regionRes = await geminiService.generateRegion(
        productName,
        session.user.token,
        watch('type'),
        countryRes.data.originCountry
      );
      setValue('region', regionRes.data.region || '');

      // Generate appellation (e.g., Champagne, Cognac, Scotch Whisky)
      const appellationRes = await geminiService.generateAppellation(
        productName,
        session.user.token,
        watch('type'),
        countryRes.data.originCountry,
        regionRes.data.region
      );
      setValue('appellation', appellationRes.data.appellation || '');

      // Generate producer
      const producerRes = await geminiService.generateProducer(
        productName,
        session.user.token,
        watch('brand'),
        watch('type')
      );
      setValue('producer', producerRes.data.producer || '');

      // Generate vintage
      const vintageRes = await geminiService.generateVintage(
        productName,
        session.user.token,
        watch('type')
      );
      setValue('vintage', vintageRes.data.vintage);

      // Generate age statement
      const ageRes = await geminiService.generateAgeStatement(
        productName,
        session.user.token,
        watch('type'),
        vintageRes.data.vintage
      );
      setValue('ageStatement', ageRes.data.ageStatement || '');
      setValue('age', vintageRes.data.vintage ? new Date().getFullYear() - vintageRes.data.vintage : undefined);

      // Generate production method
      const methodRes = await geminiService.generateProductionMethod(
        productName,
        session.user.token,
        watch('type')
      );
      setValue('productionMethod', methodRes.data.productionMethod || '');

      // Generate cask type
      const caskRes = await geminiService.generateCaskType(
        productName,
        session.user.token,
        watch('type'),
        methodRes.data.productionMethod
      );
      setValue('caskType', caskRes.data.caskType || '');

      // Generate finish
      if (caskRes.data.caskType) {
        setValue('finish', `Cask finished in ${caskRes.data.caskType}`);
      }

      toast.success('Origin details generated!', { id: 'ai-origin' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      const errorMessage = error.message || 'Failed to generate origin details';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('connect')) {
        toast.error('Cannot connect to server. Make sure backend is running.', { id: 'ai-origin' });
      } else {
        toast.error(errorMessage, { id: 'ai-origin' });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <FormGroup
      title="Origin & Production"
      description="Details about where and how the product is made"
      className={cn(className)}
    >
      {/* AI Auto-fill Button */}
      <div className="mb-4 flex justify-end">
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
              <PiSparkle className="h-3 w-3" />
              Auto-fill with AI
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
        {/* Origin Country - Enhanced with flags */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Globe className="h-4 w-4 text-blue-500" />
              Origin Country
              {selectedCountry && (
                <span className="text-lg">{getCountryFlag(selectedCountry)}</span>
              )}
            </label>

            <div className="relative">
              <select
                className="block w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('originCountry')}
              >
                <option value="">Select a country</option>
                {countries.map((country) => (
                  <option key={country.value} value={country.value}>
                    {getCountryFlag(country.value)} {country.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {selectedCountry && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3"
              >
                <Badge color="info" className="text-xs">
                  {getCountryFlag(selectedCountry)}{' '}
                  {
                    countries.find((c) => c.value === selectedCountry)?.label
                  }
                </Badge>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Region */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MapPin className="h-4 w-4 text-red-500" />
              Region
            </label>

            <Input
              placeholder="e.g., Speyside, Napa Valley, Bordeaux, Islay"
              {...register('region')}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Specific geographical region within the country
            </Text>
          </div>
        </motion.div>

        {/* Appellation */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Award className="h-4 w-4 text-amber-500" />
              Appellation / PDO
              <Tooltip content="Protected Designation of Origin - official certification of origin">
                <Info className="h-4 w-4 cursor-help text-gray-400" />
              </Tooltip>
            </label>

            <Input
              placeholder="e.g., Champagne, Cognac, Scotch Whisky, DOC"
              {...register('appellation')}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Official protected designation of origin
            </Text>
          </div>
        </motion.div>

        {/* Producer */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Building className="h-4 w-4 text-purple-500" />
              Producer
            </label>

            <Input
              placeholder="e.g., Midleton Distillery, Moët & Chandon"
              {...register('producer')}
            />

            <Text className="mt-2 text-xs text-gray-500">
              The company or facility that produces the beverage
            </Text>
          </div>
        </motion.div>

        {/* Brand */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Tag className="h-4 w-4 text-pink-500" />
              Brand Name
            </label>

            <Select
              placeholder={isLoadingBrands ? 'Loading brands...' : 'Search and select brand'}
              options={brands.map((brand) => ({
                value: brand._id,
                label: `${brand.name}${brand.isPremium ? ' ⭐' : ''}${brand.verified ? ' ✓' : ''}`,
              }))}
              value={brands.find((b) => b._id === watch('brand')) ? {
                value: watch('brand'),
                label: `${brands.find((b) => b._id === watch('brand'))?.name}${brands.find((b) => b._id === watch('brand'))?.isPremium ? ' ⭐' : ''}${brands.find((b) => b._id === watch('brand'))?.verified ? ' ✓' : ''}`,
              } : ''}
              onChange={(option: SelectOption) => {
                setValue('brand', option.value as string);
              }}
              disabled={isLoadingBrands}
              className="w-full"
            />

            <Text className="mt-2 text-xs text-gray-500">
              The brand under which the product is sold
            </Text>
          </div>
        </motion.div>

        {/* Vintage with Age Calculation */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Calendar className="h-4 w-4 text-green-500" />
              Vintage (Year)
            </label>

            <Input
              type="number"
              min="1800"
              max={currentYear + 1}
              placeholder={`e.g., ${currentYear - 5}`}
              {...register('vintage', { valueAsNumber: true })}
            />

            {vintage && vintage <= currentYear && vintage >= 1800 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2"
              >
                <Badge color="success" className="text-xs">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {estimatedAge} years old
                </Badge>
                <Text className="text-xs text-gray-500">
                  (as of {currentYear})
                </Text>
              </motion.div>
            )}

            <Text className="mt-2 text-xs text-gray-500">
              For wines, spirits, and aged beverages
            </Text>
          </div>
        </motion.div>

        {/* Age Statement */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock className="h-4 w-4 text-teal-500" />
              Age Statement
            </label>

            <Input
              placeholder="e.g., 12 Year Old, XO, NAS, VSOP"
              {...register('ageStatement')}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Official age designation on the label
            </Text>
          </div>
        </motion.div>

        {/* Age (numeric) */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 text-sm font-semibold text-gray-900">
              Age (Years)
            </label>

            <Input
              type="number"
              min="0"
              placeholder="e.g., 12"
              {...register('age', { valueAsNumber: true })}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Numeric age for filtering and sorting
            </Text>
          </div>
        </motion.div>

        {/* Specific Producer Types */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Factory className="h-4 w-4 text-gray-500" />
              Producer Details
            </label>

            <div className="grid gap-4 @md:grid-cols-3">
              {/* Distillery */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Flame className="h-4 w-4 text-amber-600" />
                  Distillery Name
                </label>
                <Input
                  placeholder="e.g., Midleton"
                  {...register('distilleryName')}
                  className="bg-white"
                />
              </div>

              {/* Brewery */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Beer className="h-4 w-4 text-yellow-600" />
                  Brewery Name
                </label>
                <Input
                  placeholder="e.g., Guinness"
                  {...register('breweryName')}
                  className="bg-white"
                />
              </div>

              {/* Winery */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Grape className="h-4 w-4 text-purple-600" />
                  Winery Name
                </label>
                <Input
                  placeholder="e.g., Château Margaux"
                  {...register('wineryName')}
                  className="bg-white"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Production Method - Visual Selector */}
        <motion.div variants={itemVariants} className="@2xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Factory className="h-4 w-4 text-indigo-500" />
              Production Method
              {productionMethod && (
                <Badge color="info" className="ml-2 text-xs capitalize">
                  {productionMethod.replace(/_/g, ' ')}
                </Badge>
              )}
            </label>

            <div className="grid grid-cols-2 gap-3 @sm:grid-cols-3 @lg:grid-cols-4">
              {productionMethods.slice(1).map((method) => {
                const Icon = method.icon;
                const isSelected = productionMethod === method.value;
                return (
                  <motion.button
                    key={method.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setValue('productionMethod', method.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200',
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-6 w-6',
                        isSelected ? 'text-blue-600' : 'text-gray-500'
                      )}
                    />
                    <span
                      className={cn(
                        'text-center text-xs font-medium capitalize',
                        isSelected ? 'text-blue-700' : 'text-gray-700'
                      )}
                    >
                      {method.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Cask Type & Finish */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Wine className="h-4 w-4 text-amber-700" />
              Cask / Barrel Type
            </label>

            <Input
              placeholder="e.g., Bourbon Barrel, Sherry Cask, American Oak"
              {...register('caskType')}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Type of barrels used for aging
            </Text>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Wine className="h-4 w-4 text-rose-600" />
              Cask Finish
            </label>

            <Input
              placeholder="e.g., Port Cask Finish, Wine Cask Finish"
              {...register('finish')}
            />

            <Text className="mt-2 text-xs text-gray-500">
              Secondary cask finish (if applicable)
            </Text>
          </div>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}
