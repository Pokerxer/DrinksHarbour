'use client';

import { atom, useAtom, useAtomValue } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { POSCartItem, POSStaff, POSTenant } from '@/app/shared/point-of-sale/types';
import { useCallback, useMemo } from 'react';

// ─── Auth (persisted) ────────────────────────────────────────────────────────

const posTokenAtom    = atomWithStorage<string | null>('dh-pos-token', null);
const posStaffAtom    = atomWithStorage<POSStaff | null>('dh-pos-staff', null);
const posTenantAtom   = atomWithStorage<POSTenant | null>('dh-pos-tenant', null);
const posTerminalAtom = atomWithStorage<'retail' | 'wholesale' | null>('dh-pos-terminal', null);

export const usePOSAuth = () => {
  const [token, setToken]       = useAtom(posTokenAtom);
  const [staff, setStaff]       = useAtom(posStaffAtom);
  const [tenant, setTenant]     = useAtom(posTenantAtom);
  const [terminal, setTerminal] = useAtom(posTerminalAtom);

  const setAuth = useCallback(
    (newToken: string, newStaff: POSStaff, newTenant: POSTenant) => {
      setToken(newToken);
      setStaff(newStaff);
      setTenant(newTenant);
    },
    [setToken, setStaff, setTenant]
  );

  const logout = useCallback(() => {
    setToken(null);
    setStaff(null);
    setTenant(null);
    setTerminal(null);
  }, [setToken, setStaff, setTenant, setTerminal]);

  const isAuthenticated = useCallback(() => !!token, [token]);

  return { token, staff, tenant, terminal, setAuth, setTerminal, logout, isAuthenticated };
};

// ─── Cart types ───────────────────────────────────────────────────────────────

type CartCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type CartData = {
  id: string;
  ref: string;
  items: POSCartItem[];
  customer: CartCustomer;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  note: string;
};

const DEFAULT_CUSTOMER: CartCustomer = {
  firstName: 'Walk-in',
  lastName: 'Customer',
  email: 'walkin@pos.local',
  phone: '',
};

const INITIAL_CART_ID = 'cart-0';

const INITIAL_CART: CartData = {
  id: INITIAL_CART_ID,
  ref: '001',
  items: [],
  customer: DEFAULT_CUSTOMER,
  discountType: 'percent',
  discountValue: 0,
  note: '',
};

// ─── Multi-cart atoms (persisted) ─────────────────────────────────────────────

const cartsAtom       = atomWithStorage<CartData[]>('dh-pos-carts', [INITIAL_CART]);
const activeCartIdAtom = atomWithStorage<string>('dh-pos-active-cart', INITIAL_CART_ID);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getItemKey(subProductId: string, sizeId?: string) {
  return sizeId ? `${subProductId}_${sizeId}` : subProductId;
}

function makeCartId() {
  return `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeCartRef(existingCount: number) {
  return String(existingCount + 1).padStart(3, '0');
}

function computeSubtotal(items: POSCartItem[]) {
  return items.reduce((sum, item) => {
    const line = item.price * item.quantity;
    return sum + line - line * (item.discount / 100);
  }, 0);
}

function computeDiscountAmount(subtotal: number, type: 'percent' | 'fixed', value: number) {
  if (value <= 0) return 0;
  return type === 'fixed' ? Math.min(value, subtotal) : subtotal * (value / 100);
}

// ─── usePOSCart ───────────────────────────────────────────────────────────────

export const usePOSCart = () => {
  const [carts, setCarts] = useAtom(cartsAtom);
  const [activeCartId, setActiveCartId] = useAtom(activeCartIdAtom);

  // Always resolve to a valid cart
  const activeCart = useMemo(
    () => carts.find((c) => c.id === activeCartId) ?? carts[0] ?? INITIAL_CART,
    [carts, activeCartId]
  );

  const { items, customer, discountType, discountValue, note, ref } = activeCart;

  // Derived values
  const subtotal      = useMemo(() => computeSubtotal(items), [items]);
  const discountAmount = useMemo(
    () => computeDiscountAmount(subtotal, discountType, discountValue),
    [subtotal, discountType, discountValue]
  );
  const total     = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
  const itemCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  // ── Update helper ──────────────────────────────────────────────────────────
  const patchActive = useCallback(
    (patch: Partial<CartData>) => {
      setCarts((prev) =>
        prev.map((c) => (c.id === activeCart.id ? { ...c, ...patch } : c))
      );
    },
    [activeCart.id, setCarts]
  );

  // ── Multi-cart ops ─────────────────────────────────────────────────────────
  const addCart = useCallback(() => {
    const nc: CartData = {
      id: makeCartId(),
      ref: makeCartRef(carts.length),
      items: [],
      customer: DEFAULT_CUSTOMER,
      discountType: 'percent',
      discountValue: 0,
      note: '',
    };
    setCarts((prev) => [...prev, nc]);
    setActiveCartId(nc.id);
  }, [carts.length, setCarts, setActiveCartId]);

  const switchCart = useCallback(
    (id: string) => setActiveCartId(id),
    [setActiveCartId]
  );

  const removeCart = useCallback(
    (id: string) => {
      setCarts((prev) => {
        if (prev.length <= 1) {
          // Reset the only cart instead of removing
          return [{ ...INITIAL_CART, id: prev[0].id, ref: prev[0].ref }];
        }
        return prev.filter((c) => c.id !== id);
      });
      // If we're removing the active cart, switch to the first remaining one
      if (id === activeCartId) {
        const remaining = carts.filter((c) => c.id !== id);
        if (remaining.length > 0) setActiveCartId(remaining[0].id);
      }
    },
    [carts, activeCartId, setCarts, setActiveCartId]
  );

  // ── Item ops ───────────────────────────────────────────────────────────────
  const addItem = useCallback(
    (item: POSCartItem) => {
      patchActive({
        items: (() => {
          const key = getItemKey(item.subProductId, item.sizeId);
          const existing = activeCart.items.find(
            (i) => getItemKey(i.subProductId, i.sizeId) === key
          );
          if (existing) {
            return activeCart.items.map((i) =>
              getItemKey(i.subProductId, i.sizeId) === key
                ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.stock) }
                : i
            );
          }
          return [...activeCart.items, item];
        })(),
      });
    },
    [activeCart.items, patchActive]
  );

  const removeItem = useCallback(
    (subProductId: string, sizeId?: string) => {
      patchActive({
        items: activeCart.items.filter(
          (i) => getItemKey(i.subProductId, i.sizeId) !== getItemKey(subProductId, sizeId)
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const updateQuantity = useCallback(
    (subProductId: string, quantity: number, sizeId?: string) => {
      patchActive({
        items: activeCart.items.map((i) =>
          getItemKey(i.subProductId, i.sizeId) === getItemKey(subProductId, sizeId)
            ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
            : i
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const updateItemDiscount = useCallback(
    (subProductId: string, discount: number, sizeId?: string) => {
      patchActive({
        items: activeCart.items.map((i) =>
          getItemKey(i.subProductId, i.sizeId) === getItemKey(subProductId, sizeId)
            ? { ...i, discount: Math.max(0, Math.min(100, discount)) }
            : i
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const updateItemPrice = useCallback(
    (subProductId: string, price: number, sizeId?: string) => {
      patchActive({
        items: activeCart.items.map((i) =>
          getItemKey(i.subProductId, i.sizeId) === getItemKey(subProductId, sizeId)
            ? { ...i, price: Math.max(0, price) }
            : i
        ),
      });
    },
    [activeCart.items, patchActive]
  );

  const clearCart = useCallback(() => {
    patchActive({
      items: [],
      customer: DEFAULT_CUSTOMER,
      discountType: 'percent',
      discountValue: 0,
      note: '',
    });
  }, [patchActive]);

  const setCustomer = useCallback(
    (c: CartCustomer) => patchActive({ customer: c }),
    [patchActive]
  );

  const setDiscount = useCallback(
    (type: 'percent' | 'fixed', value: number) =>
      patchActive({ discountType: type, discountValue: value }),
    [patchActive]
  );

  const setNote = useCallback(
    (n: string) => patchActive({ note: n }),
    [patchActive]
  );

  return useMemo(
    () => ({
      // Multi-cart
      carts,
      activeCartId,
      activeCartRef: ref,
      addCart,
      switchCart,
      removeCart,
      // Active cart data
      items,
      customer,
      discountType,
      discountValue,
      note,
      subtotal,
      discountAmount,
      total,
      itemCount,
      // Item ops
      addItem,
      removeItem,
      updateQuantity,
      updateItemDiscount,
      updateItemPrice,
      clearCart,
      setCustomer,
      setDiscount,
      setNote,
    }),
    [
      carts, activeCartId, ref,
      addCart, switchCart, removeCart,
      items, customer, discountType, discountValue, note,
      subtotal, discountAmount, total, itemCount,
      addItem, removeItem, updateQuantity, updateItemDiscount, updateItemPrice,
      clearCart, setCustomer, setDiscount, setNote,
    ]
  );
};

// ─── Permissions helper ───────────────────────────────────────────────────────

export const usePOSPermissions = () => {
  const { staff } = usePOSAuth();
  const perms: string[] = staff?.posPermissions ?? [];
  return {
    canSell:        perms.includes('pos:sell')     || perms.length === 0,
    canRefund:      perms.includes('pos:refund'),
    canVoid:        perms.includes('pos:void'),
    canDiscount:    perms.includes('pos:discount'),
    canPriceOverride: perms.includes('pos:price_override'),
    has: (p: string) => perms.includes(p),
  };
};

// ─── UI State ────────────────────────────────────────────────────────────────

const posActiveViewAtom      = atom<'sell' | 'payment' | 'receipt'>('sell');
const posPaymentMethodAtom   = atom('cash');
const posAmountTenderedAtom  = atom(0);
const posSplitPaymentsAtom   = atom<{ method: string; amount: number }[]>([]);
const posSearchQueryAtom     = atom('');
const posSelectedCategoryAtom = atom('');

export const usePOSUI = () => {
  const [activeView, setActiveView]         = useAtom(posActiveViewAtom);
  const [paymentMethod, setPaymentMethod]   = useAtom(posPaymentMethodAtom);
  const [amountTendered, setAmountTendered] = useAtom(posAmountTenderedAtom);
  const [splitPayments, setSplitPayments]   = useAtom(posSplitPaymentsAtom);
  const [searchQuery, setSearchQuery]       = useAtom(posSearchQueryAtom);
  const [selectedCategory, setSelectedCategory] = useAtom(posSelectedCategoryAtom);

  const resetPayment = useCallback(() => {
    setPaymentMethod('cash');
    setAmountTendered(0);
    setSplitPayments([]);
  }, [setPaymentMethod, setAmountTendered, setSplitPayments]);

  return useMemo(
    () => ({
      activeView, setActiveView,
      paymentMethod, setPaymentMethod,
      amountTendered, setAmountTendered,
      splitPayments, setSplitPayments,
      searchQuery, setSearchQuery,
      selectedCategory, setSelectedCategory,
      resetPayment,
    }),
    [
      activeView, paymentMethod, amountTendered, splitPayments,
      searchQuery, selectedCategory,
      setActiveView, setPaymentMethod, setAmountTendered,
      setSplitPayments, setSearchQuery, setSelectedCategory,
      resetPayment,
    ]
  );
};
