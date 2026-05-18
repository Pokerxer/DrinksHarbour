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
  PiSparkle,
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
import { ValidationSummary } from '@/components/validation-summary';

const STEPS = [
  {
    key: formParts.basicPricingSizes,
    label: 'Product',
    icon: PiTag,
    color: 'blue' as const,
    description: 'Info, pricing & sizes',
  },
  {
    key: formParts.inventory,
    label: 'Inventory',
    icon: PiArchiveBox,
    color: 'purple' as const,
    description: 'Stock levels',
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
  [formParts.inventory]: SubProductInventory,
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

// ── ProductStep ──────────────────────────────────────────────────────────────
// Renders Basic Info + Pricing + Sizes as one step with a sticky section nav

const PRODUCT_SECTIONS = [
  { id: 'product-info',    label: 'Product Info',    icon: PiTag,         description: 'Select or create the base product' },
  { id: 'pricing-sizes',  label: 'Pricing & Sizes',  icon: PiCurrencyNgn, description: 'Prices, markup & size variants' },
];

function ProductStep({ onProductSelect }: { onProductSelect?: (id: string, name?: string) => void }) {
  const [activeSection, setActiveSection] = useState('product-info');

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  }

  // Update active section on scroll
  useEffect(() => {
    function onScroll() {
      for (const s of [...PRODUCT_SECTIONS].reverse()) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 180) {
          setActiveSection(s.id);
          break;
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex gap-6">
      {/* Sticky side nav */}
      <aside className="hidden lg:flex flex-col gap-1 w-48 shrink-0 sticky top-24 self-start">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Sections</p>
        {PRODUCT_SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all ${
                isActive
                  ? 'bg-[#b20202]/8 text-[#b20202]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? 'text-[#b20202]' : 'text-gray-400'}`} />
              <div>
                <p className={`text-xs font-semibold leading-tight ${isActive ? 'text-[#b20202]' : ''}`}>{s.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{s.description}</p>
              </div>
            </button>
          );
        })}

        {/* Progress indicator */}
        <div className="mt-4 px-3 space-y-1">
          {PRODUCT_SECTIONS.map((s, i) => {
            const idx = PRODUCT_SECTIONS.findIndex(x => x.id === activeSection);
            const done = i < idx;
            const current = i === idx;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full transition-colors ${done ? 'bg-green-500' : current ? 'bg-[#b20202]' : 'bg-gray-200'}`} />
                <span className={`text-[10px] transition-colors ${done ? 'text-green-600' : current ? 'text-[#b20202] font-medium' : 'text-gray-400'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Mobile section pills */}
      <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 mb-4 w-full">
        {PRODUCT_SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = activeSection === s.id;
          return (
            <button key={s.id} type="button" onClick={() => scrollTo(s.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive ? 'bg-[#b20202] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Sections */}
      <div className="flex-1 min-w-0 space-y-10">

        {/* ── Product Info ── */}
        <section id="product-info" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#b20202]/10">
              <PiTag className="h-4 w-4 text-[#b20202]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Product Info</h3>
              <p className="text-xs text-gray-500">Select or create the base product, then set SKU and currency</p>
            </div>
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#b20202] text-[10px] font-bold text-white">1</span>
          </div>
          <SubProductBasicInfo onProductSelect={onProductSelect} />
        </section>

        <div className="border-t border-dashed border-gray-200" />

        {/* ── Pricing & Sizes ── */}
        <section id="pricing-sizes" className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-100">
              <PiCurrencyNgn className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Pricing & Sizes</h3>
              <p className="text-xs text-gray-500">Set base cost & markup, then add size variants with individual prices and stock</p>
            </div>
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">2</span>
          </div>
          <SubProductPricing />
          <div className="mt-8">
            <SubProductSizes />
          </div>
        </section>

      </div>
    </div>
  );
}

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  // Ref so callbacks (beforeunload, route-change) always see fresh values
  const isDirtyRef = useRef(false);
  const isLoadingRef = useRef(false);
  const sessionRef = useRef<any>(null);
  // Prevents the unmount auto-save from firing when a save just succeeded
  const hasSavedRef = useRef(false);
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

  // Keep refs in sync so closures (event listeners) always see current values
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { sessionRef.current = session; }, [session]);

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

  const fieldToSection: Record<string, string> = {
    subProductData: 'Basic Info',
    product: 'Basic Info',
    tenant: 'Basic Info',
    createNewProduct: 'Basic Info',
    newProductData: 'Basic Info',
    baseSellingPrice: 'Pricing',
    costPrice: 'Pricing',
    currency: 'Pricing',
    taxRate: 'Pricing',
    marginPercentage: 'Pricing',
    markupPercentage: 'Pricing',
    salePrice: 'Pricing',
    saleDiscountPercentage: 'Pricing',
    sizes: 'Sizes',
    sellWithoutSizeVariants: 'Sizes',
    defaultSize: 'Sizes',
    stockStatus: 'Inventory',
    totalStock: 'Inventory',
    reservedStock: 'Inventory',
    availableStock: 'Inventory',
    lowStockThreshold: 'Inventory',
    reorderPoint: 'Inventory',
    reorderQuantity: 'Inventory',
    vendor: 'Vendor',
    supplierSKU: 'Vendor',
    supplierPrice: 'Vendor',
    leadTimeDays: 'Vendor',
    minimumOrderQuantity: 'Vendor',
    status: 'Status',
    isFeaturedByTenant: 'Status',
    isNewArrival: 'Status',
    isBestSeller: 'Status',
    isPublished: 'Status',
    visibleInPOS: 'Status',
    visibleInOnlineStore: 'Status',
    discount: 'Promotions',
    discountType: 'Promotions',
    flashSale: 'Promotions',
    bundleDeals: 'Promotions',
    shipping: 'Shipping',
    warehouse: 'Shipping',
  };

  const fieldToLabel: Record<string, string> = {
    subProductData: 'Sub-Product',
    product: 'Product',
    tenant: 'Tenant',
    createNewProduct: 'Create New Product',
    newProductData: 'New Product Data',
    name: 'Product Name',
    type: 'Product Type',
    baseSellingPrice: 'Selling Price',
    costPrice: 'Cost Price',
    currency: 'Currency',
    taxRate: 'Tax Rate',
    marginPercentage: 'Margin %',
    markupPercentage: 'Markup %',
    salePrice: 'Sale Price',
    saleDiscountPercentage: 'Sale Discount %',
    sizes: 'Size Variants',
    sellWithoutSizeVariants: 'Sell Without Sizes',
    defaultSize: 'Default Size',
    stockStatus: 'Stock Status',
    totalStock: 'Total Stock',
    reservedStock: 'Reserved Stock',
    availableStock: 'Available Stock',
    lowStockThreshold: 'Low Stock Threshold',
    reorderPoint: 'Reorder Point',
    reorderQuantity: 'Reorder Quantity',
    vendor: 'Vendor',
    supplierSKU: 'Supplier SKU',
    supplierPrice: 'Supplier Price',
    leadTimeDays: 'Lead Time',
    minimumOrderQuantity: 'Min Order Qty',
    status: 'Status',
    isPublished: 'Published',
    discount: 'Discount',
    discountType: 'Discount Type',
    flashSale: 'Flash Sale',
    bundleDeals: 'Bundle Deals',
    shipping: 'Shipping',
    warehouse: 'Warehouse',
  };

  const formatSubProductErrorsForSummary = (
    errs: any,
    currentSection: string
  ): Array<{ field: string; section: string; message: string }> => {
    const result: Array<{ field: string; section: string; message: string }> = [];

    const traverse = (obj: any, path: string[] = []) => {
      for (const key in obj) {
        const value = obj[key];
        const currentPath = [...path, key];

        if (value && typeof value === 'object') {
          if (value.message) {
            const fieldName = currentPath[currentPath.length - 1];
            const label = fieldToLabel[fieldName] || fieldName
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (str) => str.toUpperCase())
              .trim();
            const section = fieldToSection[fieldName] || currentSection;

            result.push({
              field: label,
              section,
              message: value.message,
            });
          } else if (value.type === 'array' && value.types) {
            for (const typeKey in value.types) {
              const typeValue = value.types[typeKey];
              if (typeof typeValue === 'string') {
                const fieldName = `${currentPath[currentPath.length - 1]}.${typeKey}`;
                const label = fieldToLabel[typeKey] || typeKey
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase())
                  .trim();
                const section = fieldToSection[typeKey] || currentSection;

                result.push({
                  field: label,
                  section,
                  message: typeValue,
                });
              }
            }
          } else {
            traverse(value, currentPath);
          }
        }
      }
    };

    traverse(errs);
    return result;
  };

  // Get display title from the linked product name or SKU
  const subProductSku = watch('subProductData.sku');
  const newProductName = watch('subProductData.newProductData.name');
  const [linkedProductName, setLinkedProductName] = useState<string>('');

  const displayTitle = isEditMode
    ? linkedProductName || subProductSku || 'Edit Sub Product'
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
          // Capture linked product name for header display
          const pName = subProductData?.product?.name || subProductData?.product?.title || '';
          if (pName) setLinkedProductName(pName);
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

  const handleGenerate = async () => {
    if (!session?.user?.token) {
      toast.error('Authentication required. Please sign in again.');
      return;
    }

    const formValues = methods.getValues();

    // Prefer a linked parent product ID
    const productId =
      formValues.subProductData?.product ||
      formValues.product ||
      null;

    const subProductId = isEditMode ? (id || null) : null;

    // Build inline context from form fields for cases with no linked product
    const inlineContext = !productId
      ? {
          name:
            formValues.newProductData?.name ||
            formValues.name ||
            formValues.subProductData?.newProductData?.name ||
            '',
          type: formValues.type || formValues.newProductData?.type || '',
          brand: formValues.brand || formValues.newProductData?.brand || '',
          category: formValues.category || formValues.newProductData?.category || '',
          originCountry:
            formValues.originCountry ||
            formValues.newProductData?.originCountry ||
            '',
          abv: formValues.abv || formValues.newProductData?.abv || null,
          volumeMl: formValues.volumeMl || formValues.newProductData?.volumeMl || null,
          shortDescription:
            formValues.shortDescription ||
            formValues.newProductData?.shortDescription ||
            '',
          description:
            formValues.description ||
            formValues.newProductData?.description ||
            '',
          flavorProfile: formValues.flavorProfile || [],
          tags: formValues.tags || [],
        }
      : null;

    if (!productId && !inlineContext?.name) {
      toast.error('Add a product name in the Basic Info step before generating.');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Generating content with AI...');

    try {
      const result = await subproductService.generateSubProductContent(
        productId,
        subProductId,
        session.user.token,
        inlineContext
      );

      const data = result?.data;
      if (!data) throw new Error('No data returned from AI');

      if (data.shortDescriptionOverride) {
        methods.setValue('subProductData.shortDescriptionOverride', data.shortDescriptionOverride);
      }
      if (data.descriptionOverride) {
        methods.setValue('subProductData.descriptionOverride', data.descriptionOverride);
      }
      if (Array.isArray(data.customKeywords) && data.customKeywords.length > 0) {
        methods.setValue('subProductData.customKeywords', data.customKeywords);
      }
      if (data.tenantNotes) {
        methods.setValue('subProductData.tenantNotes', data.tenantNotes);
      }

      toast.success('AI content generated! Check the Overrides step.', { id: toastId });

      // Navigate to the Overrides step so user can review
      const overridesIndex = STEPS.findIndex((s) => s.key === formParts.tenantOverrides);
      if (overridesIndex !== -1) {
        setDirection(1);
        setCurrentStep(overridesIndex);
      }
    } catch (error: any) {
      console.error('Generate error:', error);
      toast.error(error.message || 'Failed to generate content', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

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

  /**
   * Core save logic — shared by manual save, auto-save, and save-on-leave.
   * `silent` = true suppresses toasts (used for auto-save).
   */
  const performSave = useCallback(async (data: SubProductInput, silent = false) => {
    const sp = data.subProductData || (data as any);
    const productId = sp.product || '';
    const createNew = sp.createNewProduct ?? false;
    const costPrice = Number(sp.costPrice ?? 0);

    // Guard: must have a parent product or be creating a new one
    if (!productId && !createNew) {
      if (!silent) toast.error('Please select a parent product or enable "Create New Product"');
      return false;
    }

    // Guard: when creating new product, name + type are required
    if (createNew) {
      const npName = sp.newProductData?.name?.trim() ?? '';
      const npType = sp.newProductData?.type?.trim() ?? '';
      if (!npName || !npType) {
        if (!silent) toast.error('New product requires a name and type');
        return false;
      }
    }

    // Guard: cost price required when linking to existing product
    if (!createNew && costPrice <= 0) {
      if (!silent) toast.error('Cost price must be greater than 0');
      return false;
    }

    // Guard: each size variant must have a size value selected
    const invalidSizes = (sp.sizes || []).filter((s: any) => !s.size || s.size.trim() === '');
    if (invalidSizes.length > 0) {
      if (!silent) toast.error(`${invalidSizes.length} size variant(s) are missing a size selection`);
      return false;
    }

    const token = sessionRef.current?.user?.token;
    if (!token) {
      if (!silent) toast.error('Authentication required. Please sign in again.');
      return false;
    }

    if (!silent) {
      setLoading(true);
      setSaveStatus('saving');
    } else {
      setIsAutoSaving(true);
    }

    try {
      const transformedData = transformFormData(data);

      let createdId: string | null = null;

      if (isEditMode && id) {
        const currentSubProductResponse = await subproductService.getSubProduct(id, token);
        const currentSubProduct =
          currentSubProductResponse?.data?.subProduct ||
          currentSubProductResponse?.subProduct ||
          currentSubProductResponse;

        const currentStock = currentSubProduct?.totalStock || 0;
        const newStock = transformedData.totalStock || 0;
        const stockDelta = newStock - currentStock;

        await subproductService.updateSubProduct(id, transformedData, token);

        if (stockDelta !== 0) {
          try {
            if (stockDelta > 0) {
              await inventoryService.recordReceived(id, stockDelta, token, { reason: 'Form Update (Added)' });
            } else {
              await inventoryService.adjustInventory(id, stockDelta, 'Form Update (Removed)', token);
            }
          } catch (invError) {
            console.error('Failed to record inventory movement on form save:', invError);
          }
        }

        if (!silent) toast.success('Sub Product updated successfully!');
      } else {
        const response = await subproductService.createSubProduct(transformedData, token);
        createdId = response?.data?.subProduct?._id || response?.data?.subProduct?.id || null;

        if (createdId) {
          setCreatedSubProductId(createdId);

          if (transformedData.totalStock && transformedData.totalStock > 0) {
            try {
              await inventoryService.recordReceived(createdId, transformedData.totalStock, token, { reason: 'Initial Stock (Creation)' });
            } catch (invError) {
              console.error('Failed to record initial stock movement:', invError);
            }
          }
        }

        if (!silent) toast.success('Sub Product created successfully!');
      }

      // Mark as saved so unmount/beforeunload auto-save doesn't fire again
      hasSavedRef.current = true;
      localStorage.removeItem('subproduct-draft');
      setSaveStatus('saved');

      // After successful create, redirect to the edit page (Odoo-style)
      if (!isEditMode && createdId) {
        router.replace(`/ecommerce/sub-products/${createdId}/edit`);
        return true;
      }

      setTimeout(() => setSaveStatus('idle'), 2000);

      return true;
    } catch (error: any) {
      setSaveStatus('error');
      console.error('=== SAVE ERROR ===', error);
      if (!silent) {
        const errorMessage = error.message || 'Failed to save sub product';
        if (errorMessage.includes('version') || errorMessage.includes('conflict')) {
          toast.error('This record was modified by another user. Please refresh and try again.');
        } else if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
          toast.error('This product already exists in your catalog. Try editing the existing entry instead.');
        } else if (errorMessage.includes('Product ID is required') || errorMessage.includes('product')) {
          toast.error('Please select a product or create a new one before saving.');
        } else if (errorMessage.includes('cost price') || errorMessage.includes('costPrice')) {
          toast.error('Please enter a valid cost price greater than 0.');
        } else if (errorMessage.includes('Tenant') || errorMessage.includes('tenant')) {
          toast.error('Session error. Please sign out and sign back in.');
        } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
          toast.error('Your session has expired. Please sign in again.');
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          toast.error('Network error. Please check your internet connection and try again.');
        } else {
          toast.error(errorMessage);
        }
      }
      return false;
    } finally {
      if (!silent) setLoading(false);
      else setIsAutoSaving(false);
    }
  }, [isEditMode, id]);

  const onSubmit: SubmitHandler<SubProductInput> = async (data) => {
    console.log('=== FORM DATA SUBMITTED ===', JSON.stringify(data, null, 2));
    await performSave(data, false);
  };

  // ── Auto-save on page leave (EDIT MODE ONLY — Odoo-style) ──────────────────
  // In create mode: save only via explicit Save button. Navigate away = discard.
  // In edit mode: auto-save unsaved changes when leaving the page.
  const formValuesRef = useRef<SubProductInput>(methods.getValues());
  useEffect(() => {
    const sub = methods.watch((values) => {
      formValuesRef.current = values as SubProductInput;
      if (hasSavedRef.current) hasSavedRef.current = false;
    });
    return () => sub.unsubscribe();
  }, [methods]);

  // Unmount auto-save — ONLY for edit mode (updating existing record is safe)
  useEffect(() => {
    return () => {
      if (!isEditMode || !id) return; // create mode: never auto-save on unmount
      if (!isDirtyRef.current || isLoadingRef.current || hasSavedRef.current) return;
      performSave(formValuesRef.current, true).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, id]);

  // Tab close / refresh — warn about unsaved changes; auto-save only in edit mode
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current || isLoadingRef.current || hasSavedRef.current) return;
      if (isEditMode && id) {
        performSave(formValuesRef.current, true).catch(() => {});
      }
      // Always show native browser "unsaved changes" dialog
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [performSave, isEditMode, id]);


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
                <button
                  type="button"
                  onClick={async () => {
                    // Edit mode: auto-save before leaving (Odoo-style)
                    if (isEditMode && id && isDirty && !isLoading) {
                      await performSave(methods.getValues(), true);
                    }
                    router.push(routes.eCommerce.subProducts);
                  }}
                  className="flex flex-shrink-0 items-center gap-1 rounded-lg px-1 py-1 text-gray-600 transition-all hover:bg-gray-100"
                  title="Back to Sub Products"
                >
                  <PiArrowLeft className="h-5 w-5" />
                </button>

                <div className="min-w-0 flex-1 lg:flex-1">
                  <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
                    {displayTitle}
                  </h1>
                  <div className="flex items-center gap-2">
                    {lastSaved && (
                      <Text className="hidden items-center gap-1 text-xs text-gray-400 sm:flex">
                        <PiClock className="h-3 w-3" />
                        {lastSaved.toLocaleTimeString()}
                      </Text>
                    )}
                    {isAutoSaving && (
                      <Text className="flex items-center gap-1 text-xs text-blue-500">
                        <PiSpinner className="h-3 w-3 animate-spin" />
                        Auto-saving…
                      </Text>
                    )}
                  </div>
                </div>

                {/* Save & Settings */}
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || isLoading}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-2 text-purple-700 shadow-sm transition-all hover:border-purple-300 hover:from-purple-100 hover:to-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Auto-generate content with AI"
                  >
                    {isGenerating ? (
                      <PiSpinner className="h-4 w-4 animate-spin" />
                    ) : (
                      <PiSparkle className="h-4 w-4" />
                    )}
                    <span className="hidden text-xs font-medium sm:inline">
                      {isGenerating ? 'Generating...' : 'AI Generate'}
                    </span>
                  </button>

                  {/* Create New Sub-product */}
                  <button
                    type="button"
                    onClick={async () => {
                      // Edit mode: auto-save before leaving
                      if (isEditMode && id && isDirty && !isLoading) {
                        await performSave(methods.getValues(), true);
                      }
                      localStorage.removeItem('subproduct-draft');
                      router.push(routes.eCommerce.createSubProduct);
                    }}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 px-2 text-blue-700 shadow-sm transition-all hover:border-blue-300 hover:from-blue-100 hover:to-cyan-100"
                    title="Create a new sub-product"
                  >
                    <PiPlus className="h-4 w-4" />
                    <span className="hidden text-xs font-medium sm:inline">New Sub-product</span>
                  </button>


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
                {/* Validation Summary */}
                {errors && Object.keys(errors).length > 0 && (
                  <ValidationSummary
                    errors={formatSubProductErrorsForSummary(errors, STEPS[currentStep].label)}
                    className="mb-4"
                  />
                )}

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
                    const key = STEPS[currentStep].key;
                    if (key === formParts.basicPricingSizes) {
                      return <ProductStep onProductSelect={(_, name) => { if (name) setLinkedProductName(name); }} />;
                    }
                    const Component = COMPONENTS[key];
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

              <div className="flex items-center gap-2 text-sm">
                {fieldErrors.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-amber-600">
                      <PiWarning className="h-4 w-4" />
                      <span className="font-medium">
                        {fieldErrors.length} validation error{fieldErrors.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {fieldErrors.slice(0, 6).map((errorKey) => {
                        const displayName = errorKey
                          .replace('subProductData.', '')
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/\./g, ' ')
                          .trim();
                        return (
                          <span
                            key={errorKey}
                            className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                          >
                            {displayName}
                          </span>
                        );
                      })}
                      {fieldErrors.length > 6 && (
                        <span className="text-xs text-red-500">
                          +{fieldErrors.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-600">
                    <PiCheck className="h-4 w-4" />
                    <span>All fields valid</span>
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
