import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProductType } from '@/types/product.types';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import { useCompare } from '@/context/CompareContext';
import { useModalCompareContext } from '@/context/ModalCompareContext';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { resolveCartLine } from 'commerce-core';

export const useProductActions = (data: ProductType) => {
  const router = useRouter();
  const { addToCart, updateCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { addToWishlist, removeFromWishlist, wishlistState } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const { addToCompare, removeFromCompare, compareState } = useCompare();
  const { openModalCompare } = useModalCompareContext();
  const { openQuickview } = useModalQuickviewContext();

  const isInCart = cartState.cartArray.some(item => item.id === data.id);
  const isInWishlist = wishlistState.wishlistArray.some(item => item.id === data.id);
  const isInCompare = compareState.compareArray.some(item => item.id === data.id);

  const handleAddToCart = useCallback(() => {
    // Ids resolved off `availableAt`; a line without them is dropped by
    // /api/cart/validate and blocks checkout.
    const line = resolveCartLine(data);
    if (!isInCart) {
      addToCart({ ...data }, line?.size || '', '', line?.vendorName || '', line?.tenantId || '', 1, line?.sizeId || '', line?.subProductId || '');
    }
    updateCart(data.id, data.quantityPurchase || 1, line?.size || '', '', line?.vendorName || '', line?.tenantId || '');
    openModalCart();
  }, [data, isInCart, addToCart, updateCart, openModalCart]);

  const handleAddToWishlist = useCallback(() => {
    if (isInWishlist) {
      removeFromWishlist(data.id);
    } else {
      addToWishlist(data);
    }
    openModalWishlist();
  }, [data, isInWishlist, addToWishlist, removeFromWishlist, openModalWishlist]);

  const handleAddToCompare = useCallback(() => {
    if (compareState.compareArray.length < 3) {
      if (isInCompare) {
        removeFromCompare(data.id);
      } else {
        addToCompare(data);
      }
    } else {
      alert('Compare up to 3 products');
    }
    openModalCompare();
  }, [data, isInCompare, compareState.compareArray.length, addToCompare, removeFromCompare, openModalCompare]);

  const handleQuickviewOpen = useCallback(() => {
    openQuickview(data);
  }, [data, openQuickview]);

  const handleDetailProduct = useCallback(() => {
    router.push(`/product/default?id=${data.id}`);
  }, [data.id, router]);

  return {
    handleAddToCart,
    handleAddToWishlist,
    handleAddToCompare,
    handleQuickviewOpen,
    handleDetailProduct,
    isInCart,
    isInWishlist,
    isInCompare
  };
};
