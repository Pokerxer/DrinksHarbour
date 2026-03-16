'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { useWishlist } from '@/context/WishlistContext';

export default function WishlistPage() {
  const router = useRouter();
  const { wishlistState, removeFromWishlist } = useWishlist();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleRemove = (productId: string) => {
    removeFromWishlist(productId);
  };

  const handleAddToCart = (product: any) => {
    router.push(`/product/${product.slug}`);
  };

  if (wishlistState.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
        <p className="mt-2 text-gray-600">{wishlistState.items.length} item(s) saved</p>

        <div className="mt-8 space-y-4">
          {wishlistState.items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4 flex gap-4">
              <div className="w-24 h-24 relative flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon.PiImageBold className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.slug}`} className="text-lg font-semibold text-gray-900 hover:underline">
                  {item.name}
                </Link>
                {item.price && (
                  <p className="mt-1 text-gray-900 font-medium">{item.price}</p>
                )}
                <button
                  onClick={() => handleAddToCart(item)}
                  className="mt-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <Icon.PiShoppingCartBold />
                  View Product
                </button>
              </div>
              <button
                onClick={() => handleRemove(item.id)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Icon.PiTrashBold className="w-5 h-5" />
              </button>
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