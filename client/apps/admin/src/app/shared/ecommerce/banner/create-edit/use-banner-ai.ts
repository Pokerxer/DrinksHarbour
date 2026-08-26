// @ts-nocheck
'use client';

/**
 * State + handlers for the AI banner generator.
 *
 * Owns: modal visibility, context data (products/categories/subcategories/
 * brands), target pickers with search, generation/suggestions/enhance calls
 * and applying generated content back to the banner form.
 *
 * Form mutation callbacks are kept in a ref so handler identities stay stable
 * while always reading the latest form state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { bannerService } from '@/services/banner.service';
import { productService } from '@/services/product.service';
import type { BannerFormData } from '@/types/banner.types';
import { buildCtaFromContext, type ResolvedBannerContext } from './cta-links';

type TargetType = 'product' | 'category' | 'subcategory' | 'brand';

/**
 * One row shape for the product picker regardless of source.
 *
 * The picker is fed by two different endpoints — the preloaded "popular" set
 * from `/banner-ai/context-data` (already flattened, `image` is a string) and
 * the live search from `/products/admin/list` (raw docs, `images[]` of objects).
 * Mapping them through the same function is what stops one source rendering
 * thumbnails while the other silently shows placeholders.
 */
function normalizeProduct(p: any) {
  const fromImages = Array.isArray(p.images)
    ? p.images.find((i: any) => i?.isPrimary) || p.images[0]
    : undefined;
  return {
    id: p.id || p._id,
    name: p.name,
    slug: p.slug || '',
    brand: typeof p.brand === 'object' ? p.brand?.name || '' : p.brand || '',
    image:
      p.image ||
      p.thumbnail ||
      p.featuredImage?.url ||
      (typeof fromImages === 'string' ? fromImages : fromImages?.url) ||
      '',
  };
}

interface UseBannerAIOptions {
  token: string;
  formData: BannerFormData;
  setField: (field: keyof BannerFormData, value: any) => void;
  setTargetProduct: (p: { _id: string; name: string } | null) => void;
  setTargetCategory: (c: { _id: string; name: string } | null) => void;
  setTargetBrand: (b: { _id: string; name: string } | null) => void;
}

export function useBannerAI({
  token,
  formData,
  setField,
  setTargetProduct,
  setTargetCategory,
  setTargetBrand,
}: UseBannerAIOptions) {
  // Latest-values mirror — stable handler closures read from here.
  const latest = useRef({
    token,
    formData,
    setField,
    setTargetProduct,
    setTargetCategory,
    setTargetBrand,
  });
  latest.current = {
    token,
    formData,
    setField,
    setTargetProduct,
    setTargetCategory,
    setTargetBrand,
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [enhancingField, setEnhancingField] = useState<string | null>(null);

  const [contextProducts, setContextProducts] = useState<any[]>([]);
  const [contextCategories, setContextCategories] = useState<any[]>([]);
  const [contextSubcategories, setContextSubcategories] = useState<any[]>([]);
  const [contextBrands, setContextBrands] = useState<any[]>([]);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const [activeTarget, setActiveTarget] = useState<TargetType | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [placement, setPlacement] = useState('home_hero');
  const [type, setType] = useState('promotional');
  const [contextData, setContextData] = useState({
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
  // What the server actually loaded for the last generation. CTA links are built
  // from this — never from a URL the model invented, and never from an id the
  // storefront can't resolve.
  const [resolvedContext, setResolvedContext] =
    useState<ResolvedBannerContext | null>(null);
  // How many of each target the picker is showing, straight from the server.
  const [contextCounts, setContextCounts] = useState<{
    categories: number;
    subcategories: number;
    products: number;
    brands: number;
  } | null>(null);
  const [productsArePartial, setProductsArePartial] = useState(false);

  // Seed placement/type from the form every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setPlacement(formData.placement || 'home_hero');
    setType(formData.type || 'promotional');
    fetchContextData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Debounced live product search across the whole catalog.
  useEffect(() => {
    if (!isOpen || !token) return;
    const q = productSearch.trim();
    if (q.length < 2) {
      setProductResults([]);
      setSearchingProducts(false);
      return;
    }
    setSearchingProducts(true);
    const t = setTimeout(async () => {
      try {
        const response = await productService.getProducts(token, {
          search: q,
          limit: 15,
          // /products/admin/list returns EVERY status (434 of the 986 products
          // are `pending`). A banner can only promote a live product, and the
          // preloaded set is approved-only — without this the two halves of the
          // same picker disagreed about what exists.
          status: 'approved',
        });
        const list = response?.data?.products || response?.products || [];
        setProductResults(list.map(normalizeProduct));
      } catch (err) {
        console.error('AI product search failed:', err);
        setProductResults([]);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch, isOpen, token]);

  const fetchContextData = useCallback(async () => {
    if (!latest.current.token) return;
    setIsLoadingContext(true);
    try {
      const response = await bannerService.getBannerContextData(
        latest.current.token
      );
      if (response.success) {
        setContextProducts(
          (response.data.products || []).map(normalizeProduct)
        );
        setContextCategories(response.data.categories || []);
        setContextSubcategories(response.data.subcategories || []);
        setContextBrands(response.data.brands || []);
        setContextCounts(response.metadata?.counts || null);
        setProductsArePartial(Boolean(response.metadata?.productsArePartial));
      }
    } catch (err) {
      console.error('Failed to fetch context data:', err);
      toast.error('Failed to load products and categories');
    } finally {
      setIsLoadingContext(false);
    }
  }, []);

  /** Toggle a context target card; opening one clears other targets. */
  const handleToggleTarget = useCallback(
    (target: TargetType) => {
      if (activeTarget === target) {
        setActiveTarget(null);
        setContextData((prev) => ({ ...prev, [`${target}Id`]: '' }));
        if (target === 'product') {
          setSelectedProduct(null);
          setProductSearch('');
        }
        return;
      }
      fetchContextData();
      setActiveTarget(target);
      setContextData((prev) => ({
        ...prev,
        productId: target === 'product' ? prev.productId : '',
        categoryId: target === 'category' ? prev.categoryId : '',
        subcategoryId: target === 'subcategory' ? prev.subcategoryId : '',
        brandId: target === 'brand' ? prev.brandId : '',
      }));
    },
    [activeTarget, fetchContextData]
  );

  const handleClearContext = useCallback(() => {
    setContextData((prev) => ({
      ...prev,
      productId: '',
      categoryId: '',
      subcategoryId: '',
      brandId: '',
      customContext: '',
    }));
    setProductSearch('');
    setSubcategorySearch('');
    setBrandSearch('');
    setProductResults([]);
    setSelectedProduct(null);
    setActiveTarget(null);
    setGeneratedContent(null);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setGeneratedContent(null);
    setShowSuggestions(false);
  }, []);

  const openModal = useCallback(() => setIsOpen(true), []);

  const buildParams = useCallback(() => {
    const cd = contextData;
    const params: any = {
      bannerType: type,
      placement,
      style: cd.style,
    };
    if (cd.productId) params.productId = cd.productId;
    if (cd.categoryId) params.categoryId = cd.categoryId;
    if (cd.subcategoryId) params.subcategoryId = cd.subcategoryId;
    if (cd.brandId) params.brandId = cd.brandId;
    if (cd.customContext) params.customContext = cd.customContext;
    return params;
  }, [contextData, type, placement]);

  /**
   * The server answers `success: true` with canned demo copy when the AI is
   * unconfigured or errors out. Saying nothing made that indistinguishable from
   * a real generation — the admin applied placeholder copy believing it was
   * written for their product.
   */
  const warnIfFallback = useCallback((response: any) => {
    if (response?.fallback) {
      toast(
        response.note?.includes('not configured')
          ? 'AI is not configured — showing sample copy, not generated content'
          : 'AI is unavailable right now — showing sample copy, not generated content',
        { icon: '⚠️', duration: 6000 }
      );
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!latest.current.token) {
      toast.error('Authentication required');
      return;
    }
    setIsGenerating(true);
    setGeneratedContent(null);
    setResolvedContext(null);
    try {
      const response = await bannerService.generateBannerContent(
        buildParams(),
        latest.current.token
      );
      if (response.success && response.data) {
        setGeneratedContent(response.data);
        setResolvedContext(response.resolvedContext || null);
        warnIfFallback(response);
      } else {
        toast.error(response.message || 'Failed to generate content');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate banner content');
    } finally {
      setIsGenerating(false);
    }
  }, [buildParams, warnIfFallback]);

  const handleGenerateSuggestions = useCallback(async () => {
    if (!latest.current.token) {
      toast.error('Authentication required');
      return;
    }
    setIsGenerating(true);
    setGeneratedContent(null);
    setResolvedContext(null);
    try {
      const response = await bannerService.generateBannerSuggestions(
        { count: suggestionCount, ...buildParams() },
        latest.current.token
      );
      if (response.success && response.data) {
        setGeneratedContent(response.data);
        setResolvedContext(response.resolvedContext || null);
        warnIfFallback(response);
        if (!response.fallback) {
          toast.success(`${response.data.length} options generated!`);
        }
      } else {
        toast.error(response.message || 'Failed to generate suggestions');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate suggestions');
    } finally {
      setIsGenerating(false);
    }
  }, [buildParams, suggestionCount, warnIfFallback]);

  const handleRegenerate = useCallback(async () => {
    if (showSuggestions) {
      await handleGenerateSuggestions();
    } else {
      await handleGenerate();
    }
  }, [showSuggestions, handleGenerate, handleGenerateSuggestions]);

  /**
   * The context to build links from: what the server actually resolved for the
   * last generation, falling back to the locally-loaded lists when the response
   * predates `resolvedContext` (or the generation came from the demo path).
   */
  const effectiveContext = useCallback((): ResolvedBannerContext => {
    const cd = contextData;
    // Only trust the server's copy while it still describes the CURRENT
    // selection — changing the target after generating (without regenerating)
    // would otherwise apply a link to the previous target.
    const matchesSelection =
      resolvedContext &&
      (resolvedContext.product?.id || '') === (cd.productId || '') &&
      (resolvedContext.category?.id || '') === (cd.categoryId || '') &&
      (resolvedContext.subcategory?.id || '') === (cd.subcategoryId || '') &&
      (resolvedContext.brand?.id || '') === (cd.brandId || '');
    if (matchesSelection && Object.keys(resolvedContext).length) {
      return resolvedContext;
    }
    const out: ResolvedBannerContext = {};
    if (cd.productId) {
      const p =
        (selectedProduct && selectedProduct.id === cd.productId
          ? selectedProduct
          : null) || contextProducts.find((x) => x.id === cd.productId);
      if (p) out.product = { id: p.id, name: p.name, slug: p.slug };
    }
    if (cd.subcategoryId) {
      const s = contextSubcategories.find((x) => x.id === cd.subcategoryId);
      if (s) {
        out.subcategory = {
          id: s.id,
          name: s.name,
          slug: s.slug,
          parentSlug: s.parentSlug,
          parentName: s.parentName,
        };
      }
    }
    if (cd.categoryId) {
      const c = contextCategories.find((x) => x.id === cd.categoryId);
      if (c) out.category = { id: c.id, name: c.name, slug: c.slug };
    }
    if (cd.brandId) {
      const b = contextBrands.find((x) => x.id === cd.brandId);
      if (b) out.brand = { id: b.id, name: b.name, slug: b.slug };
    }
    return out;
  }, [
    resolvedContext,
    contextData,
    selectedProduct,
    contextProducts,
    contextCategories,
    contextSubcategories,
    contextBrands,
  ]);

  /**
   * Apply generated content to the banner form. The placement/type chosen in
   * the modal are authoritative; CTA links are derived client-side from the
   * selected context (never trust an AI-generated URL).
   */
  const applyGeneratedContent = useCallback(
    (content: any) => {
      const {
        setField: set,
        setTargetProduct: setTP,
        setTargetCategory: setTC,
        setTargetBrand: setTB,
      } = latest.current;

      if (content.title) set('title', content.title);
      if (content.subtitle) set('subtitle', content.subtitle);
      if (content.ctaText) set('ctaText', content.ctaText);
      if (content.backgroundColor)
        set('backgroundColor', content.backgroundColor);
      if (content.textColor) set('textColor', content.textColor);
      if (content.contentPosition)
        set('contentPosition', content.contentPosition);
      if (content.textAlignment) set('textAlignment', content.textAlignment);
      if (content.tags && Array.isArray(content.tags))
        set('tags', content.tags);

      // AI-picked enum options (only present when the model chose a valid value).
      if (content.type) set('type', content.type);
      if (content.placement) set('placement', content.placement);
      if (content.ctaStyle) set('ctaStyle', content.ctaStyle);

      if (placement) set('placement', placement);
      if (type) set('type', type);

      // ── Target refs + CTA link ────────────────────────────────────────────
      // target* are ObjectId refs on the Banner model, so they always get the
      // id — never the slug, or the save fails casting to ObjectId. The CTA URL
      // is a separate concern and comes from the slug-based builders.
      const ctx = effectiveContext();
      if (ctx.product?.id)
        setTP({ _id: ctx.product.id, name: ctx.product.name || '' });
      if (ctx.category?.id)
        setTC({ _id: ctx.category.id, name: ctx.category.name || '' });
      if (ctx.brand?.id)
        setTB({ _id: ctx.brand.id, name: ctx.brand.name || '' });

      const cta = buildCtaFromContext(ctx);
      if (cta) {
        set('linkType', cta.linkType);
        set('ctaLink', cta.ctaLink);
      }

      toast.success('Content applied to banner!');
      closeModal();
    },
    [placement, type, effectiveContext, closeModal]
  );

  /** Per-field AI sparkle: rewrite one copy field in place. */
  const handleEnhanceField = useCallback(
    async (
      field: 'title' | 'subtitle' | 'ctaText',
      action: 'rewrite' | 'expand' | 'shorten' | 'punchier' = 'rewrite'
    ) => {
      const { token: tkn, formData: form, setField: set } = latest.current;
      const value = ((form as any)[field] || '').trim();
      if (!value) {
        toast.error('Add some text first, then let AI polish it');
        return;
      }
      if (!tkn) {
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
            context: {
              type: form.type,
              placement: form.placement,
              title: form.title,
            },
          },
          tkn
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
    },
    []
  );

  return {
    // modal
    isOpen,
    openModal,
    closeModal,
    // generation
    isGenerating,
    generatedContent,
    setGeneratedContent,
    showSuggestions,
    setShowSuggestions,
    suggestionCount,
    setSuggestionCount,
    handleGenerate,
    handleGenerateSuggestions,
    handleRegenerate,
    applyGeneratedContent,
    // field enhance
    enhancingField,
    handleEnhanceField,
    // context
    contextData,
    setContextData,
    activeTarget,
    handleToggleTarget,
    handleClearContext,
    isLoadingContext,
    contextProducts,
    contextCategories,
    contextSubcategories,
    contextBrands,
    contextCounts,
    productsArePartial,
    resolvedContext,
    // pickers state
    placement,
    setPlacement,
    type,
    setType,
    productSearch,
    setProductSearch,
    subcategorySearch,
    setSubcategorySearch,
    brandSearch,
    setBrandSearch,
    productResults,
    searchingProducts,
    selectedProduct,
    setSelectedProduct,
  };
}

export type BannerAIController = ReturnType<typeof useBannerAI>;
