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
  getCartItemId: (productId: string, size: string, vendor: string, color: string) => string;
  cartTotal: number;
  cartCount: number;
  syncCartToServer: () => Promise<boolean>;
  loadServerCart: () => Promise<void>;
  refreshCart: () => void;
}

const CART_EXPIRY_DAYS = 7;
const STORAGE_KEY = 'drinksharbour_cart';

const generateCartItemId = (productId: string, size: string, vendor: string, color: string): string => {
  return `${productId}-${size || 'default'}-${vendor || 'default'}-${color || 'default'}`;
};

const getPriceFromAvailableAt = (product: ProductType, vendorName: string, size: string): number => {
  if (!product.availableAt || !Array.isArray(product.availableAt)) {
    return product.price || product.priceRange?.min || 0;
  }
  
  const vendorEntry = product.availableAt.find((v: any) => v.tenant?.name === vendorName);
  if (!vendorEntry || !vendorEntry.sizes) {
    return product.price || product.priceRange?.min || 0;
  }
  
  const sizeEntry = vendorEntry.sizes.find((s: any) => s.size === size);
  if (sizeEntry?.pricing?.websitePrice) {
    return sizeEntry.pricing.websitePrice;
  }
  
  return product.price || product.priceRange?.min || 0;
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
      
      console.log('CartContext: Creating cart item', {
        vendor,
        vendorId,
        selectedVendor,
        selectedVendorId,
        sizeId,
        subProductId
      });
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

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [cartState, dispatch] = useReducer(cartReducer, { cartArray: [] });

  useEffect(() => {
    const savedCart = localStorage.getItem(STORAGE_KEY);
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        if (parsedCart.cartArray && Array.isArray(parsedCart.cartArray)) {
          const savedAt = parsedCart.savedAt || 0;
          if (!isCartExpired(savedAt)) {
            dispatch({ type: "LOAD_CART", payload: parsedCart.cartArray });
          } else {
            localStorage.removeItem(STORAGE_KEY);
            console.log('Cart expired after ' + CART_EXPIRY_DAYS + ' days');
          }
        }
      } catch (e) {
        console.error('Failed to parse cart from localStorage');
      }
    }
  }, []);

  useEffect(() => {
    const storageData = JSON.stringify({
      cartArray: cartState.cartArray,
      savedAt: Date.now(),
      expiryDays: CART_EXPIRY_DAYS,
    });
    localStorage.setItem(STORAGE_KEY, storageData);
  }, [cartState.cartArray]);

  // Listen for storage changes (from other tabs) and custom cart update events (from same tab)
  useEffect(() => {
    let isProcessing = false;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && !isProcessing) {
        try {
          const newCart = JSON.parse(e.newValue);
          if (newCart.cartArray && Array.isArray(newCart.cartArray)) {
            isProcessing = true;
            dispatch({ type: "LOAD_CART", payload: newCart.cartArray });
            setTimeout(() => { isProcessing = false; }, 100);
          }
        } catch (err) {
          isProcessing = false;
        }
      }
    };

    const handleCartUpdate = () => {
      if (isProcessing) return;
      const savedCart = localStorage.getItem(STORAGE_KEY);
      if (savedCart) {
        try {
          const parsed = JSON.parse(savedCart);
          if (parsed.cartArray) {
            isProcessing = true;
            dispatch({ type: "LOAD_CART", payload: parsed.cartArray });
            setTimeout(() => { isProcessing = false; }, 100);
          }
        } catch (err) {
          isProcessing = false;
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cart-updated', handleCartUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, []);

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
    
    // Also directly save to localStorage to ensure persistence
    const currentCart = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"cartArray":[]}');
    let updatedCart = [...(currentCart.cartArray || [])];
    
    const existingIdx = updatedCart.findIndex((item: CartItem) => item.cartItemId === cartItemId);
    if (existingIdx >= 0) {
      updatedCart[existingIdx].quantity = (updatedCart[existingIdx].quantity || 0) + qty;
    } else {
      const itemPrice = getPriceFromAvailableAt(product, vendor || '', size || '');
      updatedCart.push({
        ...product,
        cartItemId,
        quantity: qty,
        selectedSize: size || '',
        selectedColor: color || '',
        selectedVendor: vendor || '',
        selectedVendorId: vendorId || '',
        selectedSizeId: sizeId || '',
        selectedSubProductId: subProductId || '',
        selectedProductId: productId,
        price: itemPrice,
        addedAt: Date.now(),
      });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cartArray: updatedCart,
      savedAt: Date.now(),
      expiryDays: CART_EXPIRY_DAYS,
    }));
    
    return {
      success: true,
      isNewItem,
      cartItemId,
      newQuantity: previousQuantity + qty,
      previousQuantity
    };
  };

  const removeFromCart = (cartItemId: string) => {
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

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" });
    localStorage.removeItem(STORAGE_KEY);
  };

  const refreshCart = () => {
    const savedCart = localStorage.getItem(STORAGE_KEY);
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (parsed.cartArray) {
          dispatch({ type: "LOAD_CART", payload: parsed.cartArray });
        }
      } catch (err) {
        console.error('Failed to refresh cart:', err);
      }
    }
  };

  const getCartItemId = (productId: string, size: string, vendor: string, color: string): string => {
    return generateCartItemId(productId, size, vendor, color);
  };

  const cartTotal = useMemo(() => 
    cartState.cartArray.reduce(
      (sum, item) => {
        const itemPrice = item.price || 0;
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

  const syncCartToServer = async (): Promise<boolean> => {
    console.log('🔵 syncCartToServer called');

    // Check both localStorage and sessionStorage for token
    let token = localStorage.getItem('token');
    if (!token) {
      token = sessionStorage.getItem('token');
    }

    console.log('   Token found:', !!token);
    console.log('   Cart items:', cartState.cartArray.length);

    if (cartState.cartArray.length === 0) {
      console.log('   Cart is empty, skipping sync');
      return true;
    }

    // If no token, return false to trigger login redirect
    if (!token) {
      console.log('❌ No auth token - user must login');
      return false;
    }

    try {
      const items = cartState.cartArray.map(item => {
        const productId = item._id || item.id;
        const quantity = item.quantity || 1;
        
        // Use actual vendor/size IDs if available, otherwise fallback to productId
        const subProductId = item.selectedSubProductId || productId;
        const sizeId = item.selectedSizeId || productId;
        const tenantId = item.selectedVendorId || productId;
        
        return {
          productId,
          subProductId,
          sizeId,
          tenantId,
          quantity,
          price: item.price,
        };
      });

      console.log('   Sending', items.length, 'items to server...');
      console.log('   Items data:', items.map(i => ({ 
        productId: i.productId?.substring(0, 8), 
        subProductId: i.subProductId?.substring(0, 8),
        sizeId: i.sizeId?.substring(0, 8),
        tenantId: i.tenantId?.substring(0, 8),
        quantity: i.quantity 
      })));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      console.log('   Fetching...');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${API_URL}/api/cart/save`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ items }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        console.log('   Response status:', response.status);
        console.log('   Response data:', JSON.stringify(data).substring(0, 200));

        if (!response.ok) {
          console.error('❌ Cart sync failed:', data.message);
          return false;
        }

        console.log('✅ Cart saved successfully:', data.data?.results);
        return true;
      } catch (fetchError: any) {
        console.error('❌ Fetch error:', fetchError.name, fetchError.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Cart sync error:', error);
      return false;
    }
  };

  const loadServerCart = async (): Promise<void> => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    console.log('🔵 loadServerCart called, token exists:', !!token);

    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      const guestId = localStorage.getItem('guestId');
      if (!guestId) {
        console.log('   No token or guestId, skipping server cart load');
        return;
      }
      console.log('   Using guestId:', guestId);
    }

    try {
      const response = await fetch(`${API_URL}/api/cart`, {
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          console.log('   User not authenticated, skipping server cart load');
          return;
        }
        console.error('Failed to load server cart:', data?.message || 'Unknown error');
        return;
      }

      const serverCart = data.data?.cart;
      
      if (serverCart && serverCart.items && serverCart.items.length > 0) {
        console.log('✅ Server cart loaded:', serverCart.items.length, 'items');
      } else {
        console.log('   Server cart is empty');
      }
    } catch (error) {
      console.error('Error loading server cart:', error);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cartState,
        addToCart,
        removeFromCart,
        updateCart,
        updateQuantity,
        clearCart,
        getCartItemId,
        cartTotal,
        cartCount,
        syncCartToServer,
        loadServerCart,
        refreshCart,
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
