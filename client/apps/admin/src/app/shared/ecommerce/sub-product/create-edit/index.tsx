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
  PiCaretLeft,
  PiCaretRight,
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
  PiArrowCounterClockwise,
  PiList,
  PiX,
  PiSparkle,
} from 'react-icons/pi';
import SubProductBasicInfo from './basic-info';
import SubProductPricing from './pricing';
import SubProductInventory from './inventory';
import SubProductSizes from './sizes';
import SubProductVendor from './vendor';
import ProductHistoryPanel from './ProductHistoryPanel';
import SubProductStatusVisibility from './status-visibility';
import SubProductPromotions from './promotions';
import SubProductShipping from './shipping';
import {
  SubProductInput,
  subProductFormSchema,
} from '@/validators/sub-product.schema';
import { routes } from '@/config/routes';
import { subproductService } from '@/services/subproduct.service';
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
];

const COMPONENTS: Record<string, React.FC> = {
  [formParts.inventory]: SubProductInventory,
  [formParts.vendor]: SubProductVendor,
  [formParts.statusVisibility]: SubProductStatusVisibility,
  [formParts.promotions]: SubProductPromotions,
  [formParts.shipping]: SubProductShipping,
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

// ── ProductStep ──────────────────────────────────────────────────────────────
// Renders Basic Info + Pricing + Sizes as one step with a sticky section nav

const PRODUCT_SECTIONS = [
  {
    id: 'product-info',
    label: 'Product Info',
    icon: PiTag,
    description: 'Select or create the base product',
  },
  {
    id: 'pricing-sizes',
    label: 'Pricing & Sizes',
    icon: PiCurrencyNgn,
    description: 'Prices, markup & size variants',
  },
];

function ProductStep({
  onProductSelect,
}: {
  onProductSelect?: (id: string, name?: string) => void;
}) {
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
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Sticky side nav */}
      <aside className="sticky top-24 hidden w-48 shrink-0 flex-col gap-1 self-start lg:flex">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Sections
        </p>
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
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? 'text-[#b20202]' : 'text-gray-400'}`}
              />
              <div>
                <p
                  className={`text-xs font-semibold leading-tight ${isActive ? 'text-[#b20202]' : ''}`}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-gray-400">
                  {s.description}
                </p>
              </div>
            </button>
          );
        })}

        {/* Progress indicator */}
        <div className="mt-4 space-y-1 px-3">
          {PRODUCT_SECTIONS.map((s, i) => {
            const idx = PRODUCT_SECTIONS.findIndex(
              (x) => x.id === activeSection
            );
            const done = i < idx;
            const current = i === idx;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${done ? 'bg-green-500' : current ? 'bg-[#b20202]' : 'bg-gray-200'}`}
                />
                <span
                  className={`text-[10px] transition-colors ${done ? 'text-green-600' : current ? 'font-medium text-[#b20202]' : 'text-gray-400'}`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Mobile section pills */}
      <div className="mb-4 flex w-full gap-2 overflow-x-auto pb-1 lg:hidden">
        {PRODUCT_SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#b20202] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Sections */}
      <div className="min-w-0 flex-1 space-y-10">
        {/* ── Product Info ── */}
        <section id="product-info" className="scroll-mt-24">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#b20202]/10">
              <PiTag className="h-4 w-4 text-[#b20202]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Product Info</h3>
              <p className="text-xs text-gray-500">
                Select or create the base product, then set SKU and currency
              </p>
            </div>
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#b20202] text-[10px] font-bold text-white">
              1
            </span>
          </div>
          <SubProductBasicInfo onProductSelect={onProductSelect} />
        </section>

        <div className="border-t border-dashed border-gray-200" />

        {/* ── Pricing & Sizes ── */}
        <section id="pricing-sizes" className="scroll-mt-24">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-100">
              <PiCurrencyNgn className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Pricing & Sizes
              </h3>
              <p className="text-xs text-gray-500">
                Set base cost & markup, then add size variants with individual
                prices and stock
              </p>
            </div>
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
              2
            </span>
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
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  // Archive / Duplicate / Delete state
  const [actionLoading, setActionLoading] = useState<
    'archive' | 'restore' | 'duplicate' | 'delete' | null
  >(null);
  const [confirmModal, setConfirmModal] = useState<
    'archive' | 'restore' | 'delete' | null
  >(null);

  // Product navigation (prev / next)
  const [navIds, setNavIds] = useState<string[]>([]);
  const [navIndex, setNavIndex] = useState<number>(-1);

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

  // Read-only stats (not in form schema — fetched from API response)
  const [statSold, setStatSold] = useState<number | null>(null);
  const [statPurchased, setStatPurchased] = useState<number | null>(null);
  // Which history panel is open
  const [historyPanel, setHistoryPanel] = useState<
    'purchased' | 'sold' | 'returns' | null
  >(null);

  // Keep refs in sync so closures (event listeners) always see current values
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ── Product navigation list ───────────────────────────────────────────────
  const NAV_CACHE_KEY = 'dh-sp-nav-v1';
  const NAV_TTL_MS = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    if (!isEditMode || !id || !session?.user?.token) return;

    async function loadNavIds() {
      try {
        // Try sessionStorage first
        const raw = sessionStorage.getItem(NAV_CACHE_KEY);
        if (raw) {
          const { ids, ts } = JSON.parse(raw);
          if (Date.now() - ts < NAV_TTL_MS && Array.isArray(ids)) {
            setNavIds(ids);
            setNavIndex(ids.indexOf(id));
            return;
          }
        }
        // Fetch fresh list — only need _id, so use a high limit
        const res = await subproductService.getSubProducts(session.user.token, {
          limit: 500,
          sort: 'createdAt',
          order: 'desc',
        });
        const items: any[] = res?.data?.subProducts || res?.subProducts || [];
        const ids: string[] = items
          .map((p: any) => String(p._id || p.id))
          .filter(Boolean);
        sessionStorage.setItem(
          NAV_CACHE_KEY,
          JSON.stringify({ ids, ts: Date.now() })
        );
        setNavIds(ids);
        setNavIndex(ids.indexOf(String(id)));
      } catch {
        // non-critical — silently ignore
      }
    }

    loadNavIds();
  }, [isEditMode, id, session?.user?.token]);

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
    const result: Array<{ field: string; section: string; message: string }> =
      [];

    const traverse = (obj: any, path: string[] = []) => {
      for (const key in obj) {
        const value = obj[key];
        const currentPath = [...path, key];

        if (value && typeof value === 'object') {
          if (value.message) {
            const fieldName = currentPath[currentPath.length - 1];
            const label =
              fieldToLabel[fieldName] ||
              fieldName
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
                const label =
                  fieldToLabel[typeKey] ||
                  typeKey
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
          const pName =
            subProductData?.product?.name ||
            subProductData?.product?.title ||
            '';
          if (pName) setLinkedProductName(pName);
          if (subProductData?.totalSold != null)
            setStatSold(subProductData.totalSold);
          if (subProductData?.purchaseCount != null)
            setStatPurchased(subProductData.purchaseCount);
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
      formValues.subProductData?.product || formValues.product || null;

    const subProductId = isEditMode ? id || null : null;

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
          category:
            formValues.category || formValues.newProductData?.category || '',
          originCountry:
            formValues.originCountry ||
            formValues.newProductData?.originCountry ||
            '',
          abv: formValues.abv || formValues.newProductData?.abv || null,
          volumeMl:
            formValues.volumeMl || formValues.newProductData?.volumeMl || null,
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
      toast.error(
        'Add a product name in the Basic Info step before generating.'
      );
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
        methods.setValue(
          'subProductData.shortDescriptionOverride',
          data.shortDescriptionOverride
        );
      }
      if (data.descriptionOverride) {
        methods.setValue(
          'subProductData.descriptionOverride',
          data.descriptionOverride
        );
      }
      if (
        Array.isArray(data.customKeywords) &&
        data.customKeywords.length > 0
      ) {
        methods.setValue('subProductData.customKeywords', data.customKeywords);
      }
      if (data.tenantNotes) {
        methods.setValue('subProductData.tenantNotes', data.tenantNotes);
      }

      toast.success('AI content generated!', { id: toastId });
    } catch (error: any) {
      console.error('Generate error:', error);
      toast.error(error.message || 'Failed to generate content', {
        id: toastId,
      });
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
  const performSave = useCallback(
    async (data: SubProductInput, silent = false) => {
      const sp = data.subProductData || (data as any);
      const productId = sp.product || '';
      const createNew = sp.createNewProduct ?? false;
      const costPrice = Number(sp.costPrice ?? 0);

      // Guard: must have a parent product or be creating a new one
      if (!productId && !createNew) {
        if (!silent)
          toast.error(
            'Please select a parent product or enable "Create New Product"'
          );
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
      const invalidSizes = (sp.sizes || []).filter(
        (s: any) => !s.size || s.size.trim() === ''
      );
      if (invalidSizes.length > 0) {
        if (!silent)
          toast.error(
            `${invalidSizes.length} size variant(s) are missing a size selection`
          );
        return false;
      }

      // Guard: no duplicate size values in the sizes array
      const seenSizes = new Set<string>();
      for (const s of sp.sizes || []) {
        if (!s.size) continue;
        const key = String(s.size).toLowerCase().trim();
        if (seenSizes.has(key)) {
          if (!silent)
            toast.error(
              `Duplicate size value "${s.size}". Each size value can only appear once per product.`
            );
          return false;
        }
        seenSizes.add(key);
      }

      const token = sessionRef.current?.user?.token;
      if (!token) {
        if (!silent)
          toast.error('Authentication required. Please sign in again.');
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
          await subproductService.updateSubProduct(id, transformedData, token);
          if (!silent) toast.success('Sub Product updated successfully!');
        } else {
          const response = await subproductService.createSubProduct(
            transformedData,
            token
          );
          createdId =
            response?.data?.subProduct?._id ||
            response?.data?.subProduct?.id ||
            null;

          if (createdId) {
            setCreatedSubProductId(createdId);
          }

          if (!silent) toast.success('Sub Product created successfully!');
        }

        // Mark as saved so unmount/beforeunload auto-save doesn't fire again
        hasSavedRef.current = true;
        localStorage.removeItem('subproduct-draft');
        setSaveStatus('saved');

        // After successful create, redirect to the edit page (Odoo-style)
        if (!isEditMode && createdId) {
          router.replace(`/sub-products/${createdId}/edit`);
          return true;
        }

        setTimeout(() => setSaveStatus('idle'), 2000);

        return true;
      } catch (error: any) {
        setSaveStatus('error');
        console.error('=== SAVE ERROR ===', error);
        if (!silent) {
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
        }
        return false;
      } finally {
        if (!silent) setLoading(false);
        else setIsAutoSaving(false);
      }
    },
    [isEditMode, id]
  );

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
      if (!isDirtyRef.current || isLoadingRef.current || hasSavedRef.current)
        return;
      performSave(formValuesRef.current, true).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, id]);

  // Tab close / refresh — warn about unsaved changes; auto-save only in edit mode
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current || isLoadingRef.current || hasSavedRef.current)
        return;
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
                router.push(`/sub-products/${createdSubProductId}/edit`)
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
                router.push(`/sub-products/create`);
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

  // ── Archive / Restore / Duplicate / Delete handlers ───────────────────────
  const currentStatus = watch('subProductData.status');
  const isArchived = currentStatus === 'archived';
  const token = session?.user?.token;
  const subProductId = id;

  function invalidateNavCache() {
    try {
      sessionStorage.removeItem(NAV_CACHE_KEY);
    } catch {}
  }

  async function handleArchive() {
    if (!subProductId || !token) return;
    setActionLoading('archive');
    try {
      await subproductService.archiveSubProduct(subProductId, token);
      invalidateNavCache();
      toast.success('Product archived');
      router.push(routes.eCommerce.subProducts);
    } catch (e: any) {
      toast.error(e.message || 'Failed to archive');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  }

  async function handleRestore() {
    if (!subProductId || !token) return;
    setActionLoading('restore');
    try {
      await subproductService.restoreSubProduct(subProductId, token);
      toast.success('Product restored');
      router.refresh();
      setConfirmModal(null);
      methods.setValue('subProductData.status', 'active');
    } catch (e: any) {
      toast.error(e.message || 'Failed to restore');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  }

  async function handleDuplicate() {
    if (!subProductId || !token) return;
    setActionLoading('duplicate');
    setShowSettingsDropdown(false);
    invalidateNavCache();
    try {
      const res = await subproductService.duplicateSubProduct(
        subProductId,
        token
      );
      const newId = res?.data?.subProduct?._id;
      toast.success(
        `Duplicated — ${res?.data?.duplicatedSizes ?? 0} size variants copied`
      );
      if (newId) {
        router.push(routes.eCommerce.editSubProduct(newId));
      } else {
        router.push(routes.eCommerce.subProducts);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to duplicate');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!subProductId || !token) return;
    setActionLoading('delete');
    try {
      await subproductService.deleteSubProduct(subProductId, token);
      invalidateNavCache();
      toast.success('Product deleted');
      router.push(routes.eCommerce.subProducts);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
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
      <div className="min-h-screen w-full">
        {/* ── Header ── */}
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white">
          {/* Progress bar — CSS transition only */}
          <div className="h-0.5 w-full bg-gray-100">
            <div
              className="h-full bg-gray-900 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Main header row */}
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
            {/* ── Back ── */}
            <button
              type="button"
              onClick={async () => {
                if (isEditMode && id && isDirty && !isLoading) {
                  await performSave(methods.getValues(), true);
                }
                router.push(routes.eCommerce.subProducts);
              }}
              className="flex shrink-0 items-center gap-1 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
              title="Back to Sub Products"
            >
              <PiArrowLeft className="h-4 w-4" />
            </button>

            {/* ── Title + autosave status ── */}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold text-gray-900">
                {displayTitle}
              </h1>
              <div className="mt-0.5 flex items-center gap-2">
                {isAutoSaving && (
                  <span className="flex items-center gap-1 text-[10px] text-blue-500">
                    <PiSpinner className="h-3 w-3 animate-spin" /> Auto-saving…
                  </span>
                )}
                {saveStatus === 'saved' && !isAutoSaving && (
                  <span className="flex items-center gap-1 text-[10px] text-green-600">
                    <PiCheck className="h-3 w-3" /> Saved
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-[10px] text-red-500">
                    <PiWarningCircle className="h-3 w-3" /> Save failed
                  </span>
                )}
                {lastSaved && saveStatus === 'idle' && (
                  <span className="hidden items-center gap-1 text-[10px] text-gray-400 sm:flex">
                    <PiClock className="h-2.5 w-2.5" />
                    {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {/* ── New + Save — adjacent to product name ── */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  if (isEditMode && id && isDirty && !isLoading) {
                    await performSave(methods.getValues(), true);
                  }
                  localStorage.removeItem('subproduct-draft');
                  router.push(routes.eCommerce.createSubProduct);
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                title="Create new sub-product"
              >
                <PiPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New</span>
              </button>
              <button
                type="button"
                onClick={methods.handleSubmit(onSubmit)}
                disabled={isLoading}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
                title="Save"
              >
                {isLoading ? (
                  <PiSpinner className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PiFloppyDisk className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isLoading ? 'Saving…' : 'Save'}
                </span>
              </button>
            </div>

            {/* ── Archived banner chip ── */}
            {isArchived && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 ring-1 ring-amber-200">
                <PiArchive className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[11px] font-bold text-amber-700">
                  Archived
                </span>
              </div>
            )}

            {/* ── Stat chips (real data) ── */}
            <div className="hidden items-center gap-2 sm:flex">
              {/* Stock */}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1">
                <PiPackage className="h-3 w-3 text-gray-400" />
                <span className="text-[11px] font-semibold tabular-nums text-gray-700">
                  {Number(watch('subProductData.totalStock')) || 0}
                </span>
                <span className="text-[9px] uppercase tracking-wide text-gray-400">
                  on hand
                </span>
              </div>
              {/* Price */}
              {Number(watch('subProductData.baseSellingPrice')) > 0 && (
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1">
                  <PiCurrencyNgn className="h-3 w-3 text-gray-400" />
                  <span className="text-[11px] font-semibold tabular-nums text-gray-700">
                    {Number(
                      watch('subProductData.baseSellingPrice')
                    ).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              {/* Returns — clickable */}
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => setHistoryPanel('returns')}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 transition-colors hover:border-orange-300 hover:bg-orange-50"
                >
                  <PiArrowCounterClockwise className="h-3 w-3 text-gray-400" />
                  <span className="text-[9px] uppercase tracking-wide text-gray-400">
                    returns
                  </span>
                </button>
              )}
              {/* Purchased — clickable */}
              {isEditMode && statPurchased !== null && (
                <button
                  type="button"
                  onClick={() => setHistoryPanel('purchased')}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <PiShoppingCart className="h-3 w-3 text-gray-400" />
                  <span className="text-[11px] font-semibold tabular-nums text-gray-700">
                    {statPurchased}
                  </span>
                  <span className="text-[9px] uppercase tracking-wide text-gray-400">
                    purchased
                  </span>
                </button>
              )}
              {/* Sold — clickable */}
              {isEditMode && statSold !== null && (
                <button
                  type="button"
                  onClick={() => setHistoryPanel('sold')}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <PiTrendDown className="h-3 w-3 text-gray-400" />
                  <span className="text-[11px] font-semibold tabular-nums text-gray-700">
                    {statSold}
                  </span>
                  <span className="text-[9px] uppercase tracking-wide text-gray-400">
                    sold
                  </span>
                </button>
              )}
              {/* Status */}
              {(() => {
                const st = watch('subProductData.status') || 'draft';
                const cls =
                  st === 'active'
                    ? 'bg-green-100 text-green-700'
                    : st === 'draft'
                      ? 'bg-gray-100 text-gray-600'
                      : st === 'out_of_stock'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700';
                return (
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold capitalize ${cls}`}
                  >
                    {st.replace(/_/g, ' ')}
                  </span>
                );
              })()}
            </div>

            {/* ── Right actions ── */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* AI Generate */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || isLoading}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
                title="Auto-generate content with AI"
              >
                {isGenerating ? (
                  <PiSpinner className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PiSparkle className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isGenerating ? 'Generating…' : 'AI'}
                </span>
              </button>

              {/* ── Prev / Next navigation ── */}
              {isEditMode && navIds.length > 1 && navIndex !== -1 && (
                <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                  <button
                    type="button"
                    disabled={navIndex <= 0}
                    title={
                      navIndex > 0
                        ? `Previous product (${navIndex} of ${navIds.length})`
                        : 'No previous product'
                    }
                    onClick={async () => {
                      if (navIndex <= 0) return;
                      if (isDirty && !isLoading)
                        await performSave(methods.getValues(), true);
                      router.push(
                        routes.eCommerce.editSubProduct(navIds[navIndex - 1])
                      );
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <PiCaretLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[3rem] text-center text-[10px] font-semibold tabular-nums text-gray-500">
                    {navIndex + 1} / {navIds.length}
                  </span>
                  <button
                    type="button"
                    disabled={navIndex >= navIds.length - 1}
                    title={
                      navIndex < navIds.length - 1
                        ? `Next product (${navIndex + 2} of ${navIds.length})`
                        : 'No next product'
                    }
                    onClick={async () => {
                      if (navIndex >= navIds.length - 1) return;
                      if (isDirty && !isLoading)
                        await performSave(methods.getValues(), true);
                      router.push(
                        routes.eCommerce.editSubProduct(navIds[navIndex + 1])
                      );
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <PiCaretRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Settings ⋮ */}
              <div className="relative" ref={settingsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50"
                  title="More options"
                >
                  <PiDotsThree className="h-4 w-4" />
                </button>
                {showSettingsDropdown && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                    {isEditMode && (
                      <>
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSettingsDropdown(false);
                              setConfirmModal('restore');
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <PiArchive className="h-4 w-4 text-gray-400" />{' '}
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSettingsDropdown(false);
                              setConfirmModal('archive');
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <PiArchive className="h-4 w-4 text-gray-400" />{' '}
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={actionLoading === 'duplicate'}
                          onClick={handleDuplicate}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {actionLoading === 'duplicate' ? (
                            <PiSpinner className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            <PiCopy className="h-4 w-4 text-gray-400" />
                          )}
                          {actionLoading === 'duplicate'
                            ? 'Duplicating…'
                            : 'Duplicate'}
                        </button>
                        <div className="my-1 border-t border-gray-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSettingsDropdown(false);
                            setConfirmModal('delete');
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          <PiTrash className="h-4 w-4" /> Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Step tab bar ── */}
          <div className="scrollbar-hide flex overflow-x-auto border-t border-gray-100 px-2">
            {STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isDone = index < currentStep || completedSteps.has(index);
              const Icon = step.icon;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => handleStepClick(index)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-gray-900 text-gray-900'
                      : isDone
                        ? 'border-transparent text-green-600 hover:text-gray-700'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-gray-900 text-white'
                        : isDone
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isDone ? <PiCheck className="h-3 w-3" /> : index + 1}
                  </span>
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <FormProvider {...methods}>
            {isFetching ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <PiSpinner className="h-7 w-7 animate-spin text-gray-500" />
                </div>
                <p className="text-sm text-gray-400">Loading sub product…</p>
              </div>
            ) : (
              <div
                key={STEPS[currentStep].key}
                className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6"
              >
                {/* Validation Summary */}
                {errors && Object.keys(errors).length > 0 && (
                  <ValidationSummary
                    errors={formatSubProductErrorsForSummary(
                      errors,
                      STEPS[currentStep].label
                    )}
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
                <div>
                  {(() => {
                    const key = STEPS[currentStep].key;
                    if (key === formParts.basicPricingSizes) {
                      return (
                        <ProductStep
                          onProductSelect={(_, name) => {
                            if (name) setLinkedProductName(name);
                          }}
                        />
                      );
                    }
                    const Component = COMPONENTS[key];
                    return Component ? <Component /> : null;
                  })()}
                </div>
              </div>
            )}
          </FormProvider>

          {/* Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white px-4 py-3 shadow-lg sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
              >
                <PiArrowLeft className="h-4 w-4" />
                Previous
              </button>

              <div className="flex items-center gap-2 text-sm">
                {fieldErrors.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-amber-600">
                      <PiWarning className="h-4 w-4" />
                      <span className="font-medium">
                        {fieldErrors.length} validation error
                        {fieldErrors.length !== 1 ? 's' : ''}
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

              <button
                type="button"
                onClick={
                  currentStep === STEPS.length - 1
                    ? methods.handleSubmit(onSubmit)
                    : handleNext
                }
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
              >
                {currentStep === STEPS.length - 1 ? (
                  <>
                    {isLoading ? (
                      <PiSpinner className="h-4 w-4 animate-spin" />
                    ) : (
                      <PiFloppyDisk className="h-4 w-4" />
                    )}
                    {isLoading ? 'Saving…' : 'Save'}
                  </>
                ) : (
                  <>
                    Next
                    <PiArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="h-20" />
        </div>
      </div>

      {/* History panels */}
      {historyPanel && isEditMode && id && session?.user?.token && (
        <ProductHistoryPanel
          type={historyPanel}
          subProductId={id}
          productName={displayTitle}
          token={session.user.token}
          onClose={() => setHistoryPanel(null)}
        />
      )}

      {/* ── Confirm modals ─────────────────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmModal(null)}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Top accent */}
            <div
              className={`h-1 w-full ${confirmModal === 'delete' ? 'bg-red-600' : confirmModal === 'archive' ? 'bg-amber-500' : 'bg-green-500'}`}
            />
            <div className="px-6 py-5">
              {/* Icon + title */}
              <div className="mb-4 flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    confirmModal === 'delete'
                      ? 'bg-red-50'
                      : confirmModal === 'archive'
                        ? 'bg-amber-50'
                        : 'bg-green-50'
                  }`}
                >
                  {confirmModal === 'delete' && (
                    <PiTrash className="h-5 w-5 text-red-600" />
                  )}
                  {confirmModal === 'archive' && (
                    <PiArchive className="h-5 w-5 text-amber-600" />
                  )}
                  {confirmModal === 'restore' && (
                    <PiArchive className="h-5 w-5 text-green-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {confirmModal === 'delete' && 'Delete product?'}
                    {confirmModal === 'archive' && 'Archive product?'}
                    {confirmModal === 'restore' && 'Restore product?'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {confirmModal === 'delete' &&
                      'This permanently removes the product and all its data. This cannot be undone.'}
                    {confirmModal === 'archive' &&
                      `"${displayTitle}" will be hidden from the store and POS. You can restore it later.`}
                    {confirmModal === 'restore' &&
                      `"${displayTitle}" will be restored and set back to active.`}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  disabled={!!actionLoading}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!!actionLoading}
                  onClick={() => {
                    if (confirmModal === 'delete') handleDelete();
                    if (confirmModal === 'archive') handleArchive();
                    if (confirmModal === 'restore') handleRestore();
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
                    confirmModal === 'delete'
                      ? 'bg-red-600 hover:bg-red-700'
                      : confirmModal === 'archive'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {actionLoading ? (
                    <PiSpinner className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {confirmModal === 'delete' && (
                        <PiTrash className="h-4 w-4" />
                      )}
                      {confirmModal === 'archive' && (
                        <PiArchive className="h-4 w-4" />
                      )}
                      {confirmModal === 'restore' && (
                        <PiArchive className="h-4 w-4" />
                      )}
                    </>
                  )}
                  {actionLoading
                    ? 'Please wait…'
                    : confirmModal === 'delete'
                      ? 'Yes, delete'
                      : confirmModal === 'archive'
                        ? 'Archive'
                        : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
