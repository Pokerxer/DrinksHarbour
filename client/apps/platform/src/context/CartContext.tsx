"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { ProductType } from "@/types/product.types";
import { API_URL } from "@/lib/api";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuth } from "@/context/AuthContext";
import { resolveProductPrice } from "@/utils/product.utils";
import { addToCartEvent, removeFromCartEvent, type GTagItem } from "@/lib/gtag";
import { fireAddToCart, fireAllPixels } from "@/lib/pixels";

interface CartItem extends ProductType {
  cartItemId: string;
  quantity: number;
  selectedSize: string;
  selectedColor: string;
  selectedVendor: string;
  selectedVendorId: string;
  selectedSizeId: string;
  selectedSubProductId: string;
  selectedProductId: string;
  price: number;
  addedAt: number;
  packUnitPrice?: number | null;
  packThreshold?: number | null;
}

interface CartState {
  cartArray: CartItem[];
}

type CartAction =
  | { type: "ADD_TO_CART"; payload: { product: ProductType; size: string; color: string; vendor: string; vendorId: string; quantity?: number; sizeId?: string; subProductId?: string } }
  | { type: "REMOVE_FROM_CART"; payload: string }
  | {
      type: "UPDATE_CART";
      payload: {
        cartItemId: string;
        quantity: number;
        size: string;
        color: string;
        vendor: string;
        vendorId: string;
      };
    }
  | { type: "UPDATE_QUANTITY"; payload: { cartItemId: string; quantity: number } }
  | { type: "LOAD_CART"; payload: CartItem[] }
  | { type: "CLEAR_CART" };

interface AddToCartResult {
  success: boolean;
  isNewItem: boolean;
  cartItemId: string;
  newQuantity: number;
  previousQuantity: number;
}

export type CartValidationStatus = 'ok' | 'price_changed' | 'out_of_stock' | 'quantity_reduced' | 'unavailable';

export interface CartItemValidation {
  subProductId: string;
  sizeId: string | null;
  status: CartValidationStatus;
  available: boolean;
  currentPrice: number;
  oldPrice: number;
  priceDiff: number;
  stockStatus: string;
  maxQuantity: number | null;
  isLowStock: boolean;
  baseUnitPrice?: number;
  packUnitPrice?: number | null;
  packThreshold?: number | null;
  packApplied?: boolean;
}

interface CartContextProps {
  cartState: CartState;
  addToCart: (product: ProductType, size?: string, color?: string, vendor?: string, vendorId?: string, quantity?: number, sizeId?: string, subProductId?: string) => AddToCartResult;
  removeFromCart: (cartItemId: string) => void;
  updateCart: (
    cartItemId: string,
    quantity: number,
    size: string,
    color: string,
    vendor: string,
    vendorId: string,
  ) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  /** Clears the local cart AND the stored server cart. Use after an order completes. */
  clearCartEverywhere: () => Promise<void>;
  getCartItemId: (productId: string, size: string, vendor: string, color: string) => string;
  cartTotal: number;
  cartCount: number;
  syncCartToServer: () => Promise<boolean>;
  loadServerCart: () => Promise<void>;
  refreshCart: () => void;
  // Validation
  validationMap: Record<string, CartItemValidation>;
  validating: boolean;
  validateCartItems: () => Promise<void>;
  applyValidationUpdates: () => void;
}

const CART_EXPIRY_DAYS = 7;
const STORAGE_PREFIX = 'drinksharbour_cart';
const LEGACY_STORAGE_KEY = 'drinksharbour_cart';

/** Per-identity storage key. A shared browser must never show user A's cart to user B. */
const storageKeyFor = (userId: string | null): string =>
  `${STORAGE_PREFIX}:${userId || 'guest'}`;

const generateCartItemId = (productId: string, size: string, vendor: string, color: string): string => {
  return `${productId}-${size || 'default'}-${vendor || 'default'}-${color || 'default'}`;
};

const getPackFromAvailableAt = (product: ProductType, vendorName: string, size: string): { packUnitPrice: number | null; packThreshold: number | null } => {
  const none = { packUnitPrice: null, packThreshold: null };
  if (!product.availableAt || !Array.isArray(product.availableAt)) return none;
  const vendorEntry = product.availableAt.find((v: any) => v.tenant?.name === vendorName);
  const sizeEntry = vendorEntry?.sizes?.find((s: any) => s.size === size);
  if (sizeEntry?.pricing?.packUnitPrice && sizeEntry?.pricing?.packThreshold) {
    return { packUnitPrice: sizeEntry.pricing.packUnitPrice, packThreshold: sizeEntry.pricing.packThreshold };
  }
  return none;
};

/** Per-unit price a line actually pays: pack price once quantity reaches the threshold. */
export const getEffectiveUnitPrice = (item: { price?: number; quantity?: number; packUnitPrice?: number | null; packThreshold?: number | null }): number =>
  item.packUnitPrice && item.packThreshold && (item.quantity || 1) >= item.packThreshold
    ? item.packUnitPrice
    : (item.price || 0);

const getPriceFromAvailableAt = (product: ProductType, vendorName: string, size: string): number => {
  if (!product.availableAt || !Array.isArray(product.availableAt)) {
    return resolveProductPrice(product);
  }
  
  const vendorEntry = product.availableAt.find((v: any) => v.tenant?.name === vendorName);
  if (!vendorEntry || !vendorEntry.sizes) {
    return resolveProductPrice(product);
  }
  
  const sizeEntry = vendorEntry.sizes.find((s: any) => s.size === size);
  if (sizeEntry?.pricing?.websitePrice) {
    return sizeEntry.pricing.websitePrice;
  }
  
  return resolveProductPrice(product);
};

const CartContext = createContext<CartContextProps | undefined>(undefined);

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case "ADD_TO_CART": {
      const { product, size, color, vendor, vendorId, quantity, sizeId, subProductId } = action.payload;
      const cartItemId = generateCartItemId(product._id || product.id, size, vendor, color);
      
      const existingItem = state.cartArray.find(item => item.cartItemId === cartItemId);
      const qty = quantity || 1;
      
      if (existingItem) {
        return {
          ...state,
          cartArray: state.cartArray.map(item =>
            item.cartItemId === cartItemId
              ? { ...item, quantity: item.quantity + qty, addedAt: Date.now() }
              : item
          ),
        };
      }
      
      const selectedSize = size || product.sizes?.[0]?.size || "";
      const selectedColor = color || product.variation?.[0]?.color || "";
      const selectedVendor = vendor || "";
      const selectedVendorId = vendorId || "";
      
      const selectedSizeId = sizeId || "";
      const selectedSubProductId = subProductId || "";
      const selectedProductId = product._id || product.id || "";
      const itemPrice = getPriceFromAvailableAt(product, selectedVendor, selectedSize);
      
      const newItem: CartItem = {
        ...product,
        cartItemId,
        quantity: qty,
        selectedSize,
        selectedColor,
        selectedVendor,
        selectedVendorId,
        selectedSizeId,
        selectedSubProductId,
        selectedProductId,
        price: itemPrice,
        addedAt: Date.now(),
        ...getPackFromAvailableAt(product, selectedVendor, selectedSize),
      };
      
      return { ...state, cartArray: [...state.cartArray, newItem] };
    }
    
    case "REMOVE_FROM_CART":
      return {
        ...state,
        cartArray: state.cartArray.filter((item) => item.cartItemId !== action.payload),
      };
    
    case "UPDATE_CART": {
      const { cartItemId, quantity, size, color, vendor, vendorId } = action.payload;
      const existingItem = state.cartArray.find(item => item.cartItemId === cartItemId);
      if (!existingItem) return state;
      
      const newCartItemId = generateCartItemId(
        existingItem._id || existingItem.id || '',
        size,
        vendor,
        color
      );
      
      const itemPrice = getPriceFromAvailableAt(existingItem, vendor, size);
      
      return {
        ...state,
        cartArray: state.cartArray.map((item) =>
          item.cartItemId === cartItemId
            ? {
                ...item,
                cartItemId: newCartItemId,
                quantity,
                selectedSize: size,
                selectedColor: color,
                selectedVendor: vendor,
                selectedVendorId: vendorId,
                price: itemPrice,
                addedAt: Date.now(),
                ...getPackFromAvailableAt(existingItem, vendor, size),
              }
            : item
        ),
      };
    }
    
    case "UPDATE_QUANTITY":
      return {
        ...state,
        cartArray: state.cartArray.map((item) =>
          item.cartItemId === action.payload.cartItemId
            ? { ...item, quantity: action.payload.quantity, addedAt: Date.now() }
            : item
        ),
      };
    
    case "LOAD_CART":
      // Skip if cart is already the same (compare by IDs and quantities)
      const sameCart = state.cartArray.length === action.payload.length && 
        state.cartArray.every((item, i) => 
          item.cartItemId === action.payload[i].cartItemId && item.quantity === action.payload[i].quantity
        );
      if (sameCart) {
        return state;
      }
      return { ...state, cartArray: action.payload };
    
    case "CLEAR_CART":
      return { ...state, cartArray: [] };
    
    default:
      return state;
  }
};

const isCartExpired = (savedAt: number): boolean => {
  const expiryTime = CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - savedAt > expiryTime;
};

const readStoredCart = (key: string): CartItem[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.cartArray)) return [];
    if (isCartExpired(parsed.savedAt || 0)) {
      localStorage.removeItem(key);
      return [];
    }
    return parsed.cartArray;
  } catch {
    return [];
  }
};

const writeStoredCart = (key: string, cartArray: CartItem[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify({
      cartArray, savedAt: Date.now(), expiryDays: CART_EXPIRY_DAYS,
    }));
  } catch { /* quota — the DB copy is the durable one */ }
};

/** Client cart line → the payload shape /api/cart/save and /merge expect. */
const toServerItems = (items: CartItem[]) =>
  items
    .filter((item) => item.selectedSubProductId && item.selectedSizeId)
    .map((item) => ({
      productId:    item.selectedProductId || item._id || item.id,
      subProductId: item.selectedSubProductId,
      sizeId:       item.selectedSizeId,
      tenantId:     item.selectedVendorId,
      size:         item.selectedSize,
      vendor:       item.selectedVendor,
      color:        item.selectedColor,
      quantity:     item.quantity || 1,
      price:        item.price,
    }));

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [cartState, dispatch] = useReducer(cartReducer, { cartArray: [] });

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const userId = isAuthenticated ? (user?._id ?? null) : null;

  const storageKey = storageKeyFor(userId);
  // Blocks the auto-save effect until this identity's cart has been loaded.
  // Without it the reducer's initial [] is saved over the stored cart on first paint.
  const hydratedForRef = React.useRef<string | null>(null);

  // One-time migration off the old global key into the guest key. Without this
  // an existing shopper's cart appears to vanish on deploy.
  useEffect(() => {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(storageKeyFor(null))) {
      localStorage.setItem(storageKeyFor(null), legacy);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, []);

  // Hydrate whenever the identity resolves or changes. Nothing reads or writes
  // while auth is still resolving — a save fired then would clobber the DB cart.
  useEffect(() => {
    if (authLoading) return;
    if (hydratedForRef.current === storageKey) return;

    let cancelled = false;

    const hydrate = async () => {
      if (!userId) {
        dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
        hydratedForRef.current = storageKey;
        return;
      }

      const guestItems = readStoredCart(storageKeyFor(null));

      try {
        const res = guestItems.length > 0
          ? await fetchWithAuth(`${API_URL}/api/cart/merge`, {
              method: 'POST',
              body: JSON.stringify({ items: toServerItems(guestItems) }),
            })
          : await fetchWithAuth(`${API_URL}/api/cart`);

        const data = await res.json();
        if (cancelled) return;

        if (res.ok && data.success) {
          const lines: CartItem[] = data.data?.cart?.items ?? [];
          dispatch({ type: "LOAD_CART", payload: lines });
          writeStoredCart(storageKey, lines);
          // Guest cart is now folded in — drop it so it can't merge twice.
          localStorage.removeItem(storageKeyFor(null));
        } else {
          dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
        }
      } catch {
        // Offline — fall back to this user's mirror. The guest cart is KEPT so
        // nothing is lost; the next successful hydrate merges it.
        if (!cancelled) dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
      } finally {
        if (!cancelled) hydratedForRef.current = storageKey;
      }
    };

    hydrate();
    return () => { cancelled = true; };
  }, [authLoading, storageKey, userId]);

  // Wipe in-memory state the instant the identity changes, so the previous
  // user's lines never flash on screen for the next person on a shared browser.
  const previousUserIdRef = React.useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    const previous = previousUserIdRef.current;
    previousUserIdRef.current = userId;
    if (previous === undefined || previous === userId) return;

    // Logging out: forget the account cart locally. It stays safe in the DB.
    if (previous && !userId) {
      localStorage.removeItem(storageKeyFor(previous));
    }
    dispatch({ type: "CLEAR_CART" });
    hydratedForRef.current = null;   // force a re-hydrate for the new identity
  }, [userId, authLoading]);

  // Cross-tab sync. Reads the ACTIVE identity's key and re-subscribes when the
  // identity changes. LOAD_CART already no-ops on an identical array, so the
  // old re-entrancy flag is unnecessary.
  useEffect(() => {
    const applyStored = () => {
      if (hydratedForRef.current !== storageKey) return;
      dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) applyStored();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('cart-updated', applyStored);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cart-updated', applyStored);
    };
  }, [storageKey]);

  const addToCart = (product: ProductType, size?: string, color?: string, vendor?: string, vendorId?: string, quantity?: number, sizeId?: string, subProductId?: string): AddToCartResult => {
    const productId = product._id || product.id;
    const cartItemId = generateCartItemId(productId, size || '', vendor || '', color || '');
    const qty = quantity || 1;
    
    // Get current cart from state
    let isNewItem = true;
    let previousQuantity = 0;
    const existingItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    if (existingItem) {
      isNewItem = false;
      previousQuantity = existingItem.quantity;
    }
    
    // Dispatch to update state
    dispatch({ 
      type: "ADD_TO_CART", 
      payload: { 
        product, 
        size: size || '', 
        color: color || '', 
        vendor: vendor || '', 
        vendorId: vendorId || '', 
        quantity: qty,
        sizeId: sizeId || '',
        subProductId: subProductId || ''
      } 
    });
    
    // No direct localStorage write here — the mirror effect below owns that.
    // Writing in both places is what made the reducer and localStorage drift.

    const itemPrice = getPriceFromAvailableAt(product, vendor || '', size || '');
    const gtagItems: GTagItem[] = [{
      item_id: product.sku ?? product.slug ?? product._id ?? product.id,
      item_name: product.name,
      item_category: product.category?.name ?? product.type,
      item_variant: size || undefined,
      price: itemPrice,
      quantity: qty,
    }];
    addToCartEvent({ items: gtagItems, value: itemPrice * qty });
    fireAddToCart({
      value: itemPrice * qty,
      currency: 'NGN',
      content_ids: [product.sku ?? product.slug ?? product._id ?? product.id],
      content_name: product.name,
      content_type: 'product',
    });
    fireAllPixels('AddToCart', {
      value: itemPrice * qty,
      currency: 'NGN',
      content_ids: [product.sku ?? product.slug ?? product._id ?? product.id],
      content_name: product.name,
      content_type: 'product',
    });
    
    return {
      success: true,
      isNewItem,
      cartItemId,
      newQuantity: previousQuantity + qty,
      previousQuantity
    };
  };

  const removeFromCart = (cartItemId: string) => {
    const item = cartState.cartArray.find(i => i.cartItemId === cartItemId);
    if (item) {
      const gtagItems: GTagItem[] = [{
        item_id: item.sku ?? item.slug ?? item._id ?? item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      }];
      removeFromCartEvent({ items: gtagItems, value: item.price * (item.quantity || 1) });
    }
    dispatch({ type: "REMOVE_FROM_CART", payload: cartItemId });
  };

  const updateCart = (
    cartItemId: string,
    quantity: number,
    size: string,
    color: string,
    vendor: string,
    vendorId: string,
  ) => {
    dispatch({
      type: "UPDATE_CART",
      payload: { cartItemId, quantity, size, color, vendor, vendorId },
    });
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    dispatch({
      type: "UPDATE_QUANTITY",
      payload: { cartItemId, quantity },
    });
  };

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  /** Empties the stored cart too — call after an order is placed. */
  const clearCartEverywhere = useCallback(async () => {
    clearCart();
    if (!userId) return;
    try {
      await fetchWithAuth(`${API_URL}/api/cart`, { method: 'DELETE' });
    } catch { /* the next save overwrites it anyway */ }
  }, [clearCart, userId]);

  const refreshCart = useCallback(() => {
    dispatch({ type: "LOAD_CART", payload: readStoredCart(storageKey) });
  }, [storageKey]);

  // ── Cart Validation ──────────────────────────────────────────────────────────
  const [validationMap, setValidationMap] = useState<Record<string, CartItemValidation>>({});
  const [validating, setValidating] = useState(false);

  const validateCartItems = useCallback(async () => {
    const items = cartState.cartArray;
    if (items.length === 0) return;

    setValidating(true);
    try {
      const payload = items
        .filter(item => item.selectedSubProductId)
        .map(item => ({
          subProductId: item.selectedSubProductId,
          sizeId:       item.selectedSizeId       || null,
          tenantId:     item.selectedVendorId     || null,
          quantity:     item.quantity || 1,
          price:        getEffectiveUnitPrice(item),
        }));

      if (payload.length === 0) return;

      const res  = await fetchWithAuth(`${API_URL}/api/cart/validate`, {
        method:  'POST',
        body:    JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (!data.success) return;

      // Build map keyed by subProductId (+ sizeId for uniqueness)
      const map: Record<string, CartItemValidation> = {};
      for (const v of data.data.items as CartItemValidation[]) {
        const key = `${v.subProductId}-${v.sizeId ?? ''}`;
        map[key] = v;
      }
      setValidationMap(map);
    } catch {
      // Silent fail — don't block the user
    } finally {
      setValidating(false);
    }
  }, [cartState.cartArray]);

  /** Apply all validation-suggested updates: removes unavailable items, caps quantities, syncs prices */
  const applyValidationUpdates = useCallback(() => {
    const updated = cartState.cartArray
      .filter(item => {
        const key = `${item.selectedSubProductId}-${item.selectedSizeId ?? ''}`;
        const v   = validationMap[key];
        // Drop items the server says are out of stock or unavailable
        if (v && !v.available) return false;
        return true;
      })
      .map(item => {
        const key = `${item.selectedSubProductId}-${item.selectedSizeId ?? ''}`;
        const v   = validationMap[key];
        if (!v) return item;
        const newQty   = v.maxQuantity != null ? Math.min(item.quantity || 1, v.maxQuantity) : (item.quantity || 1);
        const newPrice = (v.baseUnitPrice ?? 0) > 0 ? v.baseUnitPrice! : (v.currentPrice > 0 ? v.currentPrice : item.price);
        return { ...item, price: newPrice, quantity: newQty,
          packUnitPrice: v.packUnitPrice ?? null,
          packThreshold: v.packThreshold ?? null };
      });
    dispatch({ type: "LOAD_CART", payload: updated });
    setValidationMap({});
  }, [cartState.cartArray, validationMap]);

  const getCartItemId = (productId: string, size: string, vendor: string, color: string): string => {
    return generateCartItemId(productId, size, vendor, color);
  };

  const cartTotal = useMemo(() =>
    cartState.cartArray.reduce(
      (sum, item) => {
        const itemPrice = getEffectiveUnitPrice(item);
        return sum + (itemPrice * (item.quantity || 1));
      },
      0
    ),
    [cartState.cartArray]
  );

  const cartCount = useMemo(() => 
    cartState.cartArray.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    ),
    [cartState.cartArray]
  );

  // Gated on the auth CONTEXT, not a localStorage token. Auth moved to httpOnly
  // cookies, so the old `dh_token` check made this a no-op for every session.
  const syncCartToServer = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/cart/save`, {
        method: 'POST',
        body: JSON.stringify({ items: toServerItems(cartState.cartArray) }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [userId, cartState.cartArray]);

  const loadServerCart = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/cart`);
      const data = await res.json();
      if (!res.ok || !data.success) return;
      const lines: CartItem[] = data.data?.cart?.items ?? [];
      dispatch({ type: "LOAD_CART", payload: lines });
      writeStoredCart(storageKeyFor(userId), lines);
    } catch { /* keep whatever is on screen */ }
  }, [userId]);

  // Mirror to localStorage immediately (cheap, synchronous, survives reload),
  // then push to the DB on a debounce so a burst of +/- clicks is one request.
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Never write for an identity that hasn't finished hydrating — the reducer
    // starts at [] and would otherwise erase the stored cart on first paint.
    if (authLoading || hydratedForRef.current !== storageKey) return;

    writeStoredCart(storageKey, cartState.cartArray);
    if (!userId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { syncCartToServer(); }, 800);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [cartState.cartArray, storageKey, userId, authLoading, syncCartToServer]);

  // Flush a pending save when the tab goes away — closing a laptop must not
  // lose the last 800ms of edits.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!userId || hydratedForRef.current !== storageKey) return;
      if (!saveTimerRef.current) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      syncCartToServer();
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [userId, storageKey, syncCartToServer]);

  return (
    <CartContext.Provider
      value={{
        cartState,
        addToCart,
        removeFromCart,
        updateCart,
        updateQuantity,
        clearCart,
        clearCartEverywhere,
        getCartItemId,
        cartTotal,
        cartCount,
        syncCartToServer,
        loadServerCart,
        refreshCart,
        validationMap,
        validating,
        validateCartItems,
        applyValidationUpdates,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
