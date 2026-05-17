'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import POSSessionBar from '@/app/shared/point-of-sale/components/pos-session-bar';
import POSProductGrid from '@/app/shared/point-of-sale/components/pos-product-grid';
import POSCart from '@/app/shared/point-of-sale/components/pos-cart';
import POSPaymentModal from '@/app/shared/point-of-sale/components/pos-payment-modal';
import POSOpenSessionModal from '@/app/shared/point-of-sale/pos-open-session-modal';
import { usePOSCart, usePOSUI, usePOSAuth } from '@/app/shared/point-of-sale/store';
import { posApi } from '@/app/shared/point-of-sale/api';
import { POSProduct, POSSession } from '@/app/shared/point-of-sale/types';
import { routes } from '@/config/routes';

export default function POSSell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem } = usePOSCart();
  const { activeView } = usePOSUI();
  const { token, terminal } = usePOSAuth();

  // Whether Jotai has finished hydrating from localStorage
  const [hydrated, setHydrated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Give Jotai one tick to hydrate atomWithStorage from localStorage
  useEffect(() => { setHydrated(true); }, []);

  // Redirect to lock screen if no POS token after hydration
  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      const t = searchParams.get('terminal') ?? terminal ?? 'retail';
      router.replace(`${routes.pos.lock}?terminal=${t}`);
    }
  }, [hydrated, token, terminal, router, searchParams]);

  // Check for an open session once we have a token
  useEffect(() => {
    if (!token) return;
    posApi
      .getSessionInfo(token, terminal ?? 'retail')
      .then((data) => setHasSession(!!data.currentSession))
      .catch(() => setHasSession(false))
      .finally(() => setSessionChecked(true));
  }, [token, terminal]);

  function handleSessionOpened(_session: POSSession) {
    setHasSession(true);
  }

  const handleAddToCart = useCallback(
    (product: POSProduct, sizeId?: string) => {
      if (product.sizes?.length && !sizeId && !product.sellWithoutSizeVariants) return;
      const size = sizeId ? product.sizes.find((s) => s._id === sizeId) : undefined;
      // Prevent adding an out-of-stock size
      if (size && size.availableStock <= 0) return;
      // Server already bakes sale discounts into sellingPrice/baseSellingPrice
      const price = size?.sellingPrice ?? product.baseSellingPrice;
      addItem({
        subProductId: product._id,
        productId: product.product?._id || product._id,
        sizeId: size?._id,
        name: product.product?.name || 'Product',
        variant: size?.displayName || '',
        sku: size?.sku || product.sku,
        image: product.product?.images?.[0]?.thumbnail || product.product?.images?.[0]?.url,
        price,
        quantity: 1,
        discount: 0,
        stock: size?.availableStock ?? product.availableStock,
      });
    },
    [addItem]
  );

  // Show nothing while Jotai hydrates (avoids flicker of empty content)
  if (!hydrated || !token) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-white">
      <POSSessionBar />

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: cart + dialpad */}
        <div className="flex w-[480px] xl:w-[540px] shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          {activeView === 'payment' ? <POSPaymentModal /> : <POSCart />}
        </div>

        {/* RIGHT: product grid */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <POSProductGrid onAddToCart={handleAddToCart} />
        </div>
      </div>

      {sessionChecked && !hasSession && (
        <POSOpenSessionModal onSessionOpened={handleSessionOpened} />
      )}
    </div>
  );
}
