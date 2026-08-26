// @ts-nocheck
'use client';

/**
 * The AI Banner Generator modal shell: tabs (single / multiple options),
 * context targets + pickers, placement/type/style pickers, custom context and
 * the footer actions. All state lives in the `useBannerAI` controller.
 */

import { Modal, Button } from 'rizzui';
import {
  PiX,
  PiMagicWandBold,
  PiSparkleBold,
  PiStackBold,
  PiCheckBold,
  PiArrowsClockwise,
  PiInfoBold,
  PiConfettiBold,
  PiDiamondBold,
  PiFireBold,
  PiLeafBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import {
  BANNER_PLACEMENT_OPTIONS,
  BANNER_TYPE_OPTIONS,
} from '@/types/banner.types';
import {
  PlacementThumb,
  PLACEMENT_PREVIEW,
  PLACEMENT_TYPE_HINT,
} from '../placement';
import { GeneratedContentPreview } from '../generated-content-preview';
import type { BannerAIController } from '../use-banner-ai';
import { ContextTargetCards } from './target-cards';
import {
  ProductPicker,
  CategorySelect,
  SearchableListPicker,
  SubcategoryItem,
  BrandItem,
} from './pickers';

const STYLE_OPTIONS = [
  {
    key: 'playful',
    icon: PiConfettiBold,
    color: 'from-pink-500 to-orange-400',
    bg: 'bg-pink-50',
    text: 'text-pink-600',
  },
  {
    key: 'elegant',
    icon: PiDiamondBold,
    color: 'from-purple-500 to-indigo-500',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
  },
  {
    key: 'urgent',
    icon: PiFireBold,
    color: 'from-red-500 to-pink-500',
    bg: 'bg-red-50',
    text: 'text-red-600',
  },
  {
    key: 'calm',
    icon: PiLeafBold,
    color: 'from-green-500 to-teal-400',
    bg: 'bg-green-50',
    text: 'text-teal-600',
  },
] as const;

export default function GenerateModal({
  ai,
  contextLabels,
}: {
  ai: BannerAIController;
  /** Display names for the currently selected context targets. */
  contextLabels: {
    product?: string;
    category?: string;
    subcategory?: string;
    brand?: string;
  };
}) {
  const hasContext =
    ai.contextData.productId ||
    ai.contextData.categoryId ||
    ai.contextData.subcategoryId ||
    ai.contextData.brandId;

  return (
    <Modal
      isOpen={ai.isOpen}
      onClose={ai.closeModal}
      customSize="1400px"
      className="w-[96vw] max-w-[1400px]"
      overlayClassName="backdrop-blur-sm"
    >
      <div className="p-0">
        {/* Header */}
        <div className="relative rounded-t-xl bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 p-6">
          <button
            onClick={ai.closeModal}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          >
            <PiX className="h-5 w-5 text-white" />
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <PiMagicWandBold className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  AI Banner Generator
                </h3>
                <p className="text-sm text-white/80">
                  Create compelling banner content instantly
                </p>
              </div>
            </div>
            {hasContext && (
              <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5">
                <span className="text-xs text-white/90">
                  {ai.contextData.productId && 'Product'}
                  {ai.contextData.categoryId && 'Category'}
                  {ai.contextData.subcategoryId && 'Subcategory'}
                  {ai.contextData.brandId && 'Brand'}
                </span>
                <button
                  onClick={ai.handleClearContext}
                  className="text-white/70 hover:text-white"
                >
                  <PiX className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              ai.setShowSuggestions(false);
              ai.setGeneratedContent(null);
            }}
            className={cn(
              'relative flex-1 px-6 py-3 text-sm font-medium transition-colors',
              !ai.showSuggestions
                ? 'text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <PiSparkleBold className="h-4 w-4" />
              Generate Single
            </span>
            {!ai.showSuggestions && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
            )}
          </button>
          <button
            onClick={() => {
              ai.setShowSuggestions(true);
              ai.setGeneratedContent(null);
            }}
            className={cn(
              'relative flex-1 px-6 py-3 text-sm font-medium transition-colors',
              ai.showSuggestions
                ? 'text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <PiStackBold className="h-4 w-4" />
              Multiple Options
            </span>
            {ai.showSuggestions && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {!ai.showSuggestions ? (
            /* Single generation mode */
            <div className="space-y-6">
              <ContextTargetCards
                contextData={ai.contextData}
                activeTarget={ai.activeTarget}
                selectedProductName={
                  ai.contextData.productId
                    ? (ai.selectedProduct?.id === ai.contextData.productId
                        ? ai.selectedProduct.name
                        : contextLabels.product) || 'Selected'
                    : undefined
                }
                categoryName={contextLabels.category}
                subcategoryName={contextLabels.subcategory}
                brandName={contextLabels.brand}
                onToggle={ai.handleToggleTarget}
                onClear={ai.handleClearContext}
              />

              {ai.activeTarget === 'product' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">
                    Select Product
                  </label>
                  <ProductPicker
                    search={ai.productSearch}
                    onSearchChange={ai.setProductSearch}
                    results={ai.productResults}
                    searching={ai.searchingProducts}
                    popularProducts={ai.contextProducts}
                    selectedId={ai.contextData.productId}
                    onSelect={(p) => {
                      ai.setContextData((prev) => ({
                        ...prev,
                        productId: p.id,
                      }));
                      ai.setSelectedProduct(p);
                    }}
                    isLoadingContext={ai.isLoadingContext}
                  />
                </div>
              )}

              {ai.activeTarget === 'category' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">
                    Select Category
                  </label>
                  <CategorySelect
                    categories={ai.contextCategories}
                    selectedId={ai.contextData.categoryId}
                    onSelect={(id) =>
                      ai.setContextData((prev) => ({ ...prev, categoryId: id }))
                    }
                    isLoadingContext={ai.isLoadingContext}
                  />
                </div>
              )}

              {ai.activeTarget === 'subcategory' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">
                    Select Subcategory
                  </label>
                  <SearchableListPicker
                    search={ai.subcategorySearch}
                    onSearchChange={ai.setSubcategorySearch}
                    placeholder="Search subcategories..."
                    items={ai.contextSubcategories}
                    selectedId={ai.contextData.subcategoryId}
                    onSelect={(id) =>
                      ai.setContextData((prev) => ({
                        ...prev,
                        subcategoryId: id,
                      }))
                    }
                    isLoadingContext={ai.isLoadingContext}
                    loadingLabel="Loading..."
                    emptyLabel="No subcategories match"
                    countNoun="subcategor"
                    renderItem={(s, selected) => (
                      <SubcategoryItem s={s} selected={selected} />
                    )}
                  />
                </div>
              )}

              {ai.activeTarget === 'brand' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">
                    Select Brand
                  </label>
                  <SearchableListPicker
                    search={ai.brandSearch}
                    onSearchChange={ai.setBrandSearch}
                    placeholder="Search brands..."
                    items={ai.contextBrands}
                    selectedId={ai.contextData.brandId}
                    onSelect={(id) =>
                      ai.setContextData((prev) => ({ ...prev, brandId: id }))
                    }
                    isLoadingContext={ai.isLoadingContext}
                    loadingLabel="Loading brands..."
                    emptyLabel="No brands match"
                    countNoun="brand"
                    renderItem={(b, selected) => (
                      <BrandItem b={b} selected={selected} />
                    )}
                  />
                </div>
              )}

              {/* Placement & Type */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <label className="mb-3 block text-sm font-semibold text-gray-700">
                    Placement
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {BANNER_PLACEMENT_OPTIONS.map((opt) => {
                      const meta = PLACEMENT_PREVIEW[opt.value];
                      const hint = meta?.label.split('—')[1]?.trim();
                      const selected = ai.placement === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            ai.setPlacement(opt.value);
                            // Snap type to the placement's recommended type;
                            // the user can still override below.
                            const rec = PLACEMENT_TYPE_HINT[opt.value];
                            if (rec) ai.setType(rec);
                          }}
                          className={cn(
                            'rounded-lg border p-2.5 text-left transition-all',
                            selected
                              ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-200'
                              : 'border-gray-200 hover:border-purple-300'
                          )}
                        >
                          <PlacementThumb
                            placement={opt.value}
                            selected={selected}
                          />
                          <p
                            className={cn(
                              'text-xs font-semibold',
                              selected ? 'text-purple-700' : 'text-gray-800'
                            )}
                          >
                            {opt.label}
                          </p>
                          {hint && (
                            <p className="mt-0.5 truncate text-[10px] text-gray-400">
                              {hint}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mb-3 block text-sm font-semibold text-gray-700">
                    Banner Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BANNER_TYPE_OPTIONS.map((opt) => {
                      const selected = ai.type === opt.value;
                      const recommended =
                        PLACEMENT_TYPE_HINT[ai.placement] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => ai.setType(opt.value)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                            selected
                              ? 'border-purple-500 bg-purple-500 text-white shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50'
                          )}
                        >
                          {opt.label}
                          {recommended && (
                            <span
                              className={cn(
                                'ml-1',
                                selected ? 'text-white' : 'text-purple-500'
                              )}
                            >
                              ✨
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400">
                    ✨ recommended for the selected placement — copy is written
                    for this placement and type, and both are applied to the
                    banner on Apply.
                  </p>
                </div>
              </div>

              {/* Style selection */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-gray-700">
                  Choose Style
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STYLE_OPTIONS.map(({ key, icon: Ic, color, bg, text }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        ai.setContextData((prev) => ({ ...prev, style: key }))
                      }
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-all',
                        ai.contextData.style === key
                          ? `bg-gradient-to-br ${color} scale-105 text-white shadow-lg`
                          : `${bg} ${text} hover:scale-105`
                      )}
                    >
                      <Ic className="h-5 w-5" />
                      <span className="text-xs font-medium capitalize">
                        {key}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom context */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Additional Context (optional)
                </label>
                <textarea
                  value={ai.contextData.customContext}
                  onChange={(e) =>
                    ai.setContextData((prev) => ({
                      ...prev,
                      customContext: e.target.value,
                    }))
                  }
                  placeholder="E.g., 'Include mentions of Valentine's Day' or 'Focus on gift-giving angle'"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 px-4 py-3 text-sm placeholder-gray-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              {ai.generatedContent && (
                <GeneratedContentPreview
                  content={ai.generatedContent}
                  onApply={ai.applyGeneratedContent}
                  onClose={() => ai.setGeneratedContent(null)}
                />
              )}
            </div>
          ) : (
            /* Multiple options mode */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">
                  Generate multiple style variations for{' '}
                  <span className="font-medium text-gray-800">
                    {BANNER_PLACEMENT_OPTIONS.find(
                      (o) => o.value === ai.placement
                    )?.label || 'Home Hero'}
                    {' · '}
                    {BANNER_TYPE_OPTIONS.find((o) => o.value === ai.type)
                      ?.label || 'Promotional'}
                  </span>
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Options:</span>
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => ai.setSuggestionCount(n)}
                      className={cn(
                        'rounded-lg px-3 py-1 text-xs font-semibold transition',
                        ai.suggestionCount === n
                          ? 'bg-purple-500 text-white'
                          : 'border border-gray-200 text-gray-500 hover:border-purple-300 hover:bg-purple-50'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {ai.generatedContent ? (
                <GeneratedContentPreview
                  content={ai.generatedContent}
                  onApply={ai.applyGeneratedContent}
                  onClose={() => ai.setGeneratedContent(null)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-gray-400">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50">
                    <PiStackBold className="h-7 w-7 text-purple-400" />
                  </div>
                  <p className="mb-1 text-sm font-medium text-gray-600">
                    No options generated yet
                  </p>
                  <p className="max-w-xs text-center text-xs text-gray-400">
                    Pick a context above, choose a count, then click the button
                    below to generate variations
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="rounded-b-xl border-t border-gray-200 bg-gray-50 p-4">
          {ai.generatedContent && (
            <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="text-xs text-gray-600">
                  {Array.isArray(ai.generatedContent)
                    ? `${ai.generatedContent.length} options ready`
                    : 'Content generated'}
                </span>
              </div>
              <button
                onClick={ai.handleRegenerate}
                disabled={ai.isGenerating}
                className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
              >
                <PiArrowsClockwise className="h-3 w-3" />
                Regenerate
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <PiInfoBold className="h-4 w-4" />
              Powered by AI
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={ai.closeModal} type="button">
                Close
              </Button>
              {!ai.showSuggestions ? (
                ai.generatedContent ? (
                  <Button
                    onClick={() => ai.applyGeneratedContent(ai.generatedContent)}
                    type="button"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <PiCheckBold className="mr-2 h-4 w-4" />
                    Apply Content
                  </Button>
                ) : (
                  <Button
                    onClick={ai.handleGenerate}
                    isLoading={ai.isGenerating}
                    type="button"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <PiSparkleBold className="mr-2 h-4 w-4" />
                    Generate
                  </Button>
                )
              ) : ai.generatedContent ? (
                <span className="px-3 text-xs text-gray-500">
                  Click an option to apply
                </span>
              ) : (
                <Button
                  onClick={ai.handleGenerateSuggestions}
                  isLoading={ai.isGenerating}
                  type="button"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <PiSparkleBold className="mr-2 h-4 w-4" />
                  Generate {ai.suggestionCount} Options
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
