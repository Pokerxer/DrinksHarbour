// @ts-nocheck
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import toast from 'react-hot-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Text, Badge } from 'rizzui';
import { FormProvider, useForm, SubmitHandler } from 'react-hook-form';
import cn from '@core/utils/class-names';
import {
  PiSpinner,
  PiCheck,
  PiWarning,
  PiArrowLeft,
  PiArrowRight,
  PiFloppyDisk,
  PiCaretDown,
  PiClock,
  PiGear,
  PiArchive,
  PiCopy,
  PiTrash,
  PiPlus,
  PiSignature,
  PiChartLine,
  PiTag,
  PiCurrencyNgn,
  PiPercent,
  PiArchive as PiArchiveBox,
  PiRuler,
  PiFactory,
  PiToggleRight,
  PiGift,
  PiTrolley,
  PiSliders,
  PiWarningCircle,
  PiWarningDiamond,
  PiPackage,
  PiFileText,
  PiShoppingCart,
  PiTrendUp,
  PiTrendDown,
  PiDotsThree,
  PiGlobe,
  PiArrowLineLeft,
  PiArrowLineRight,
  PiList,
  PiX,
} from 'react-icons/pi';
import SubProductBasicInfo from './basic-info';
import SubProductPricing from './pricing';
import SubProductInventory from './inventory';
import SubProductSizes from './sizes';
import SubProductVendor from './vendor';
import SubProductStatusVisibility from './status-visibility';
import SubProductPromotions from './promotions';
import SubProductShipping from './shipping';
import SubProductTenantOverrides from './tenant-overrides';
import {
  SubProductInput,
  subProductFormSchema,
} from '@/validators/sub-product.schema';
import { routes } from '@/config/routes';
import { subproductService } from '@/services/subproduct.service';
import { inventoryService } from '@/services/inventory.service';
import {
  transformFormData,
  transformBackendToForm,
} from '@/utils/transformers/subProduct.transformer';
import { defaultValues, formParts } from './form-utils';

const STEPS = [
  {
    key: formParts.basicInfo,
    label: 'Basic Info',
    icon: PiTag,
    color: 'blue' as const,
    description: 'Product selection',
  },
  {
    key: formParts.pricing,
    label: 'Pricing',
    icon: PiCurrencyNgn,
    color: 'green' as const,
    description: 'Prices & margins',
  },
  {
    key: formParts.inventory,
    label: 'Inventory',
    icon: PiArchiveBox,
    color: 'purple' as const,
    description: 'Stock levels',
  },
  {
    key: formParts.sizes,
    label: 'Sizes',
    icon: PiRuler,
    color: 'cyan' as const,
    description: 'Size variants',
  },
  {
    key: formParts.vendor,
    label: 'Vendor',
    icon: PiFactory,
    color: 'yellow' as const,
    description: 'Supplier info',
  },
  {
    key: formParts.statusVisibility,
    label: 'Status',
    icon: PiToggleRight,
    color: 'pink' as const,
    description: 'Visibility',
  },
  {
    key: formParts.promotions,
    label: 'Promotions',
    icon: PiGift,
    color: 'rose' as const,
    description: 'Discounts',
  },
  {
    key: formParts.shipping,
    label: 'Shipping',
    icon: PiTrolley,
    color: 'indigo' as const,
    description: 'Logistics',
  },
  {
    key: formParts.tenantOverrides,
    label: 'Overrides',
    icon: PiSliders,
    color: 'gray' as const,
    description: 'Custom content',
  },
];

const COMPONENTS: Record<string, React.FC> = {
  [formParts.basicInfo]: SubProductBasicInfo,
  [formParts.pricing]: SubProductPricing,
  [formParts.inventory]: SubProductInventory,
  [formParts.sizes]: SubProductSizes,
  [formParts.vendor]: SubProductVendor,
  [formParts.statusVisibility]: SubProductStatusVisibility,
  [formParts.promotions]: SubProductPromotions,
  [formParts.shipping]: SubProductShipping,
  [formParts.tenantOverrides]: SubProductTenantOverrides,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
    },
  },
};

const successVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
    },
  },
};

// Smart Button Component - Smaller and more compact
interface SmartButtonProps {
  icon: React.ReactNode;
  value: string | React.ReactNode;
  label: string;
  iconColor?: string;
  onClick?: () => void;
  title?: string;
}

const SmartButton = ({
  icon,
  value,
  label,
  iconColor = 'text-gray-600',
  onClick,
  title,
}: SmartButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="group flex min-w-[44px] flex-shrink-0 flex-col items-center justify-center rounded-md border border-gray-200 bg-white px-0.5 py-1 transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm xs:min-w-[48px] xs:px-1 sm:min-w-[56px]"
  >
    <div className="flex items-center gap-0.5 text-gray-900">
      <span className={cn('flex-shrink-0', iconColor)}>{icon}</span>
      <span className="max-w-[40px] truncate text-[10px] font-bold xs:text-xs">
        {value}
      </span>
    </div>
    <span className="mt-0.5 max-w-[50px] truncate text-[6px] font-medium uppercase tracking-wide text-gray-500 xs:text-[7px]">
      {label}
    </span>
  </button>
);

export default function CreateEditSubProduct({
  slug,
  id,
  product,
  className,
}: {
  slug?: string;
  id?: string;
  product?: SubProductInput;
  className?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [createdSubProductId, setCreatedSubProductId] = useState<string | null>(
    null
  );
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [showStepDropdown, setShowStepDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showSmartButtons, setShowSmartButtons] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const smartButtonsDropdownRef = useRef<HTMLDivElement>(null);

  // Product navigation state (mock data - replace with actual product list)
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [totalProducts] = useState(10); // Replace with actual count

  const handlePrevProduct = () => {
    if (currentProductIndex > 0) {
      setCurrentProductIndex((prev) => prev - 1);
      console.log('Navigate to previous product');
    }
  };

  const handleNextProduct = () => {
    if (currentProductIndex < totalProducts - 1) {
      setCurrentProductIndex((prev) => prev + 1);
      console.log('Navigate to next product');
    }
  };

  const isEditMode = Boolean(slug || id);

  const methods = useForm<SubProductInput>({
    defaultValues: defaultValues(),
    resolver: zodResolver(subProductFormSchema),
    mode: 'onBlur',
  });

  const watch = methods.watch;
  const formState = methods.formState || {};
  const errors = formState.errors || {};
  const isValid = formState.isValid;
  const isDirty = formState.isDirty;

  // Helper function to flatten nested error objects
  const getFieldErrors = (errs: any): string[] => {
    const flatten = (obj: any, prefix = ''): string[] => {
      let fields: string[] = [];
      for (const key in obj) {
        const fieldName = prefix ? `${prefix}.${key}` : key;
        if (obj[key]?.message) {
          fields.push(fieldName);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          fields = fields.concat(flatten(obj[key], fieldName));
        }
      }
      return fields;
    };
    return flatten(errs);
  };

  const fieldErrors = getFieldErrors(errors);

  // Get product name for header display
  const productName = watch('name');
  const newProductName = watch('newProductData.name');
  const displayTitle = isEditMode
    ? productName || 'Edit Sub Product'
    : newProductName || 'Create Sub Product';

  useEffect(() => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      setCreatedSubProductId(null);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode && (slug || id)) {
      setIsFetching(true);
      subproductService
        .getSubProduct(slug || id || '', session?.user?.token || '')
        .then((response) => {
          // API returns { success: true, data: { subProduct: {...} } }
          const subProductData =
            response?.data?.subProduct || response?.subProduct || response;
          console.log('📥 Edit mode - Raw API response:', response);
          console.log(
            '📥 Edit mode - Extracted subProduct data:',
            subProductData
          );
          const transformed = transformBackendToForm(subProductData);
          console.log('📥 Edit mode - Transformed form data:', transformed);
          methods.reset(transformed);
        })
        .catch((error) => {
          console.error('Failed to load sub product:', error);
          toast.error('Failed to load sub product');
        })
        .finally(() => setIsFetching(false));
    }
  }, [slug, id, session, isEditMode, methods]);

  useEffect(() => {
    if (!isDirty) return;

    const interval = setInterval(() => {
      const data = watch();
      localStorage.setItem(
        'subproduct-draft',
        JSON.stringify({
          ...data,
          _savedAt: new Date().toISOString(),
        })
      );
      setSaveStatus('saved');
      setLastSaved(new Date());
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 30000);

    return () => clearInterval(interval);
  }, [isDirty, watch]);

  useEffect(() => {
    const draft = localStorage.getItem('subproduct-draft');
    if (draft && !isEditMode) {
      try {
        const parsed = JSON.parse(draft);
        delete parsed._savedAt;
        methods.reset(parsed);
        toast.success('Draft restored from auto-save');
      } catch (e) {
        console.error('Failed to restore draft:', e);
      }
    }
  }, [isEditMode, methods]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSettingsDropdown(false);
      }
      if (
        smartButtonsDropdownRef.current &&
        !smartButtonsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSmartButtons(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNext = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    if (currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setDirection(stepIndex > currentStep ? 1 : -1);
    setCurrentStep(stepIndex);
  };

  const onSubmit: SubmitHandler<SubProductInput> = async (data) => {
    console.log('=== FORM DATA SUBMITTED ===', JSON.stringify(data, null, 2));

    // Validate: either product must be selected OR createNewProduct must be true
    // Check both flat (root) and nested (subProductData) paths
    const productId = data.product || data.subProductData?.product;
    const createNew =
      data.createNewProduct || data.subProductData?.createNewProduct;

    if (!productId && !createNew) {
      toast.error('Please select a parent product or create a new product');
      return;
    }

    // Debug session state
    console.log('=== SESSION DEBUG ===', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasToken: !!session?.user?.token,
      tokenLength: session?.user?.token?.length || 0,
      userEmail: session?.user?.email || 'N/A',
    });

    if (!session?.user?.token) {
      toast.error('Authentication required. Please sign in again.');
      console.error('No auth token found. Session:', session);
      return;
    }

    setLoading(true);
    setSaveStatus('saving');

    try {
      console.log('=== RAW FORM DATA ===', JSON.stringify(data, null, 2));

      const transformedData = transformFormData(data);
      console.log(
        '=== TRANSFORMED DATA (SENDING TO SERVER) ===',
        JSON.stringify(transformedData, null, 2)
      );

      if (isEditMode && id) {
        // Fetch current subproduct to compare stock changes made manually in the form
        const currentSubProductResponse = await subproductService.getSubProduct(
          id,
          session.user.token
        );
        const currentSubProduct =
          currentSubProductResponse?.data?.subProduct ||
          currentSubProductResponse?.subProduct ||
          currentSubProductResponse;

        const currentStock = currentSubProduct?.totalStock || 0;
        const newStock = transformedData.totalStock || 0;
        const stockDelta = newStock - currentStock;

        // Perform the update
        await subproductService.updateSubProduct(
          id,
          transformedData,
          session.user.token
        );

        // Handle inventory history adjustment based on the form changes
        if (stockDelta !== 0) {
          try {
            if (stockDelta > 0) {
              await inventoryService.recordReceived(
                id,
                stockDelta,
                session.user.token,
                { reason: 'Form Update (Added)' }
              );
            } else {
              await inventoryService.adjustInventory(
                id,
                stockDelta, // AdjustInventory expects the delta (e.g. -5) or removed amount, assuming your backend adjusts by delta
                'Form Update (Removed)',
                session.user.token
              );
            }
            console.log(
              `Inventory successfully adjusted by ${stockDelta} via form save.`
            );
          } catch (invError) {
            console.error(
              'Failed to record inventory movement on form save:',
              invError
            );
          }
        }

        toast.success('Sub Product updated successfully!');
      } else {
        const response = await subproductService.createSubProduct(
          transformedData,
          session.user.token
        );
        const newSubProductId =
          response?.data?.subProduct?._id || response?.data?.subProduct?.id;
        if (newSubProductId) {
          setCreatedSubProductId(newSubProductId);

          // Record initial stock if greater than 0
          if (transformedData.totalStock && transformedData.totalStock > 0) {
            try {
              await inventoryService.recordReceived(
                newSubProductId,
                transformedData.totalStock,
                session.user.token,
                { reason: 'Initial Stock (Creation)' }
              );
              console.log('Initial stock movement recorded.');
            } catch (invError) {
              console.error(
                'Failed to record initial stock movement:',
                invError
              );
            }
          }
        }
        toast.success('Sub Product created successfully!');
      }

      setSaveStatus('saved');
      setIsSuccess(true);
      localStorage.removeItem('subproduct-draft');

      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error: any) {
      setSaveStatus('error');
      console.error('=== SAVE ERROR ===', error);

      // Handle specific error types with better messages
      const errorMessage = error.message || 'Failed to save sub product';

      if (
        errorMessage.includes('version') ||
        errorMessage.includes('conflict')
      ) {
        toast.error(
          'This record was modified by another user. Please refresh and try again.'
        );
      } else if (
        errorMessage.includes('duplicate') ||
        errorMessage.includes('already exists')
      ) {
        toast.error(
          'This product already exists in your catalog. Try editing the existing entry instead.'
        );
      } else if (
        errorMessage.includes('Product ID is required') ||
        errorMessage.includes('product')
      ) {
        toast.error(
          'Please select a product or create a new one before saving.'
        );
      } else if (
        errorMessage.includes('cost price') ||
        errorMessage.includes('costPrice')
      ) {
        toast.error('Please enter a valid cost price greater than 0.');
      } else if (
        errorMessage.includes('Tenant') ||
        errorMessage.includes('tenant')
      ) {
        toast.error('Session error. Please sign out and sign back in.');
      } else if (
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('401')
      ) {
        toast.error('Your session has expired. Please sign in again.');
      } else if (
        errorMessage.includes('network') ||
        errorMessage.includes('fetch')
      ) {
        toast.error(
          'Network error. Please check your internet connection and try again.'
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  if (isSuccess) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={successVariants}
        className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden"
      >
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.15}
          colors={[
            '#3B82F6',
            '#10B981',
            '#F59E0B',
            '#EF4444',
            '#8B5CF6',
            '#EC4899',
          ]}
        />
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg"
        >
          <PiCheck className="h-12 w-12 text-white" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-2 text-2xl font-bold text-gray-900"
        >
          {isEditMode
            ? 'Sub Product Updated Successfully!'
            : 'Sub Product Created Successfully!'}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-500"
        >
          {isEditMode
            ? 'Your changes have been saved.'
            : 'Your new sub product has been created.'}
        </motion.p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!isEditMode && createdSubProductId && (
            <Button
              variant="solid"
              onClick={() =>
                router.push(
                  `/ecommerce/sub-products/${createdSubProductId}/edit`
                )
              }
            >
              Edit Created Product
            </Button>
          )}
          <Button
            variant="solid"
            onClick={() => router.push(routes.eCommerce.subProducts)}
          >
            View Sub Products
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (createdSubProductId) {
                router.push(`/ecommerce/sub-products/create`);
                setTimeout(() => {
                  setIsSuccess(false);
                  setCreatedSubProductId(null);
                  methods.reset(defaultValues());
                }, 100);
              } else {
                setIsSuccess(false);
              }
            }}
          >
            Create Another
          </Button>
          <Button variant="outline" onClick={() => setIsSuccess(false)}>
            Continue Editing
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="min-h-screen w-full"
      >
        {/* Header Section */}
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white">
          {/* Progress Bar */}
          <div className="h-1 w-full bg-gray-100">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Main Header Content */}
          <div className="px-4 py-3 sm:px-6 lg:px-8">
            {/* Main Header: [Left: Title/Actions] [Middle: Smart Buttons] [Right: Navigation] */}
            <div className="flex items-center justify-between gap-2 lg:gap-4">
              {/* Left: Back + Title + Save + Settings + Mobile Toggle */}
              <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
                <Button
                  variant="text"
                  onClick={() => router.push(routes.eCommerce.subProducts)}
                  className="flex-shrink-0"
                >
                  <PiArrowLeft className="h-5 w-5" />
                </Button>

                <div className="min-w-0 flex-1 lg:flex-1">
                  <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
                    {displayTitle}
                  </h1>
                  {lastSaved && (
                    <Text className="flex hidden items-center gap-1 text-xs text-gray-400 sm:flex">
                      <PiClock className="h-3 w-3" />
                      {lastSaved.toLocaleTimeString()}
                    </Text>
                  )}
                </div>

                {/* Save & Settings */}
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={methods.handleSubmit(onSubmit)}
                    disabled={isLoading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm transition-all hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Save"
                  >
                    {isLoading ? (
                      <PiSpinner className="h-4 w-4 animate-spin" />
                    ) : (
                      <PiFloppyDisk className="h-4 w-4" />
                    )}
                  </button>

                  {/* Settings Dropdown */}
                  <div className="relative" ref={settingsDropdownRef}>
                    <button
                      type="button"
                      onClick={() =>
                        setShowSettingsDropdown(!showSettingsDropdown)
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm transition-all hover:border-gray-400 hover:bg-gray-50"
                      title="Settings"
                    >
                      <PiGear className="h-4 w-4" />
                    </button>

                    <AnimatePresence>
                      {showSettingsDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-2 shadow-xl"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Archive clicked');
                              setShowSettingsDropdown(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <PiArchive className="h-4 w-4 text-gray-500" />
                            Archive
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Duplicate clicked');
                              setShowSettingsDropdown(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <PiCopy className="h-4 w-4 text-gray-500" />
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Delete clicked');
                              setShowSettingsDropdown(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                          >
                            <PiTrash className="h-4 w-4" />
                            Delete
                          </button>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Add Properties clicked');
                              setShowSettingsDropdown(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <PiPlus className="h-4 w-4 text-gray-500" />
                            Add Properties
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Request Signature clicked');
                              setShowSettingsDropdown(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <PiSignature className="h-4 w-4 text-gray-500" />
                            Request Signature
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Pricelist Report clicked');
                              setShowSettingsDropdown(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <PiChartLine className="h-4 w-4 text-gray-500" />
                            Pricelist Report
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Mobile Toggle for Smart Buttons - Opens Dropdown */}
                  <div
                    className="relative lg:hidden"
                    ref={smartButtonsDropdownRef}
                  >
                    <button
                      type="button"
                      onClick={() => setShowSmartButtons(!showSmartButtons)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm transition-all hover:bg-gray-50"
                      title="More Actions"
                    >
                      {showSmartButtons ? (
                        <PiX className="h-4 w-4" />
                      ) : (
                        <PiDotsThree className="h-4 w-4" />
                      )}
                    </button>

                    <AnimatePresence>
                      {showSmartButtons && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-3 shadow-xl"
                        >
                          <div className="border-b border-gray-100 px-3 pb-2">
                            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Quick Stats
                            </Text>
                          </div>
                          <div className="grid grid-cols-2 gap-2 p-3">
                            <SmartButton
                              icon={<PiGlobe className="h-3 w-3" />}
                              value={isEditMode ? 'View' : '—'}
                              label="Website"
                              iconColor="text-indigo-600"
                              title="View on Website"
                              onClick={() => {
                                const productSlug = slug || id;
                                if (productSlug) {
                                  window.open(
                                    `/products/${productSlug}`,
                                    '_blank'
                                  );
                                } else {
                                  toast.error('Product not saved yet');
                                }
                                setShowSmartButtons(false);
                              }}
                            />
                            <SmartButton
                              icon={<PiArrowLineLeft className="h-3 w-3" />}
                              value={String(watch('quantity') || 0)}
                              label="In & Out"
                              iconColor="text-teal-600"
                              title="View Stock Movements"
                              onClick={() => {
                                toast.info(
                                  'Stock movements feature coming soon'
                                );
                                setShowSmartButtons(false);
                              }}
                            />
                            <SmartButton
                              icon={<PiPackage className="h-3 w-3" />}
                              value={String(watch('quantity') || 0)}
                              label="On Hand"
                              iconColor="text-blue-600"
                              title="Current Stock"
                              onClick={() => {
                                toast.info('Stock details feature coming soon');
                                setShowSmartButtons(false);
                              }}
                            />
                            <SmartButton
                              icon={<PiTrendUp className="h-3 w-3" />}
                              value="—"
                              label="Forecasted"
                              iconColor="text-green-600"
                              title="Forecasted Stock"
                              onClick={() => {
                                toast.info('Forecast feature coming soon');
                                setShowSmartButtons(false);
                              }}
                            />
                            <SmartButton
                              icon={<PiFileText className="h-3 w-3" />}
                              value="0"
                              label="Documents"
                              iconColor="text-orange-600"
                              title="View Documents"
                              onClick={() => {
                                toast.info('Documents feature coming soon');
                                setShowSmartButtons(false);
                              }}
                            />
                            <SmartButton
                              icon={<PiShoppingCart className="h-3 w-3" />}
                              value="0"
                              label="Purchased"
                              iconColor="text-purple-600"
                              title="Purchase History"
                              onClick={() => {
                                toast.info(
                                  'Purchase history feature coming soon'
                                );
                                setShowSmartButtons(false);
                              }}
                            />
                            <SmartButton
                              icon={<PiTrendDown className="h-3 w-3" />}
                              value="0"
                              label="Sold"
                              iconColor="text-red-600"
                              title="Sales History"
                              onClick={() => {
                                toast.info('Sales history feature coming soon');
                                setShowSmartButtons(false);
                              }}
                            />
                            <SmartButton
                              icon={<PiWarningDiamond className="h-3 w-3" />}
                              value="—"
                              label="Reorder"
                              iconColor="text-amber-600"
                              title="Reordering Rules"
                              onClick={() => {
                                toast.info(
                                  'Reordering rules feature coming soon'
                                );
                                setShowSmartButtons(false);
                              }}
                            />
                          </div>
                          <div className="border-t border-gray-100 px-3 pt-2">
                            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              More Actions
                            </Text>
                          </div>
                          <div className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                console.log('Rules clicked');
                                setShowSmartButtons(false);
                                toast.info('Rules feature coming soon');
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <PiList className="h-4 w-4 text-gray-500" />
                              Rules
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                console.log('Pricelists clicked');
                                setShowSmartButtons(false);
                                toast.info('Pricelists feature coming soon');
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <PiCurrencyNgn className="h-4 w-4 text-gray-500" />
                              Pricelists
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                console.log('History clicked');
                                setShowSmartButtons(false);
                                toast.info('History feature coming soon');
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <PiClock className="h-4 w-4 text-gray-500" />
                              History
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                console.log('Inventory Report clicked');
                                setShowSmartButtons(false);
                                toast.info(
                                  'Inventory report feature coming soon'
                                );
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <PiChartLine className="h-4 w-4 text-gray-500" />
                              Inventory Report
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                console.log('Print Labels clicked');
                                setShowSmartButtons(false);
                                toast.info('Print labels feature coming soon');
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <PiPackage className="h-4 w-4 text-gray-500" />
                              Print Labels
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                console.log('Export clicked');
                                setShowSmartButtons(false);
                                toast.info('Export feature coming soon');
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <PiArrowRight className="h-4 w-4 text-gray-500" />
                              Export Data
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Middle: Smart Buttons Bar - Desktop Only */}
              <div className="hidden flex-1 items-center justify-center gap-1.5 lg:flex">
                <SmartButton
                  icon={<PiGlobe className="h-2.5 w-2.5 xs:h-3 xs:w-3" />}
                  value={isEditMode ? 'View' : '—'}
                  label="Website"
                  iconColor="text-indigo-600"
                  title="View on Website"
                  onClick={() => {
                    const productSlug = slug || id;
                    if (productSlug) {
                      window.open(`/products/${productSlug}`, '_blank');
                    } else {
                      toast.error('Product not saved yet');
                    }
                  }}
                />

                <SmartButton
                  icon={
                    <PiArrowLineLeft className="h-2.5 w-2.5 xs:h-3 xs:w-3" />
                  }
                  value={String(watch('quantity') || 0)}
                  label="In & Out"
                  iconColor="text-teal-600"
                  title="View Stock Movements"
                  onClick={() => {
                    console.log('Open stock movements modal');
                    toast.info('Stock movements feature coming soon');
                  }}
                />

                <SmartButton
                  icon={<PiPackage className="h-2.5 w-2.5 xs:h-3 xs:w-3" />}
                  value={String(watch('quantity') || 0)}
                  label="On Hand"
                  iconColor="text-blue-600"
                  title="Current Stock"
                  onClick={() => {
                    console.log('Open stock details');
                    toast.info('Stock details feature coming soon');
                  }}
                />

                <SmartButton
                  icon={<PiTrendUp className="h-2.5 w-2.5 xs:h-3 xs:w-3" />}
                  value="—"
                  label="Forecasted"
                  iconColor="text-green-600"
                  title="Forecasted Stock"
                  onClick={() => {
                    console.log('Open forecast modal');
                    toast.info('Forecast feature coming soon');
                  }}
                />

                <SmartButton
                  icon={<PiFileText className="h-2.5 w-2.5 xs:h-3 xs:w-3" />}
                  value="0"
                  label="Documents"
                  iconColor="text-orange-600"
                  title="View Documents"
                  onClick={() => {
                    console.log('Navigate to documents');
                    toast.info('Documents feature coming soon');
                  }}
                />

                <SmartButton
                  icon={
                    <PiShoppingCart className="h-2.5 w-2.5 xs:h-3 xs:w-3" />
                  }
                  value="0"
                  label="Purchased"
                  iconColor="text-purple-600"
                  title="Purchase History"
                  onClick={() => {
                    console.log('Open purchase history');
                    toast.info('Purchase history feature coming soon');
                  }}
                />

                <SmartButton
                  icon={<PiTrendDown className="h-2.5 w-2.5 xs:h-3 xs:w-3" />}
                  value="0"
                  label="Sold"
                  iconColor="text-red-600"
                  title="Sales History"
                  onClick={() => {
                    console.log('Open sales history');
                    toast.info('Sales history feature coming soon');
                  }}
                />

                <SmartButton
                  icon={
                    <PiWarningDiamond className="h-2.5 w-2.5 xs:h-3 xs:w-3" />
                  }
                  value="—"
                  label="Reorder"
                  iconColor="text-amber-600"
                  title="Reordering Rules"
                  onClick={() => {
                    console.log('Open reordering rules');
                    toast.info('Reordering rules feature coming soon');
                  }}
                />
              </div>

              {/* Right: Navigation Arrows + Save Status */}
              <div className="flex flex-shrink-0 items-center gap-2 lg:gap-3">
                {/* Save Status Indicators */}
                <AnimatePresence mode="wait">
                  {saveStatus === 'saving' && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="hidden items-center gap-2 text-sm text-blue-600 sm:flex"
                    >
                      <PiSpinner className="h-4 w-4 animate-spin" />
                      <span className="hidden lg:inline">Saving...</span>
                    </motion.div>
                  )}
                  {saveStatus === 'saved' && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="hidden items-center gap-2 text-sm text-green-600 sm:flex"
                    >
                      <PiCheck className="h-4 w-4" />
                      <span className="hidden lg:inline">Saved</span>
                    </motion.div>
                  )}
                  {saveStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="hidden items-center gap-2 text-sm text-red-600 sm:flex"
                    >
                      <PiWarningCircle className="h-4 w-4" />
                      <span className="hidden lg:inline">Error</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation Arrows */}
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={handlePrevProduct}
                    disabled={currentProductIndex === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Previous Product"
                  >
                    <PiArrowLeft className="h-4 w-4" />
                  </button>
                  <Text className="min-w-[50px] px-2 text-center text-sm font-semibold text-gray-700">
                    {currentProductIndex + 1} / {totalProducts}
                  </Text>
                  <button
                    type="button"
                    onClick={handleNextProduct}
                    disabled={currentProductIndex === totalProducts - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Next Product"
                  >
                    <PiArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step Navigation - Desktop */}
          <div className="hidden border-t border-gray-100 px-4 py-2 sm:px-6 lg:block lg:px-8">
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {STEPS.map((step, index) => (
                <button
                  key={step.key}
                  onClick={() => handleStepClick(index)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all',
                    index === currentStep && 'bg-blue-50 ring-1 ring-blue-200',
                    completedSteps.has(index) &&
                      index !== currentStep &&
                      'text-green-600 hover:bg-green-50',
                    !completedSteps.has(index) &&
                      index !== currentStep &&
                      'text-gray-500 hover:bg-gray-50'
                  )}
                >
                  <motion.span
                    animate={{ scale: index === currentStep ? 1.1 : 1 }}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors',
                      index < currentStep || completedSteps.has(index)
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-600'
                    )}
                    style={{
                      backgroundColor:
                        index === currentStep
                          ? step.color === 'blue'
                            ? '#2563eb'
                            : step.color === 'green'
                              ? '#16a34a'
                              : step.color === 'orange'
                                ? '#ea580c'
                                : step.color === 'purple'
                                  ? '#9333ea'
                                  : step.color === 'cyan'
                                    ? '#0891b2'
                                    : step.color === 'yellow'
                                      ? '#ca8a04'
                                      : step.color === 'pink'
                                        ? '#db2777'
                                        : step.color === 'rose'
                                          ? '#e11d48'
                                          : step.color === 'indigo'
                                            ? '#4f46e5'
                                            : '#6b7280'
                          : index < currentStep || completedSteps.has(index)
                            ? '#22c55e'
                            : undefined,
                    }}
                  >
                    {index < currentStep || completedSteps.has(index) ? (
                      <PiCheck className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </motion.span>
                  <span className="whitespace-nowrap">{step.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step Navigation - Mobile */}
          <div className="border-t border-gray-100 px-4 py-2 lg:hidden">
            <div className="relative">
              <button
                onClick={() => setShowStepDropdown(!showStepDropdown)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-white"
                    style={{
                      backgroundColor:
                        STEPS[currentStep].color === 'blue'
                          ? '#2563eb'
                          : STEPS[currentStep].color === 'green'
                            ? '#16a34a'
                            : STEPS[currentStep].color === 'orange'
                              ? '#ea580c'
                              : STEPS[currentStep].color === 'purple'
                                ? '#9333ea'
                                : STEPS[currentStep].color === 'cyan'
                                  ? '#0891b2'
                                  : STEPS[currentStep].color === 'yellow'
                                    ? '#ca8a04'
                                    : STEPS[currentStep].color === 'pink'
                                      ? '#db2777'
                                      : STEPS[currentStep].color === 'rose'
                                        ? '#e11d48'
                                        : STEPS[currentStep].color === 'indigo'
                                          ? '#4f46e5'
                                          : '#6b7280',
                    }}
                  >
                    {currentStep + 1}
                  </span>
                  {STEPS[currentStep].label}
                </span>
                <PiCaretDown className="h-4 w-4" />
              </button>

              <AnimatePresence>
                {showStepDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                  >
                    {STEPS.map((step, index) => (
                      <button
                        key={step.key}
                        onClick={() => {
                          handleStepClick(index);
                          setShowStepDropdown(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-50',
                          index === currentStep && 'bg-blue-50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full text-xs text-white',
                            index < currentStep && 'bg-green-500',
                            index === currentStep && 'bg-blue-600',
                            index > currentStep && 'bg-gray-400'
                          )}
                        >
                          {index < currentStep ? (
                            <PiCheck className="h-4 w-4" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span
                          className={
                            index === currentStep ? 'text-blue-700' : ''
                          }
                        >
                          {step.label}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <FormProvider {...methods}>
            {isFetching ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                  <PiSpinner className="h-8 w-8 animate-spin text-blue-600" />
                </div>
                <Text className="mt-4 text-gray-500">
                  Loading sub product...
                </Text>
              </div>
            ) : (
              <motion.div
                key={STEPS[currentStep].key}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6"
              >
                {/* Step Header */}
                <div className="mb-6 flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      STEPS[currentStep].color === 'blue' &&
                        'bg-blue-100 text-blue-600',
                      STEPS[currentStep].color === 'green' &&
                        'bg-green-100 text-green-600',
                      STEPS[currentStep].color === 'orange' &&
                        'bg-orange-100 text-orange-600',
                      STEPS[currentStep].color === 'purple' &&
                        'bg-purple-100 text-purple-600',
                      STEPS[currentStep].color === 'cyan' &&
                        'bg-cyan-100 text-cyan-600',
                      STEPS[currentStep].color === 'yellow' &&
                        'bg-yellow-100 text-yellow-600',
                      STEPS[currentStep].color === 'pink' &&
                        'bg-pink-100 text-pink-600',
                      STEPS[currentStep].color === 'rose' &&
                        'bg-rose-100 text-rose-600',
                      STEPS[currentStep].color === 'indigo' &&
                        'bg-indigo-100 text-indigo-600',
                      STEPS[currentStep].color === 'gray' &&
                        'bg-gray-100 text-gray-600'
                    )}
                  >
                    <span className="text-lg font-bold">{currentStep + 1}</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {STEPS[currentStep].label}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {STEPS[currentStep].description}
                    </p>
                  </div>
                </div>

                {/* Step Content */}
                <motion.div
                  variants={sectionVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {(() => {
                    const Component = COMPONENTS[STEPS[currentStep].key];
                    return Component ? <Component /> : null;
                  })()}
                </motion.div>
              </motion.div>
            )}
          </FormProvider>

          {/* Bottom Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white px-4 py-4 shadow-lg sm:px-6 lg:px-8"
          >
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
              >
                <PiArrowLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                {fieldErrors.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <PiWarning className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-amber-600">
                        Please fix these fields:
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {fieldErrors.slice(0, 8).map((errorKey) => (
                        <span
                          key={errorKey}
                          className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        >
                          {errorKey
                            .replace('subProductData.', '')
                            .replace(/([A-Z])/g, ' $1')
                            .trim()}
                        </span>
                      ))}
                      {fieldErrors.length > 8 && (
                        <span className="text-xs text-amber-600">
                          +{fieldErrors.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="solid"
                onClick={
                  currentStep === STEPS.length - 1
                    ? methods.handleSubmit(onSubmit)
                    : handleNext
                }
                disabled={isLoading}
              >
                {currentStep === STEPS.length - 1 ? (
                  <>
                    <PiFloppyDisk className="h-4 w-4" />
                    {isLoading ? 'Saving...' : 'Save Sub Product'}
                  </>
                ) : (
                  <>
                    Next
                    <PiArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          <div className="h-24" />
        </div>
      </motion.div>
    </>
  );
}
