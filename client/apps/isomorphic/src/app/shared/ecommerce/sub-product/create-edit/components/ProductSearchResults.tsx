import Image from 'next/image';
import { motion } from 'framer-motion';
import { Text } from 'rizzui';
import { PiPackage, PiCheck, PiMagnifyingGlass, PiPlusCircle, PiArrowRight } from 'react-icons/pi';

export interface Product {
  id?: string;
  _id?: string;
  name: string;
  slug?: string;
  type?: string;
  brand?: { name: string } | string;
  category?: { name: string } | string;
  images?: Array<{ url: string; alt: string }>;
  primaryImage?: { url: string; alt: string };
  thumbImage?: Array<string | { url: string }>;
  availability?: {
    status: string;
    totalStock?: number;
  };
  barcode?: string;
  volumeMl?: number;
  abv?: number;
  status?: string;
}

interface ProductSearchResultsProps {
  products: Product[];
  selectedIndex: number;
  selectedProductId?: string;
  highlightedText: string;
  isLoading: boolean;
  searchQuery: string;
  onSelect: (product: Product) => void;
  onCreateNew?: (searchQuery: string) => void;
}

export function ProductSearchResults({
  products,
  selectedIndex,
  selectedProductId,
  highlightedText,
  isLoading,
  searchQuery,
  onSelect,
  onCreateNew,
}: ProductSearchResultsProps) {
  const getProductImage = (product: Product): string => {
    if (product.primaryImage?.url) return product.primaryImage.url;
    if (product.images?.[0]?.url) return product.images[0].url;
    if (product.thumbImage && product.thumbImage.length > 0) {
      const img = product.thumbImage[0];
      return typeof img === 'string' ? img : img?.url || '';
    }
    return '';
  };

  const getProductBrand = (product: Product): string => {
    if (typeof product.brand === 'string') return product.brand;
    if (product.brand?.name) return product.brand.name;
    if (typeof product.category === 'string') return product.category;
    if (product.category?.name) return product.category.name;
    return 'No brand';
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 font-semibold px-0.5 rounded">{part}</span>
      ) : (
        part
      )
    );
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute w-full z-50 mt-2 rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex flex-col items-center justify-center py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600" />
          <Text className="mt-4 text-sm text-gray-600 font-medium">Searching products...</Text>
        </div>
      </motion.div>
    );
  }

  if (products.length === 0 && searchQuery.length >= 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute w-full z-50 mt-2 rounded-xl border border-gray-200 bg-white p-8 shadow-2xl"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <PiMagnifyingGlass className="h-8 w-8 text-gray-400" />
          </div>
          <Text className="mt-4 text-base font-semibold text-gray-900">
            No products found
          </Text>
          <Text className="mt-1 text-sm text-gray-500">
            We couldn&apos;t find any products matching &quot;{searchQuery}&quot;
          </Text>
          <Text className="mt-1 text-xs text-gray-400">
            Try a different search term or create a new product
          </Text>
          
          {onCreateNew && (
            <button
              type="button"
              onClick={() => onCreateNew(searchQuery)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow-md transition-all"
            >
              <PiPlusCircle className="h-4 w-4" />
              Create New Product
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="absolute w-full z-50 mt-2 max-h-[520px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
    >
      {/* Header */}
      <div className="sticky top-0 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <Text className="text-sm font-semibold text-gray-700">
            {products.length} product{products.length !== 1 ? 's' : ''} found
          </Text>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="hidden sm:inline">Use</span>
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-gray-700">↑</kbd>
            <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-gray-700">↓</kbd>
            <span className="hidden sm:inline">to navigate</span>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="max-h-[440px] overflow-y-auto p-3">
        {products.map((product, index) => {
          const isSelected = index === selectedIndex;
          const isCurrentlySelected = selectedProductId === (product._id || product.id);
          const imageUrl = getProductImage(product);
          const brandName = getProductBrand(product);
          const inStock = product.availability?.status !== 'out_of_stock';

          return (
            <button
              key={product._id || product.id}
              type="button"
              data-index={index}
              onClick={() => onSelect(product)}
              className={`
                group flex w-full items-center gap-4 rounded-lg p-3 text-left transition-all duration-200
                ${isSelected || isCurrentlySelected
                  ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                  : 'border-2 border-transparent hover:bg-gray-50 hover:border-gray-100'
                }
              `}
            >
              {/* Product Image Container */}
              <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-inner">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                    sizes="80px"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <PiPackage className="h-8 w-8" />
                    <span className="text-[10px] mt-1">No image</span>
                  </div>
                )}
                
                {/* Stock Status Badge */}
                {product.availability?.totalStock !== undefined && (
                  <div className={`
                    absolute bottom-0 left-0 right-0 py-1 px-2 text-center text-[10px] font-bold text-white uppercase tracking-wide
                    ${inStock ? 'bg-green-500' : 'bg-red-500'}
                  `}>
                    {inStock ? 'In Stock' : 'Out of Stock'}
                  </div>
                )}
                
                {/* Image overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              </div>

              {/* Product Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Text className="truncate text-base font-bold text-gray-900 leading-tight">
                      {highlightMatch(product.name, highlightedText)}
                    </Text>
                    
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {product.type && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          {product.type}
                        </span>
                      )}
                      {product.status === 'pending' && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          Pending
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">{brandName}</span>
                      {product.volumeMl && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">{product.volumeMl}ml</span>
                        </>
                      )}
                      {product.abv && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">{product.abv}% ABV</span>
                        </>
                      )}
                    </div>
                    
                    {/* Stock count */}
                    {product.availability?.totalStock !== undefined && (
                      <div className="mt-1.5 text-xs">
                        <span className={inStock ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                          {product.availability.totalStock} units available
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  <div className={`
                    flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 shadow-sm
                    ${isCurrentlySelected ? 'bg-green-500 shadow-green-200' : 'bg-gray-100 group-hover:bg-gray-200'}
                  `}>
                    {isCurrentlySelected ? (
                      <PiCheck className="h-4 w-4 text-white" />
                    ) : (
                      <PiArrowRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      {onCreateNew && (
        <div className="sticky bottom-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
          <button
            type="button"
            onClick={() => onCreateNew(searchQuery)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all"
          >
            <PiPlusCircle className="h-4 w-4" />
            Can&apos;t find it? Create new product
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default ProductSearchResults;
