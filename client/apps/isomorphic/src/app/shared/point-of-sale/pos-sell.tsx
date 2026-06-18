'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import POSSessionBar from '@/app/shared/point-of-sale/components/pos-session-bar';
import POSProductGrid from '@/app/shared/point-of-sale/components/pos-product-grid';
import POSCart from '@/app/shared/point-of-sale/components/pos-cart';
import POSPaymentModal from '@/app/shared/point-of-sale/components/pos-payment-modal';
import POSOpenSessionModal from '@/app/shared/point-of-sale/pos-open-session-modal';
import POSNotificationBell from '@/app/shared/point-of-sale/pos-notification-bell';
import {
  usePOSCart,
  usePOSUI,
  usePOSAuth,
  usePOSSettings,
} from '@/app/shared/point-of-sale/store';
import { posApi } from '@/app/shared/point-of-sale/api';
import { POSProduct, POSSession } from '@/app/shared/point-of-sale/types';
import { routes } from '@/config/routes';
import { getProducts as getProductsOffline } from './offline/api';
import { runSyncEngine, registerBackgroundSync } from './offline/sync';
import { useOnlineStatus } from './offline/use-online-status';
import { useRegisterSW } from './offline/register-sw';

export default function POSSell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem } = usePOSCart();
  const { activeView } = usePOSUI();
  const { token, terminal } = usePOSAuth();
  const settings = usePOSSettings();
  const isOnline = useOnlineStatus();
  useRegisterSW();

  // Whether Jotai has finished hydrating from localStorage
  const [hydrated, setHydrated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Give Jotai one tick to hydrate atomWithStorage from localStorage
  useEffect(() => {
    setHydrated(true);
  }, []);

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

  // Session timeout — lock screen after inactivity
  useEffect(() => {
    if (!settings.sessionTimeoutMins || settings.sessionTimeoutMins <= 0)
      return;
    const ms = settings.sessionTimeoutMins * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const t = terminal ?? 'retail';
        router.push(`${routes.pos.lock}?terminal=${t}`);
      }, ms);
    }
    reset();
    document.addEventListener('mousemove', reset);
    document.addEventListener('keydown', reset);
    document.addEventListener('click', reset);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousemove', reset);
      document.removeEventListener('keydown', reset);
      document.removeEventListener('click', reset);
    };
  }, [settings.sessionTimeoutMins, terminal, router]);

  // Sync offline queue and refresh product cache when coming back online
  useEffect(() => {
    if (isOnline && token) {
      runSyncEngine(token);
      registerBackgroundSync().catch(() => {});
    }
  }, [isOnline, token]);

  function handleSessionOpened(_session: POSSession) {
    setHasSession(true);
  }

  const handleAddToCart = useCallback(
    (product: POSProduct, sizeId?: string, quantity = 1) => {
      if (product.sizes?.length && !sizeId && !product.sellWithoutSizeVariants)
        return;
      const size = sizeId
        ? product.sizes.find((s) => s._id === sizeId)
        : undefined;
      const allowOverselling = settings?.allowOverselling ?? false;
      if (size && size.availableStock <= 0 && !allowOverselling) return;

      // Store the raw (pre-pricelist) price so the cart can re-apply the
      // currently selected pricelist dynamically. _priceBeforePricelist is set
      // by applyPricelistToProduct; falls back to the server price when no
      // pricelist was applied.
      const price = size
        ? ((size as any)._priceBeforePricelist ?? size.sellingPrice)
        : ((product as any)._priceBeforePricelist ?? product.baseSellingPrice);

      // Only store DB-level bundles — pricelist bundles are applied dynamically
      // from the currently selected pricelist so they follow selection changes.
      const activeBundles = (product.activeBundles ?? []).filter(
        (b) => !b.fromPricelist
      );

      addItem({
        subProductId: product._id,
        productId: product.product?._id || product._id,
        sizeId: size?._id,
        name: product.product?.name || 'Product',
        variant: size?.displayName || '',
        sku: size?.sku || product.sku,
        image:
          product.product?.images?.[0]?.thumbnail ||
          product.product?.images?.[0]?.url,
        price,
        quantity,
        discount: 0,
        stock: size?.availableStock ?? product.availableStock,
        activeBundles,
        costPrice: product.costPrice,
        originalPrice: product.originalPrice ?? undefined,
        categoryId: product.product?.category?._id,
        brandId: product.product?.brand?._id,
      });
    },
    [addItem, settings]
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
        <div className="flex w-[480px] shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white xl:w-[540px]">
          {activeView === 'payment' ? <POSPaymentModal /> : <POSCart />}
        </div>

        {/* RIGHT: product grid */}
        <div
          className={`relative flex-1 overflow-y-auto bg-gray-50 p-4${settings.largeScrollbars ? '[&::-webkit-scrollbar]:w-3' : ''}`}
        >
          {/* Notification bell — top-right of product grid */}
          <div className="absolute right-4 top-3 z-10">
            <POSNotificationBell />
          </div>
          <POSProductGrid onAddToCart={handleAddToCart} />
        </div>
      </div>

      {sessionChecked && !hasSession && (
        <POSOpenSessionModal onSessionOpened={handleSessionOpened} />
      )}
    </div>
  );
}
