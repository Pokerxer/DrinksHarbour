// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { routes } from '@/config/routes';
import { bannerService } from '@/services/banner.service';
import { uploadService } from '@/services/upload.service';
import { productService } from '@/services/product.service';
import { categoryService } from '@/services/category.service';
import {
  BANNER_TYPE_OPTIONS,
  BANNER_PLACEMENT_OPTIONS,
  BANNER_STATUS_OPTIONS,
  BANNER_PRIORITY_OPTIONS,
  BANNER_CTA_STYLE_OPTIONS,
  BANNER_CONTENT_POSITION_OPTIONS,
  BANNER_LINK_TYPE_OPTIONS,
  BANNER_VISIBLE_TO_OPTIONS,
  BannerFormData,
  Banner,
} from '@/types/banner.types';
import { Button, Input, Textarea, Select, Switch } from 'rizzui';
import {
  PiImageBold,
  PiInfoBold,
  PiLinkBold,
  PiPaletteBold,
  PiCalendarBold,
  PiDeviceMobileBold,
  PiGlobeBold,
  PiUploadSimpleBold,
  PiXBold,
  PiSpinnerBold,
  PiCheckBold,
  PiEyeBold,
  PiTagBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiMagnifyingGlass,
  PiPackage,
  PiFolder,
  PiX,
  PiSparkleBold,
  PiMagicWandBold,
  PiStackBold,
  PiInfo,
  PiStorefrontBold,
  PiArrowsClockwise,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from 'rizzui';

interface CreateEditBannerProps {
  bannerId?: string;
  initialData?: Banner;
}

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ icon, iconBg, title, subtitle, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors"
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
          {icon}
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className={cn('transition-transform', isOpen ? 'rotate-180' : '')}>
          <PiCaretDownBold className="w-4 h-4 text-gray-400" />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ImageUploadField({
  label,
  required,
  value,
  onChange,
  token,
  folder,
  aspectRatio = 'video',
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (url: string) => void;
  token: string;
  folder: string;
  aspectRatio?: 'video' | 'square' | 'wide';
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClasses = {
    video: 'aspect-[3/1]',
    square: 'aspect-square',
    wide: 'aspect-[16/9]',
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadService.uploadImage(file, token, folder);
      if (res.success && res.data?.url) {
        onChange(res.data.url);
        toast.success('Image uploaded');
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
          <div className={cn('w-full', aspectClasses[aspectRatio])}>
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              <PiXBold className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full rounded-xl border-2 border-dashed transition-all disabled:opacity-60',
            'hover:border-blue-400 hover:bg-blue-50/30',
            aspectClasses[aspectRatio]
          )}
        >
          <div className="flex flex-col items-center justify-center h-full gap-2">
            {uploading ? (
              <>
                <PiSpinnerBold className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-500">Uploading...</span>
              </>
            ) : (
              <>
                <PiUploadSimpleBold className="w-8 h-8 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Click to upload</span>
                <span className="text-xs text-gray-400">PNG, JPG, WEBP up to 10MB</span>
              </>
            )}
          </div>
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      
      <Input
        placeholder="Or paste image URL..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-2"
        size="sm"
      />
    </div>
  );
}

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === ',' && input) {
      e.preventDefault();
      addTag(input);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
          >
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900">
              <PiXBold className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>
      <Input
        placeholder="Type a tag and press Enter or comma..."
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        size="sm"
      />
    </div>
  );
}

// CTA style → button classes (shared between form preview + details page)
const PREVIEW_CTA_CLS: Record<string, string> = {
  primary:   'bg-orange-500 text-white',
  secondary: 'bg-white text-gray-900 border border-gray-300',
  outline:   'bg-transparent text-white border-2 border-white',
  text:      'text-white underline underline-offset-4',
  custom:    'bg-gray-900 text-white',
};

const PREVIEW_POS_CLS: Record<string, string> = {
  'top-left':       'items-start justify-start text-left',
  'top-center':     'items-start justify-center text-center',
  'top-right':      'items-start justify-end text-right',
  'center-left':    'items-center justify-start text-left',
  'center':         'items-center justify-center text-center',
  'center-right':   'items-center justify-end text-right',
  'bottom-left':    'items-end justify-start text-left',
  'bottom-center':  'items-end justify-center text-center',
  'bottom-right':   'items-end justify-end text-right',
};

function BannerPreview({ formData }: { formData: BannerFormData }) {
  if (!formData.image?.url) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 aspect-[3/1] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <PiImageBold className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">Banner preview will appear here</p>
        </div>
      </div>
    );
  }

  const posCls = PREVIEW_POS_CLS[formData.contentPosition] || PREVIEW_POS_CLS.center;
  const ctaCls = PREVIEW_CTA_CLS[formData.ctaStyle] || PREVIEW_CTA_CLS.primary;

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-gray-200 aspect-[3/1]"
      style={{ backgroundColor: formData.backgroundColor }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={formData.image.url} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${(formData.overlayOpacity || 0) / 100})` }}
      />
      <div className={cn('absolute inset-0 flex flex-col gap-1.5 p-6', posCls)}>
        {formData.subtitle && (
          <p
            className="text-sm font-medium drop-shadow"
            style={{ color: formData.textColor, textAlign: formData.textAlignment as any }}
          >
            {formData.subtitle}
          </p>
        )}
        {formData.title && (
          <p
            className="text-xl font-black drop-shadow-lg"
            style={{ color: formData.textColor, textAlign: formData.textAlignment as any }}
          >
            {formData.title}
          </p>
        )}
        {formData.description && (
          <p
            className="text-xs drop-shadow line-clamp-2 max-w-xs"
            style={{ color: formData.textColor ? `${formData.textColor}b0` : undefined, textAlign: formData.textAlignment as any }}
          >
            {formData.description}
          </p>
        )}
        {formData.ctaText && (
          <span className={cn('mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold shadow-lg', ctaCls)}>
            {formData.ctaText}
          </span>
        )}
      </div>
    </div>
  );
}

interface LinkSelectorProps {
  linkType: string;
  targetProduct?: { _id: string; name: string };
  targetCategory?: { _id: string; name: string };
  onProductSelect: (product: { _id: string; name: string } | null) => void;
  onCategorySelect: (category: { _id: string; name: string } | null) => void;
  token: string;
}

function LinkSelector({ linkType, targetProduct, targetCategory, onProductSelect, onCategorySelect, token }: LinkSelectorProps) {
  const [productSearch, setProductSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [isSearchingCategories, setIsSearchingCategories] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  const productInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProducts([]);
      return;
    }
    
    setIsSearchingProducts(true);
    try {
      const response = await productService.getProducts(token, { search: query, limit: 10 });
      const productList = response?.data?.products || response?.products || [];
      setProducts(productList);
    } catch (err) {
      console.error('Error searching products:', err);
      setProducts([]);
    } finally {
      setIsSearchingProducts(false);
    }
  }, [token]);

  const searchCategories = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCategories([]);
      return;
    }
    
    setIsSearchingCategories(true);
    try {
      const response = await categoryService.getCategories(token);
      const filtered = response.filter((c: any) => 
        c.name?.toLowerCase().includes(query.toLowerCase())
      );
      setCategories(filtered.slice(0, 10));
    } catch (err) {
      console.error('Error searching categories:', err);
      setCategories([]);
    } finally {
      setIsSearchingCategories(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch) searchProducts(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, searchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (categorySearch) searchCategories(categorySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [categorySearch, searchCategories]);

  const handleProductSelect = (product: any) => {
    const slug = product.slug || product._id;
    onProductSelect({ _id: slug, name: product.name });
    setProductSearch(product.name);
    setProducts([]);
    setShowProductDropdown(false);
  };

  const handleCategorySelect = (category: any) => {
    const slug = category.slug || category._id;
    onCategorySelect({ _id: slug, name: category.name });
    setCategorySearch(category.name);
    setCategories([]);
    setShowCategoryDropdown(false);
  };

  const clearProduct = () => {
    onProductSelect(null);
    setProductSearch('');
    setProducts([]);
  };

  const clearCategory = () => {
    onCategorySelect(null);
    setCategorySearch('');
    setCategories([]);
  };

  if (linkType !== 'product' && linkType !== 'category') {
    return (
      <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
        Select "Product" or "Category" link type to link this banner to specific content.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {linkType === 'product' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Link to Product</label>
          {targetProduct ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <PiPackage className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{targetProduct.name}</p>
                  <p className="text-xs text-green-600">Product linked</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearProduct}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <PiX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={productInputRef}
                  type="text"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Search products by name..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                {isSearchingProducts && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <PiSpinnerBold className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
              
              {showProductDropdown && products.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {products.map(product => (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => handleProductSelect(product)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      {product.images?.[0]?.url ? (
                        <img src={product.images[0].url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <PiPackage className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.type || 'Product'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {showProductDropdown && productSearch.length >= 2 && products.length === 0 && !isSearchingProducts && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                  No products found
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {linkType === 'category' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Link to Category</label>
          {targetCategory ? (
            <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <PiFolder className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{targetCategory.name}</p>
                  <p className="text-xs text-purple-600">Category linked</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearCategory}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <PiX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={categoryInputRef}
                  type="text"
                  value={categorySearch}
                  onChange={e => {
                    setCategorySearch(e.target.value);
                    setShowCategoryDropdown(true);
                  }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  placeholder="Search categories..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                {isSearchingCategories && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <PiSpinnerBold className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
              
              {showCategoryDropdown && categories.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {categories.map(category => (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => handleCategorySelect(category)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <PiFolder className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{category.name}</p>
                        <p className="text-xs text-gray-500">{category.type || 'Category'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {showCategoryDropdown && categorySearch.length >= 2 && categories.length === 0 && !isSearchingCategories && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                  No categories found
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreateEditBanner({ bannerId, initialData }: CreateEditBannerProps) {
  const router = useRouter();
  const { data: session }: any = useSession();
  const token = session?.token || session?.user?.token || '';

  const isEdit = !!bannerId;
  const [loading, setLoading] = useState(isEdit && !initialData);
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [formData, setFormData] = useState<BannerFormData>({
    title: '',
    subtitle: '',
    description: '',
    image: { url: '' },
    mobileImage: { url: '' },
    type: 'promotional',
    placement: 'home_hero',
    displayOrder: 0,
    priority: 'medium',
    ctaText: '',
    ctaLink: '',
    ctaStyle: 'primary',
    linkType: 'internal',
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    overlayOpacity: 0,
    textAlignment: 'center',
    contentPosition: 'center',
    startDate: '',
    endDate: '',
    isScheduled: false,
    isActive: true,
    status: 'active',
    visibleTo: 'all',
    isGlobal: true,
    tags: [],
    notes: '',
  });

  const [deviceTargeting, setDeviceTargeting] = useState({
    desktop: true,
    mobile: true,
    tablet: true,
  });

  const [targetProduct, setTargetProduct] = useState<{ _id: string; name: string } | null>(null);
  const [targetCategory, setTargetCategory] = useState<{ _id: string; name: string } | null>(null);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contextProducts, setContextProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [contextCategories, setContextCategories] = useState<any[]>([]);
  const [contextSubcategories, setContextSubcategories] = useState<any[]>([]);
  const [contextBrands, setContextBrands] = useState<any[]>([]);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  // Search filters for the AI-modal product/subcategory pickers (long lists).
  const [aiProductSearch, setAiProductSearch] = useState('');
  const [aiSubcategorySearch, setAiSubcategorySearch] = useState('');
  const [aiContextData, setAiContextData] = useState({
    productId: '',
    categoryId: '',
    subcategoryId: '',
    brandId: '',
    style: 'playful' as 'playful' | 'elegant' | 'urgent' | 'calm',
    customContext: '',
  });
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(3);
  const [enhancingField, setEnhancingField] = useState<string | null>(null);

  useEffect(() => {
    if (showAIGenerate && token) {
      fetchContextData();
    }
  }, [showAIGenerate, token]);

  useEffect(() => {
    if (bannerId && !initialData) {
      fetchBanner();
    } else if (initialData) {
      populateForm(initialData);
    }
  }, [bannerId, initialData]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchBanner = async () => {
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
  };

  const populateForm = (data: Banner) => {
    setFormData({
      title: data.title || '',
      subtitle: data.subtitle || '',
      description: data.description || '',
      image: data.image || { url: '' },
      mobileImage: data.mobileImage || { url: '' },
      type: data.type || 'promotional',
      placement: data.placement || 'home_hero',
      displayOrder: data.displayOrder || 0,
      priority: data.priority || 'medium',
      ctaText: data.ctaText || '',
      ctaLink: data.ctaLink || '',
      ctaStyle: data.ctaStyle || 'primary',
      linkType: data.linkType || 'internal',
      backgroundColor: data.backgroundColor || '#FFFFFF',
      textColor: data.textColor || '#000000',
      overlayOpacity: data.overlayOpacity || 0,
      textAlignment: data.textAlignment || 'center',
      contentPosition: data.contentPosition || 'center',
      startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '',
      isScheduled: data.isScheduled || false,
      isActive: data.isActive ?? true,
      status: data.status || 'draft',
      visibleTo: data.visibleTo || 'all',
      isGlobal: data.isGlobal ?? false,
      tags: data.tags || [],
      notes: data.notes || '',
    });
    setDeviceTargeting(data.deviceTargeting || { desktop: true, mobile: true, tablet: true });
    
    if (data.targetProduct) {
      const productData = data.targetProduct;
      const productSlug = typeof productData === 'object' ? productData.slug || productData._id : productData;
      const productName = typeof productData === 'object' ? productData.name || '' : '';
      setTargetProduct({ _id: productSlug, name: productName });
      setTargetCategory(null);
    }
    if (data.targetCategory) {
      const categoryData = data.targetCategory;
      const categorySlug = typeof categoryData === 'object' ? categoryData.slug || categoryData._id : categoryData;
      const categoryName = typeof categoryData === 'object' ? categoryData.name || '' : '';
      setTargetCategory({ _id: categorySlug, name: categoryName });
      setTargetProduct(null);
    }
  };

  const set = useCallback((field: keyof BannerFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  }, []);

  const fetchContextData = async () => {
    if (!token) return;
    if (contextProducts.length > 0) return; // Already loaded
    
    setIsLoadingContext(true);
    try {
      const response = await bannerService.getBannerContextData(token);
      if (response.success) {
        const products = response.data.products || [];
        const categories = response.data.categories || [];
        const subcategories = response.data.subcategories || [];
        const brands = response.data.brands || [];
        setContextProducts(products);
        setFilteredProducts(products);
        setContextCategories(categories);
        setContextSubcategories(subcategories);
        setContextBrands(brands);

        // Auto-select first item if in loading state
        setAiContextData(prev => {
          if (prev.productId === 'loading' && products.length > 0) {
            return { ...prev, productId: products[0].id };
          }
          if (prev.categoryId === 'loading' && categories.length > 0) {
            return { ...prev, categoryId: categories[0].id };
          }
          if (prev.subcategoryId === 'loading' && subcategories.length > 0) {
            return { ...prev, subcategoryId: subcategories[0].id };
          }
          if (prev.brandId === 'loading' && brands.length > 0) {
            return { ...prev, brandId: brands[0].id };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to fetch context data:', err);
      toast.error('Failed to load products and categories');
      // Clear loading state on error
      setAiContextData(prev => ({
        ...prev,
        productId: prev.productId === 'loading' ? '' : prev.productId,
        categoryId: prev.categoryId === 'loading' ? '' : prev.categoryId,
        subcategoryId: prev.subcategoryId === 'loading' ? '' : prev.subcategoryId,
        brandId: prev.brandId === 'loading' ? '' : prev.brandId,
      }));
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleSelectContext = (type: 'product' | 'category' | 'subcategory' | 'brand') => {
    // Clear existing selections
    setAiContextData(prev => ({
      ...prev,
      productId: '',
      categoryId: '',
      subcategoryId: '',
      brandId: '',
      [`${type}Id`]: '', // Will be set after dropdown selection
    }));
  };

  const handleRegenerate = async () => {
    if (showSuggestions) {
      await handleGenerateSuggestions();
    } else {
      await handleAIGenerate();
    }
  };

  const handleAIGenerate = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);
    
    try {
      const params: any = {
        bannerType: formData.type,
        placement: formData.placement,
        style: aiContextData.style,
      };

      if (aiContextData.productId) params.productId = aiContextData.productId;
      if (aiContextData.categoryId) params.categoryId = aiContextData.categoryId;
      if (aiContextData.subcategoryId) params.subcategoryId = aiContextData.subcategoryId;
      if (aiContextData.brandId) params.brandId = aiContextData.brandId;
      if (aiContextData.customContext) params.customContext = aiContextData.customContext;

      const response = await bannerService.generateBannerContent(params, token);

      if (response.success && response.data) {
        setGeneratedContent(response.data);
      } else {
        toast.error(response.message || 'Failed to generate content');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate banner content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);
    
    try {
      const params: any = {
        count: suggestionCount,
      };

      if (aiContextData.productId) params.productId = aiContextData.productId;
      if (aiContextData.categoryId) params.categoryId = aiContextData.categoryId;
      if (aiContextData.subcategoryId) params.subcategoryId = aiContextData.subcategoryId;
      if (aiContextData.brandId) params.brandId = aiContextData.brandId;
      if (aiContextData.customContext) params.customContext = aiContextData.customContext;

      const response = await bannerService.generateBannerSuggestions(params, token);

      if (response.success && response.data) {
        setGeneratedContent(response.data);
        toast.success(`${response.data.length} options generated!`);
      } else {
        toast.error(response.message || 'Failed to generate suggestions');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate suggestions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyGeneratedContent = (content: any) => {
    if (content.title) set('title', content.title);
    if (content.subtitle) set('subtitle', content.subtitle);
    if (content.ctaText) set('ctaText', content.ctaText);
    if (content.backgroundColor) set('backgroundColor', content.backgroundColor);
    if (content.textColor) set('textColor', content.textColor);
    if (content.contentPosition) set('contentPosition', content.contentPosition);
    if (content.textAlignment) set('textAlignment', content.textAlignment);
    if (content.tags && Array.isArray(content.tags)) set('tags', content.tags);

    // AI-picked banner OPTIONS (only present when the model chose a valid enum value).
    if (content.type) set('type', content.type);
    if (content.placement) set('placement', content.placement);
    if (content.ctaStyle) set('ctaStyle', content.ctaStyle);

    // Derive the CTA link client-side from the selected target (never trust an
    // AI-generated URL). Subcategory link uses the slug-based shop filter.
    if (aiContextData.productId) {
      const product = contextProducts.find(p => p.id === aiContextData.productId);
      if (product) {
        setTargetProduct({ _id: product.id, name: product.name });
        set('linkType', 'product');
        set('ctaLink', `/shop?search=${encodeURIComponent(product.name)}`);
      }
    }
    if (aiContextData.subcategoryId) {
      const subcategory = contextSubcategories.find(s => s.id === aiContextData.subcategoryId);
      if (subcategory) {
        set('linkType', 'category');
        set('ctaLink', `/shop?subcategory=${encodeURIComponent(subcategory.slug || subcategory.id)}`);
      }
    }
    if (aiContextData.categoryId) {
      const category = contextCategories.find(c => c.id === aiContextData.categoryId);
      if (category) {
        setTargetCategory({ _id: category.id, name: category.name });
        set('linkType', 'category');
        set('ctaLink', `/shop?category=${category.id}`);
      }
    }
    if (aiContextData.brandId) {
      const brand = contextBrands.find(b => b.id === aiContextData.brandId);
      if (brand) {
        set('linkType', 'brand');
        set('ctaLink', `/shop?search=${encodeURIComponent(brand.name)}`);
      }
    }

    toast.success('Content applied to banner!');
    setShowAIGenerate(false);
    setGeneratedContent(null);
    setShowSuggestions(false);
  };

  // Per-field AI sparkle: rewrite one copy field in place (title/subtitle/ctaText).
  const handleEnhanceField = async (
    field: 'title' | 'subtitle' | 'ctaText',
    action: 'rewrite' | 'expand' | 'shorten' | 'punchier' = 'rewrite'
  ) => {
    const value = (formData[field] || '').trim();
    if (!value) {
      toast.error('Add some text first, then let AI polish it');
      return;
    }
    if (!token) {
      toast.error('Authentication required');
      return;
    }
    setEnhancingField(field);
    try {
      const response = await bannerService.enhanceBannerField(
        {
          field,
          value,
          action,
          context: { type: formData.type, placement: formData.placement, title: formData.title },
        },
        token
      );
      if (response?.value) {
        set(field, response.value);
        toast.success('Polished by AI ✨');
      } else {
        toast.error('AI returned nothing usable — try again');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to enhance field');
    } finally {
      setEnhancingField(null);
    }
  };

  // Small inline sparkle button rendered as an Input suffix.
  const FieldSparkle = ({ field }: { field: 'title' | 'subtitle' | 'ctaText' }) => {
    const busy = enhancingField === field;
    const disabled = busy || !(formData[field] || '').trim();
    return (
      <button
        type="button"
        onClick={() => handleEnhanceField(field)}
        disabled={disabled}
        title="Rewrite this field with AI"
        aria-label={`Rewrite ${field} with AI`}
        className={cn(
          'flex items-center justify-center rounded-md p-1 transition-colors',
          disabled ? 'text-gray-300 cursor-not-allowed' : 'text-purple-500 hover:text-purple-700 hover:bg-purple-50'
        )}
      >
        {busy ? (
          <PiSpinnerBold className="w-4 h-4 animate-spin" />
        ) : (
          <PiSparkleBold className="w-4 h-4" />
        )}
      </button>
    );
  };

  const getContextLabel = () => {
    if (aiContextData.productId) {
      return contextProducts.find(p => p.id === aiContextData.productId)?.name || 'Product';
    }
    if (aiContextData.categoryId) {
      return contextCategories.find(c => c.id === aiContextData.categoryId)?.name || 'Category';
    }
    if (aiContextData.brandId) {
      return contextBrands.find(b => b.id === aiContextData.brandId)?.name || 'Brand';
    }
    if (aiContextData.customContext) {
      return 'Custom';
    }
    return 'No context';
  };

  const handleClearContext = () => {
    setAiContextData(prev => ({
      ...prev,
      productId: '',
      categoryId: '',
      subcategoryId: '',
      brandId: '',
      customContext: '',
    }));
    setAiProductSearch('');
    setAiSubcategorySearch('');
    setGeneratedContent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) { toast.error('Title is required'); return; }
    if (!formData.image?.url?.trim()) { toast.error('Banner image is required'); return; }
    if (!token) { toast.error('Authentication required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        deviceTargeting,
        targetProduct: targetProduct?._id || undefined,
        targetCategory: targetCategory?._id || undefined,
      };
      const response = isEdit && bannerId
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" />
          <div className="flex gap-2">
            <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header with preview toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Banner' : 'Create New Banner'}</h2>
          {hasUnsavedChanges ? (
            <span className="text-sm text-amber-600 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Unsaved changes
            </span>
          ) : isEdit ? (
            <span className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              All changes saved
            </span>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Fill in the details below to create a banner</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAIGenerate(true)}
            type="button"
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
          >
            <PiSparkleBold className="w-4 h-4 mr-2" />
            AI Generate
          </Button>
          <Button variant="outline" onClick={() => router.push(routes.eCommerce.banners)} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            {isEdit ? 'Update Banner' : 'Create Banner'}
          </Button>
        </div>
      </div>

      {/* AI Generate Modal */}
      <Modal
        isOpen={showAIGenerate}
        onClose={() => {
          setShowAIGenerate(false);
          setGeneratedContent(null);
          setShowSuggestions(false);
        }}
        className="max-w-4xl"
        overlayClassName="backdrop-blur-sm"
      >
        <div className="p-0">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 p-6 rounded-t-xl">
            <button
              onClick={() => {
                setShowAIGenerate(false);
                setGeneratedContent(null);
                setShowSuggestions(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <PiX className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <PiMagicWandBold className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">AI Banner Generator</h3>
                  <p className="text-white/80 text-sm">Create compelling banner content instantly</p>
                </div>
              </div>
              {/* Context Badge */}
              {(aiContextData.productId || aiContextData.categoryId || aiContextData.subcategoryId || aiContextData.brandId) && (
                <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5">
                  <span className="text-white/90 text-xs">
                    {aiContextData.productId && 'Product'}
                    {aiContextData.categoryId && 'Category'}
                    {aiContextData.subcategoryId && 'Subcategory'}
                    {aiContextData.brandId && 'Brand'}
                  </span>
                  <button
                    onClick={handleClearContext}
                    className="text-white/70 hover:text-white"
                  >
                    <PiX className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => { setShowSuggestions(false); setGeneratedContent(null); }}
              className={cn(
                'flex-1 px-6 py-3 text-sm font-medium transition-colors relative',
                !showSuggestions ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <PiSparkleBold className="w-4 h-4" />
                Generate Single
              </span>
              {!showSuggestions && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => { setShowSuggestions(true); setGeneratedContent(null); }}
              className={cn(
                'flex-1 px-6 py-3 text-sm font-medium transition-colors relative',
                showSuggestions ? 'text-purple-600' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <PiStackBold className="w-4 h-4" />
                Multiple Options
              </span>
              {showSuggestions && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {!showSuggestions ? (
              /* Single Generation Mode */
              <div className="space-y-6">
                {/* Context Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">What is this banner for?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Products */}
                    <button
                      type="button"
                      onClick={() => {
                        if (aiContextData.productId) {
                          setAiContextData(prev => ({ ...prev, productId: '' }));
                        } else {
                          fetchContextData();
                          setAiContextData(prev => ({ ...prev, productId: 'loading' }));
                        }
                      }}
                      className={cn(
                        'relative p-4 rounded-xl border-2 transition-all text-left',
                        aiContextData.productId ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          aiContextData.productId ? 'bg-purple-100' : 'bg-gray-100'
                        )}>
                          <PiPackage className={cn('w-5 h-5', aiContextData.productId ? 'text-purple-600' : 'text-gray-400')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">Product</p>
                          <p className="text-xs text-gray-500 truncate">
                            {aiContextData.productId && aiContextData.productId !== 'loading'
                              ? contextProducts.find(p => p.id === aiContextData.productId)?.name || 'Selected'
                              : aiContextData.productId === 'loading'
                                ? 'Loading...'
                                : 'Click to select'}
                          </p>
                        </div>
                        {aiContextData.productId && aiContextData.productId !== 'loading' && (
                          <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center">
                            <PiCheckBold className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Categories */}
                    <button
                      type="button"
                      onClick={() => {
                        if (aiContextData.categoryId) {
                          setAiContextData(prev => ({ ...prev, categoryId: '' }));
                        } else {
                          fetchContextData();
                          setAiContextData(prev => ({ ...prev, categoryId: 'loading' }));
                        }
                      }}
                      className={cn(
                        'relative p-4 rounded-xl border-2 transition-all text-left',
                        aiContextData.categoryId ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          aiContextData.categoryId ? 'bg-purple-100' : 'bg-gray-100'
                        )}>
                          <PiFolder className={cn('w-5 h-5', aiContextData.categoryId ? 'text-purple-600' : 'text-gray-400')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">Category</p>
                          <p className="text-xs text-gray-500 truncate">
                            {aiContextData.categoryId && aiContextData.categoryId !== 'loading'
                              ? contextCategories.find(c => c.id === aiContextData.categoryId)?.name || 'Selected'
                              : aiContextData.categoryId === 'loading'
                                ? 'Loading...'
                                : 'Click to select'}
                          </p>
                        </div>
                        {aiContextData.categoryId && aiContextData.categoryId !== 'loading' && (
                          <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center">
                            <PiCheckBold className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Subcategories */}
                    <button
                      type="button"
                      onClick={() => {
                        if (aiContextData.subcategoryId) {
                          setAiContextData(prev => ({ ...prev, subcategoryId: '' }));
                        } else {
                          fetchContextData();
                          setAiContextData(prev => ({ ...prev, subcategoryId: 'loading' }));
                        }
                      }}
                      className={cn(
                        'relative p-4 rounded-xl border-2 transition-all text-left',
                        aiContextData.subcategoryId ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          aiContextData.subcategoryId ? 'bg-purple-100' : 'bg-gray-100'
                        )}>
                          <PiFolder className={cn('w-5 h-5', aiContextData.subcategoryId ? 'text-purple-600' : 'text-gray-400')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">Subcategory</p>
                          <p className="text-xs text-gray-500 truncate">
                            {aiContextData.subcategoryId && aiContextData.subcategoryId !== 'loading'
                              ? contextSubcategories.find(s => s.id === aiContextData.subcategoryId)?.name || 'Selected'
                              : aiContextData.subcategoryId === 'loading'
                                ? 'Loading...'
                                : 'Click to select'}
                          </p>
                        </div>
                        {aiContextData.subcategoryId && aiContextData.subcategoryId !== 'loading' && (
                          <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center">
                            <PiCheckBold className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Brands */}
                    <button
                      type="button"
                      onClick={() => {
                        if (aiContextData.brandId) {
                          setAiContextData(prev => ({ ...prev, brandId: '' }));
                        } else {
                          fetchContextData();
                          setAiContextData(prev => ({ ...prev, brandId: 'loading' }));
                        }
                      }}
                      className={cn(
                        'relative p-4 rounded-xl border-2 transition-all text-left',
                        aiContextData.brandId ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          aiContextData.brandId ? 'bg-purple-100' : 'bg-gray-100'
                        )}>
                          <PiStorefrontBold className={cn('w-5 h-5', aiContextData.brandId ? 'text-purple-600' : 'text-gray-400')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">Brand</p>
                          <p className="text-xs text-gray-500 truncate">
                            {aiContextData.brandId && aiContextData.brandId !== 'loading'
                              ? contextBrands.find(b => b.id === aiContextData.brandId)?.name || 'Selected'
                              : aiContextData.brandId === 'loading'
                                ? 'Loading...'
                                : 'Click to select'}
                          </p>
                        </div>
                        {aiContextData.brandId && aiContextData.brandId !== 'loading' && (
                          <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center">
                            <PiCheckBold className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                  
                  {/* No context option */}
                  <button
                    type="button"
                    onClick={handleClearContext}
                    className="col-span-2 sm:col-span-4 p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-300 transition-all text-center"
                  >
                    <p className="text-xs text-gray-500">
                      Or generate without specific context
                    </p>
                  </button>
                </div>

                {/* Product Picker */}
                {(aiContextData.productId || aiContextData.productId === 'loading') && aiContextData.productId !== '' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {aiContextData.productId === 'loading' ? 'Loading products...' : 'Select Product'}
                    </label>
                    {isLoadingContext || aiContextData.productId === 'loading' ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 bg-gray-50 rounded-lg">
                        <PiSpinnerBold className="w-4 h-4 animate-spin" /> Loading products...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Search input */}
                        <div className="relative">
                          <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={aiProductSearch}
                            onChange={e => setAiProductSearch(e.target.value)}
                            placeholder="Search products by name or brand..."
                            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
                          />
                          {aiProductSearch && (
                            <button
                              type="button"
                              onClick={() => setAiProductSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                            >
                              <PiX className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Product list */}
                        {(() => {
                          const q = aiProductSearch.trim().toLowerCase();
                          const list = q
                            ? contextProducts.filter(p =>
                                `${p.name} ${p.brand || ''}`.toLowerCase().includes(q))
                            : contextProducts;
                          return (
                            <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
                              {list.length === 0 ? (
                                <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                                  No products match &ldquo;{aiProductSearch}&rdquo;
                                </div>
                              ) : (
                                list.map(p => {
                                  const selected = aiContextData.productId === p.id;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => setAiContextData(prev => ({ ...prev, productId: p.id }))}
                                      className={cn(
                                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                                        selected
                                          ? 'bg-purple-50 ring-1 ring-purple-300'
                                          : 'hover:bg-gray-50',
                                      )}
                                    >
                                      {/* Thumbnail */}
                                      <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                        {p.image ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center">
                                            <PiPackage className="h-4 w-4 text-gray-300" />
                                          </div>
                                        )}
                                      </div>
                                      {/* Name + brand */}
                                      <div className="min-w-0 flex-1">
                                        <p className={cn('truncate text-sm font-medium', selected ? 'text-purple-700' : 'text-gray-900')}>
                                          {p.name}
                                        </p>
                                        {p.brand && (
                                          <p className="truncate text-xs text-gray-400">{p.brand}</p>
                                        )}
                                      </div>
                                      {/* Check */}
                                      {selected && (
                                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
                                          <PiCheckBold className="w-3 h-3" />
                                        </span>
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          );
                        })()}
                        <p className="text-[11px] text-gray-400">
                          {(() => {
                            const q = aiProductSearch.trim().toLowerCase();
                            const count = q
                              ? contextProducts.filter(p => `${p.name} ${p.brand || ''}`.toLowerCase().includes(q)).length
                              : contextProducts.length;
                            return `${count} product${count === 1 ? '' : 's'}`;
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Category Dropdown */}
                {(aiContextData.categoryId || aiContextData.categoryId === 'loading') && aiContextData.categoryId !== '' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {aiContextData.categoryId === 'loading' ? 'Loading categories...' : 'Select Category'}
                    </label>
                    {isLoadingContext || aiContextData.categoryId === 'loading' ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 bg-gray-50 rounded-lg">
                        <PiSpinnerBold className="w-4 h-4 animate-spin" /> Loading...
                      </div>
                    ) : (
                      <select
                        value={aiContextData.categoryId}
                        onChange={e => setAiContextData(prev => ({ ...prev, categoryId: e.target.value }))}
                        className="w-full rounded-lg border border-purple-200 px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none bg-white"
                      >
                        <option value="">Choose a category...</option>
                        {contextCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Subcategory Dropdown */}
                {(aiContextData.subcategoryId || aiContextData.subcategoryId === 'loading') && aiContextData.subcategoryId !== '' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {aiContextData.subcategoryId === 'loading' ? 'Loading subcategories...' : 'Select Subcategory'}
                    </label>
                    {isLoadingContext || aiContextData.subcategoryId === 'loading' ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 bg-gray-50 rounded-lg">
                        <PiSpinnerBold className="w-4 h-4 animate-spin" /> Loading...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Search input */}
                        <div className="relative">
                          <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={aiSubcategorySearch}
                            onChange={e => setAiSubcategorySearch(e.target.value)}
                            placeholder="Search subcategories..."
                            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
                          />
                          {aiSubcategorySearch && (
                            <button
                              type="button"
                              onClick={() => setAiSubcategorySearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                            >
                              <PiX className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Subcategory list */}
                        {(() => {
                          const q = aiSubcategorySearch.trim().toLowerCase();
                          const list = q
                            ? contextSubcategories.filter(s =>
                                `${s.name} ${s.parentName || ''}`.toLowerCase().includes(q))
                            : contextSubcategories;
                          return (
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
                              {list.length === 0 ? (
                                <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                                  No subcategories match &ldquo;{aiSubcategorySearch}&rdquo;
                                </div>
                              ) : (
                                list.map(s => {
                                  const selected = aiContextData.subcategoryId === s.id;
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => setAiContextData(prev => ({ ...prev, subcategoryId: s.id }))}
                                      className={cn(
                                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                                        selected
                                          ? 'bg-purple-50 ring-1 ring-purple-300'
                                          : 'hover:bg-gray-50',
                                      )}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className={cn('truncate text-sm font-medium', selected ? 'text-purple-700' : 'text-gray-900')}>
                                          {s.name}
                                        </p>
                                        {s.parentName && (
                                          <p className="truncate text-xs text-gray-400">{s.parentName}</p>
                                        )}
                                      </div>
                                      {selected && (
                                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
                                          <PiCheckBold className="w-3 h-3" />
                                        </span>
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          );
                        })()}
                        <p className="text-[11px] text-gray-400">
                          {(() => {
                            const q = aiSubcategorySearch.trim().toLowerCase();
                            const count = q
                              ? contextSubcategories.filter(s => `${s.name} ${s.parentName || ''}`.toLowerCase().includes(q)).length
                              : contextSubcategories.length;
                            return `${count} subcategor${count === 1 ? 'y' : 'ies'}`;
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Brand Dropdown */}
                {(aiContextData.brandId || aiContextData.brandId === 'loading') && aiContextData.brandId !== '' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {aiContextData.brandId === 'loading' ? 'Loading brands...' : 'Select Brand'}
                    </label>
                    {isLoadingContext || aiContextData.brandId === 'loading' ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 bg-gray-50 rounded-lg">
                        <PiSpinnerBold className="w-4 h-4 animate-spin" /> Loading...
                      </div>
                    ) : (
                      <select
                        value={aiContextData.brandId}
                        onChange={e => setAiContextData(prev => ({ ...prev, brandId: e.target.value }))}
                        className="w-full rounded-lg border border-purple-200 px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none bg-white"
                      >
                        <option value="">Choose a brand...</option>
                        {contextBrands.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Style Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Choose Style</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      { key: 'playful', icon: '🎉', color: 'from-pink-500 to-orange-400', bg: 'bg-pink-50' },
                      { key: 'elegant', icon: '✨', color: 'from-purple-500 to-indigo-500', bg: 'bg-purple-50' },
                      { key: 'urgent', icon: '🔥', color: 'from-red-500 to-pink-500', bg: 'bg-red-50' },
                      { key: 'calm', icon: '🌿', color: 'from-green-500 to-teal-400', bg: 'bg-green-50' },
                    ] as const).map(({ key, icon, color, bg }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAiContextData(prev => ({ ...prev, style: key }))}
                        className={cn(
                          'p-3 rounded-xl text-center transition-all',
                          aiContextData.style === key
                            ? `bg-gradient-to-br ${color} text-white shadow-lg scale-105`
                            : `${bg} text-gray-600 hover:scale-105`
                        )}
                      >
                        <span className="text-xl block mb-1">{icon}</span>
                        <span className="text-xs font-medium capitalize">{key}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Context */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Context (optional)</label>
                  <textarea
                    value={aiContextData.customContext}
                    onChange={e => setAiContextData(prev => ({ ...prev, customContext: e.target.value }))}
                    placeholder="E.g., 'Include mentions of Valentine's Day' or 'Focus on gift-giving angle'"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none resize-none"
                  />
                </div>

                {/* Generated Content Preview */}
                {generatedContent && (
                  <GeneratedContentPreview
                    content={generatedContent}
                    onApply={handleApplyGeneratedContent}
                    onClose={() => setGeneratedContent(null)}
                  />
                )}
              </div>
            ) : (
              /* Multiple Options Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">Generate multiple style variations</p>
                  <select
                    value={suggestionCount}
                    onChange={e => setSuggestionCount(Number(e.target.value))}
                    className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 focus:border-purple-500 outline-none"
                  >
                    <option value={2}>2 options</option>
                    <option value={3}>3 options</option>
                    <option value={4}>4 options</option>
                  </select>
                </div>

                {generatedContent ? (
                  <GeneratedContentPreview
                    content={generatedContent}
                    onApply={handleApplyGeneratedContent}
                    onClose={() => setGeneratedContent(null)}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                    <PiSparkleBold className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium mb-1">No options generated yet</p>
                    <p className="text-xs text-gray-400">Click the button below to generate multiple banner variations</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-xl">
            {/* Generated info bar */}
            {generatedContent && (
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-600">
                    {Array.isArray(generatedContent) 
                      ? `${generatedContent.length} options ready` 
                      : 'Content generated'}
                  </span>
                </div>
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                >
                  <PiArrowsClockwise className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <PiInfoBold className="w-4 h-4" />
                Powered by AI
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAIGenerate(false);
                    setGeneratedContent(null);
                    setShowSuggestions(false);
                  }}
                  type="button"
                >
                  Close
                </Button>
                {!showSuggestions ? (
                  generatedContent ? (
                    <Button
                      onClick={() => handleApplyGeneratedContent(generatedContent)}
                      type="button"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <PiCheckBold className="w-4 h-4 mr-2" />
                      Apply Content
                    </Button>
                  ) : (
                    <Button
                      onClick={handleAIGenerate}
                      isLoading={isGenerating}
                      type="button"
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      <PiSparkleBold className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                  )
                ) : generatedContent ? (
                  <span className="text-xs text-gray-500 px-3">
                    Click an option to apply
                  </span>
                ) : (
                  <Button
                    onClick={handleGenerateSuggestions}
                    isLoading={isGenerating}
                    type="button"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <PiSparkleBold className="w-4 h-4 mr-2" />
                    Generate {suggestionCount} Options
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Form fields */}
        <div className="lg:col-span-2 space-y-4">
          {/* Basic Information */}
          <CollapsibleSection
            icon={<PiInfoBold className="w-5 h-5 text-blue-600" />}
            iconBg="bg-blue-100"
            title="Basic Information"
            subtitle="Title, subtitle, type and placement"
          >
            <div className="space-y-4">
              <Input
                label="Title"
                placeholder="Enter banner title"
                value={formData.title}
                onChange={e => set('title', e.target.value)}
                required
                className="w-full"
                suffix={<FieldSparkle field="title" />}
              />
              <Input
                label="Subtitle"
                placeholder="Enter subtitle (optional)"
                value={formData.subtitle || ''}
                onChange={e => set('subtitle', e.target.value)}
                className="w-full"
                suffix={<FieldSparkle field="subtitle" />}
              />
              <Textarea
                label="Description"
                placeholder="Enter description (optional)"
                value={formData.description || ''}
                onChange={e => set('description', e.target.value)}
                rows={2}
                className="w-full"
              />
              <div className="grid grid-cols-2 gap-4">
                <Select label="Type" options={BANNER_TYPE_OPTIONS} value={formData.type} onChange={v => set('type', v)} />
                <Select label="Placement" options={BANNER_PLACEMENT_OPTIONS} value={formData.placement} onChange={v => set('placement', v)} />
              </div>

              {/* Priority — visual segmented control with color dots */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                <div className="grid grid-cols-4 gap-2">
                  {BANNER_PRIORITY_OPTIONS.map(opt => {
                    const active = formData.priority === opt.value;
                    const colors: Record<string, string> = {
                      low: 'bg-gray-400',
                      medium: 'bg-amber-500',
                      high: 'bg-orange-500',
                      urgent: 'bg-red-500',
                    };
                    const activeCls: Record<string, string> = {
                      low: 'border-gray-300 bg-gray-50 text-gray-700',
                      medium: 'border-amber-300 bg-amber-50 text-amber-700',
                      high: 'border-orange-300 bg-orange-50 text-orange-700',
                      urgent: 'border-red-300 bg-red-50 text-red-700',
                    };
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('priority', opt.value)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border-2 py-2 text-xs font-semibold transition ${
                          active ? activeCls[opt.value] : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${colors[opt.value]}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Display Order"
                type="number"
                min={0}
                value={formData.displayOrder}
                onChange={e => set('displayOrder', parseInt(e.target.value) || 0)}
                hint="Lower numbers appear first"
              />
            </div>
          </CollapsibleSection>

          {/* Images */}
          <CollapsibleSection
            icon={<PiImageBold className="w-5 h-5 text-purple-600" />}
            iconBg="bg-purple-100"
            title="Banner Images"
            subtitle="Desktop and mobile images"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImageUploadField
                label="Desktop Image"
                required
                value={formData.image?.url || ''}
                onChange={url => set('image', { ...formData.image, url })}
                token={token}
                folder="banners"
                aspectRatio="video"
              />
              <ImageUploadField
                label="Mobile Image"
                value={formData.mobileImage?.url || ''}
                onChange={url => set('mobileImage', { ...formData.mobileImage, url })}
                token={token}
                folder="banners"
                aspectRatio="wide"
              />
            </div>
          </CollapsibleSection>

          {/* Call to Action */}
          <CollapsibleSection
            icon={<PiLinkBold className="w-5 h-5 text-green-600" />}
            iconBg="bg-green-100"
            title="Call to Action"
            subtitle="Button text and link"
            defaultOpen={false}
          >
            <div className="space-y-4">
              <Select 
                label="Link Type" 
                options={BANNER_LINK_TYPE_OPTIONS} 
                value={formData.linkType} 
                onChange={v => {
                  set('linkType', v);
                  setTargetProduct(null);
                  setTargetCategory(null);
                  set('ctaLink', '');
                }} 
              />
              <LinkSelector
                key={formData.linkType}
                linkType={formData.linkType}
                targetProduct={targetProduct}
                targetCategory={targetCategory}
                onProductSelect={(product) => {
                  setTargetProduct(product);
                  setTargetCategory(null);
                  if (product) {
                    set('ctaLink', `/shop?search=${encodeURIComponent(product.name)}`);
                  }
                }}
                onCategorySelect={(category) => {
                  setTargetCategory(category);
                  setTargetProduct(null);
                  if (category) {
                    set('ctaLink', `/shop?category=${category._id}`);
                  }
                }}
                token={token}
              />
              <Input
                label="CTA Button Text"
                placeholder="Shop Now"
                value={formData.ctaText || ''}
                onChange={e => set('ctaText', e.target.value)}
                suffix={<FieldSparkle field="ctaText" />}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CTA Style</label>
                <div className="flex flex-wrap gap-2">
                  {BANNER_CTA_STYLE_OPTIONS.map(opt => {
                    const active = formData.ctaStyle === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('ctaStyle', opt.value)}
                        className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-orange-300 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Input
                label="CTA Link / URL"
                placeholder="https://example.com/shop"
                value={formData.ctaLink || ''}
                onChange={e => set('ctaLink', e.target.value)}
              />
            </div>
          </CollapsibleSection>

          {/* Styling */}
          <CollapsibleSection
            icon={<PiPaletteBold className="w-5 h-5 text-pink-600" />}
            iconBg="bg-pink-100"
            title="Styling"
            subtitle="Colors and text alignment"
            defaultOpen={false}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.backgroundColor}
                      onChange={e => set('backgroundColor', e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                    />
                    <Input value={formData.backgroundColor} onChange={e => set('backgroundColor', e.target.value)} size="sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.textColor}
                      onChange={e => set('textColor', e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                    />
                    <Input value={formData.textColor} onChange={e => set('textColor', e.target.value)} size="sm" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Text Alignment"
                  options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
                  value={formData.textAlignment}
                  onChange={v => set('textAlignment', v)}
                />
                <Select
                  label="Content Position"
                  options={BANNER_CONTENT_POSITION_OPTIONS}
                  value={formData.contentPosition}
                  onChange={v => set('contentPosition', v)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Overlay Opacity: <span className="font-semibold">{formData.overlayOpacity}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={formData.overlayOpacity}
                  onChange={e => set('overlayOpacity', Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Scheduling */}
          <CollapsibleSection
            icon={<PiCalendarBold className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-100"
            title="Scheduling"
            subtitle="Set display schedule (optional)"
            defaultOpen={false}
          >
            <div className="space-y-4">
              <Switch checked={formData.isScheduled} onChange={checked => set('isScheduled', checked)} label="Enable Scheduling" />
              {formData.isScheduled && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Start Date" type="date" value={formData.startDate || ''} onChange={e => set('startDate', e.target.value)} />
                  <Input label="End Date" type="date" value={formData.endDate || ''} onChange={e => set('endDate', e.target.value)} />
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Status & Visibility */}
          <CollapsibleSection
            icon={<PiGlobeBold className="w-5 h-5 text-cyan-600" />}
            iconBg="bg-cyan-100"
            title="Status & Visibility"
            subtitle="Control where and when the banner is shown"
            defaultOpen={false}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Status" options={BANNER_STATUS_OPTIONS} value={formData.status} onChange={v => set('status', v)} />
                <Select label="Visible To" options={BANNER_VISIBLE_TO_OPTIONS} value={formData.visibleTo} onChange={v => set('visibleTo', v)} />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Active</p>
                  <p className="text-sm text-gray-500">Banner will be displayed</p>
                </div>
                <Switch checked={formData.isActive} onChange={checked => set('isActive', checked)} />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Global Banner</p>
                  <p className="text-sm text-gray-500">Available across all tenants</p>
                </div>
                <Switch checked={formData.isGlobal} onChange={checked => set('isGlobal', checked)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Device Targeting */}
          <CollapsibleSection
            icon={<PiDeviceMobileBold className="w-5 h-5 text-indigo-600" />}
            iconBg="bg-indigo-100"
            title="Device Targeting"
            subtitle="Choose which devices show this banner"
            defaultOpen={false}
          >
            <div className="grid grid-cols-3 gap-4">
              {(['desktop', 'mobile', 'tablet'] as const).map(device => (
                <div key={device} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-900 capitalize">{device}</span>
                  <Switch checked={deviceTargeting[device]} onChange={checked => setDeviceTargeting(prev => ({ ...prev, [device]: checked }))} />
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Tags */}
          <CollapsibleSection
            icon={<PiTagBold className="w-5 h-5 text-orange-600" />}
            iconBg="bg-orange-100"
            title="Tags"
            subtitle="Organize with tags"
            defaultOpen={false}
          >
            <TagsInput tags={formData.tags || []} onChange={tags => set('tags', tags)} />
          </CollapsibleSection>

          {/* Notes */}
          <CollapsibleSection
            icon={<PiInfoBold className="w-5 h-5 text-gray-600" />}
            iconBg="bg-gray-100"
            title="Internal Notes"
            subtitle="Notes for your team"
            defaultOpen={false}
          >
            <Textarea
              placeholder="Add any internal notes about this banner..."
              value={formData.notes || ''}
              onChange={e => set('notes', e.target.value)}
              rows={3}
            />
          </CollapsibleSection>
        </div>

        {/* Right column - Live Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <PiEyeBold className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Live Preview</h3>
              </div>
              <BannerPreview formData={formData} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Info</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="font-medium text-gray-900">{BANNER_TYPE_OPTIONS.find(t => t.value === formData.type)?.label}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Placement</dt>
                  <dd className="font-medium text-gray-900">{BANNER_PLACEMENT_OPTIONS.find(p => p.value === formData.placement)?.label}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-gray-500">Priority</dt>
                  <dd>
                    {(() => {
                      const colors: Record<string, string> = { low: 'bg-gray-100 text-gray-600', medium: 'bg-amber-50 text-amber-700', high: 'bg-orange-50 text-orange-700', urgent: 'bg-red-50 text-red-700' };
                      const dots: Record<string, string> = { low: 'bg-gray-400', medium: 'bg-amber-500', high: 'bg-orange-500', urgent: 'bg-red-500' };
                      return (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[formData.priority] || colors.medium}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${dots[formData.priority] || dots.medium}`} />
                          {formData.priority}
                        </span>
                      );
                    })()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">CTA Style</dt>
                  <dd className="font-medium text-gray-900">{BANNER_CTA_STYLE_OPTIONS.find(c => c.value === formData.ctaStyle)?.label || 'Primary'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Status</dt>
                  <dd className="font-medium text-gray-900">{BANNER_STATUS_OPTIONS.find(s => s.value === formData.status)?.label}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Global</dt>
                  <dd className="font-medium text-gray-900">{formData.isGlobal ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Devices</dt>
                  <dd className="font-medium text-gray-900">
                    {[deviceTargeting.desktop && 'Desktop', deviceTargeting.mobile && 'Mobile', deviceTargeting.tablet && 'Tablet'].filter(Boolean).join(', ') || 'None'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(16,24,40,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm text-gray-500">
              {formData.title || 'Untitled banner'}
            </p>
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Unsaved
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:ms-auto">
            <Button variant="outline" type="button" onClick={() => router.push(routes.eCommerce.banners)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              {isEdit ? 'Update Banner' : 'Create Banner'}
            </Button>
          </div>
        </div>
      </div>
      <div className="h-16" />
    </form>
  );
}

// Generated Content Preview Component
interface GeneratedContentPreviewProps {
  content: any | any[];
  onApply?: (content: any) => void;
  onClose?: () => void;
}

function GeneratedContentPreview({ content, onApply, onClose }: GeneratedContentPreviewProps) {
  const isArray = Array.isArray(content);
  const items = isArray ? content : [content];

  return (
    <div className="border border-purple-200 rounded-xl bg-purple-50/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-purple-700 flex items-center gap-2">
          <PiSparkleBold className="w-4 h-4" />
          {isArray ? `${items.length} Generated Options` : 'Generated Content'}
        </h4>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <PiX className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className={cn('space-y-3', isArray && 'max-h-80 overflow-y-auto')}>
        {items.map((item, index) => (
          <div
            key={index}
            className="relative bg-white rounded-lg p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Mini Banner Preview with content position + CTA style */}
            <div
              className="relative h-24 rounded-lg mb-3 overflow-hidden flex p-3"
              style={{ backgroundColor: item.backgroundColor || '#1a1a2e' }}
            >
              <div className={cn(
                'flex flex-col gap-0.5',
                PREVIEW_POS_CLS[item.contentPosition] || PREVIEW_POS_CLS.center,
              )}>
                <p className="font-bold text-sm leading-tight drop-shadow" style={{ color: item.textColor || '#fff' }}>
                  {item.title || 'Title'}
                </p>
                <p className="text-xs leading-tight opacity-80 drop-shadow" style={{ color: item.textColor || '#fff' }}>
                  {item.subtitle || 'Subtitle'}
                </p>
                {item.ctaText && (
                  <span className={cn(
                    'mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold w-fit',
                    PREVIEW_CTA_CLS[item.ctaStyle] || PREVIEW_CTA_CLS.primary,
                  )}>
                    {item.ctaText}
                  </span>
                )}
              </div>
            </div>

            {/* Content Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                  {item.styleNote?.replace('Demo content generated with ', '').replace(' style', '') || 'Generated'}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900">{item.title}</p>
              <p className="text-xs text-gray-500 line-clamp-2">{item.subtitle}</p>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-500">CTA:</span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                  {item.ctaText || 'Shop Now'}
                </span>
              </div>

              {/* AI-picked options — shown so the admin sees what the model chose */}
              {(item.type || item.placement || item.ctaStyle || item.contentPosition || item.textAlignment) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {[
                    item.type && ['Type', item.type],
                    item.placement && ['Placement', item.placement.replace(/_/g, ' ')],
                    item.ctaStyle && ['CTA style', item.ctaStyle],
                    item.contentPosition && ['Position', item.contentPosition.replace(/-/g, ' ')],
                    item.textAlignment && ['Align', item.textAlignment],
                  ].filter(Boolean).map(([label, value]: any) => (
                    <span key={label} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded-full font-medium capitalize">
                      {label}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Apply Button */}
            {onApply && (
              <Button
                size="sm"
                onClick={() => onApply(item)}
                className="absolute bottom-3 right-3 bg-purple-600 hover:bg-purple-700"
              >
                Apply
              </Button>
            )}
          </div>
        ))}
      </div>

      {isArray && onApply && (
        <div className="mt-4 pt-4 border-t border-purple-200 flex justify-between items-center">
          <p className="text-xs text-gray-500">Select one option to apply to your banner</p>
        </div>
      )}
    </div>
  );
}
