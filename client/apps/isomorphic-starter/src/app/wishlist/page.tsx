'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { API_URL } from '@/lib/api';

export default function WishlistPage() {
  const router = useRouter();
  const { wishlistState, removeFromWishlist, clearWishlist, wishlistCount } = useWishlist();
  const { addToCart } = useCart();
  const [mounted, setMounted] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const items = wishlistState?.wishlistArray || [];

  const handleRemove = (productId: string) => {
    removeFromWishlist(productId);
  };

  const handleAddToCart = async (item: any) => {
    setLoadingId(item._id || item.id);
    try {
      // Add to cart with default options
      addToCart({
        ...item,
        quantity: 1,
        selectedSize: item.selectedSize || item.sizes?.[0]?.size || '',
        selectedSizeId: item.selectedSizeId || item.sizes?.[0]?._id || '',
        selectedSubProductId: item.selectedSubProductId || item._id || '',
        selectedProductId: item.selectedProductId || item._id || '',
        selectedVendor: item.selectedVendor || '',
        selectedVendorId: item.selectedVendorId || '',
        selectedColor: '',
        cartItemId: `${item._id || item.id}-${Date.now()}`,
      });
      
      // Optionally remove from wishlist after adding to cart
      removeFromWishlist(item._id || item.id);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear your wishlist?')) {
      clearWishlist();
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
          <div className="text-center py-16">
            <Icon.PiHeartBold className="w-16 h-16 mx-auto text-gray-300" />
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">Your wishlist is empty</h2>
            <p className="mt-2 text-gray-600">Save items you love by clicking the heart icon</p>
            <Link href="/shop" className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
              Start Shopping
              <Icon.PiArrowRightBold />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
          <button
            onClick={handleClearAll}
            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <Icon.PiTrashBold />
            Clear All
          </button>
        </div>
        <p className="text-gray-600 mb-6">{items.length} item(s) saved</p>

        <div className="space-y-4">
          {items.map((item: any) => (
            <div key={item._id || item.id} className="bg-white rounded-2xl shadow-sm p-4 flex gap-4 hover:shadow-md transition-shadow">
              <div 
                className="w-24 h-24 md:w-32 md:h-32 relative flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                onClick={() => router.push(`/product/${item.slug}`)}
              >
                {item.thumbImage?.[0] || item.image || item.images?.[0] ? (
                  <Image 
                    src={item.thumbImage?.[0] || item.image || item.images?.[0]} 
                    alt={item.name} 
                    fill 
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon.PiImageBold className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <Link 
                  href={`/product/${item.slug}`} 
                  className="text-lg font-semibold text-gray-900 hover:underline line-clamp-2"
                >
                  {item.name}
                </Link>
                
                {item.type && (
                  <p className="text-sm text-gray-500 mt-1 capitalize">{item.type}</p>
                )}
                
                {item.priceRange?.min !== undefined && (
                  <p className="text-lg font-bold text-gray-900 mt-2">
                    ₦{item.priceRange.min.toLocaleString()}
                    {item.priceRange.min !== item.priceRange.max && ` - ₦${item.priceRange.max.toLocaleString()}`}
                  </p>
                )}
                
                {item.price && (
                  <p className="text-lg font-bold text-gray-900 mt-2">₦{Number(item.price).toLocaleString()}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => handleAddToCart(item)}
                    disabled={loadingId === (item._id || item.id)}
                    className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingId === (item._id || item.id) ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Icon.PiShoppingCartBold />
                        Add to Cart
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleRemove(item._id || item.id)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                  >
                    <Icon.PiTrashBold />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link href="/shop" className="text-gray-600 hover:text-gray-900 flex items-center gap-2">
            <Icon.PiArrowLeftBold />
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}