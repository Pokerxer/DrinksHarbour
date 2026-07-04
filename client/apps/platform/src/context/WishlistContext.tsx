"use client";

import React, { createContext, useContext, useState, useReducer, useEffect, useCallback } from "react";
import { ProductType } from "@/types/product.types";
import { API_URL } from "@/lib/api";

export interface WishlistItem extends ProductType {
  addedAt?: number;
  note?: string;
  priority?: 'high' | 'medium' | 'low' | 'gift';
  // server-populated fields
  serverProduct?: any;
}

interface WishlistState { wishlistArray: WishlistItem[] }

type WishlistAction =
  | { type: "ADD_TO_WISHLIST"; payload: ProductType }
  | { type: "REMOVE_FROM_WISHLIST"; payload: string }
  | { type: "CLEAR_WISHLIST" }
  | { type: "LOAD_WISHLIST"; payload: { items: WishlistItem[]; savedAt: number } }
  | { type: "SET_SERVER_WISHLIST"; payload: WishlistItem[] };

interface WishlistContextProps {
  wishlistState: WishlistState;
  addToWishlist: (item: ProductType) => void;
  removeFromWishlist: (itemId: string) => void;
  clearWishlist: () => void;
  toggleWishlist: (item: ProductType) => void;
  isInWishlist: (itemId: string) => boolean;
  wishlistCount: number;
  serverItems: any[];      // full server-populated items (for wishlist page)
  serverLoading: boolean;
  refreshServer: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextProps | undefined>(undefined);

const STORAGE_KEY = "drinksharbour_wishlist";

const WishlistReducer = (state: WishlistState, action: WishlistAction): WishlistState => {
  switch (action.type) {
    case "ADD_TO_WISHLIST": {
      const exists = state.wishlistArray.some(i => i.id === action.payload.id || i._id === (action.payload as any)._id);
      if (exists) return state;
      return { ...state, wishlistArray: [...state.wishlistArray, { ...action.payload, addedAt: Date.now() }] };
    }
    case "REMOVE_FROM_WISHLIST":
      return { ...state, wishlistArray: state.wishlistArray.filter(i => i.id !== action.payload && (i as any)._id !== action.payload) };
    case "CLEAR_WISHLIST":
      return { ...state, wishlistArray: [] };
    case "LOAD_WISHLIST":
      return { ...state, wishlistArray: action.payload.items };
    case "SET_SERVER_WISHLIST":
      return { ...state, wishlistArray: action.payload };
    default:
      return state;
  }
};

const getToken = () =>
  typeof window !== "undefined"
    ? localStorage.getItem("dh_token") || sessionStorage.getItem("dh_token") || ""
    : "";

const authFetch = (url: string, opts: RequestInit = {}) => {
  const token = getToken();
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
};

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wishlistState, dispatch] = useReducer(WishlistReducer, { wishlistArray: [] });
  const [isLoaded, setIsLoaded] = useState(false);
  const [serverItems, setServerItems] = useState<any[]>([]);
  const [serverLoading, setServerLoading] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.items && Array.isArray(parsed.items)) {
          dispatch({ type: "LOAD_WISHLIST", payload: { items: parsed.items, savedAt: parsed.savedAt } });
        }
      } catch {}
    }
    setIsLoaded(true);
  }, []);

  // If authenticated, fetch server wishlist and use it as source of truth
  const refreshServer = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setServerLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/products/wishlist`);
      const data = await res.json();
      if (data.success) {
        const items: any[] = data.data?.items || [];
        setServerItems(items);
        // Sync local state IDs so isInWishlist works
        const local = items.map((item: any) => ({
          id: item.product?._id || item.product,
          _id: item.product?._id || item.product,
          name: item.product?.name || '',
          slug: item.product?.slug || '',
          price: 0,
          images: [],
          addedAt: new Date(item.addedAt).getTime(),
          note: item.note,
          priority: item.priority,
        } as unknown as WishlistItem));
        dispatch({ type: "SET_SERVER_WISHLIST", payload: local });
      }
    } catch {}
    finally { setServerLoading(false); }
  }, []);

  useEffect(() => {
    if (isLoaded && getToken()) refreshServer();
  }, [isLoaded, refreshServer]);

  // Persist to localStorage for guests
  useEffect(() => {
    if (isLoaded && !getToken()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: wishlistState.wishlistArray, savedAt: Date.now() }));
    }
  }, [wishlistState.wishlistArray, isLoaded]);

  const addToWishlist = useCallback((item: ProductType) => {
    dispatch({ type: "ADD_TO_WISHLIST", payload: item });
    const token = getToken();
    if (token) {
      const productId = (item as any)._id || item.id;
      authFetch(`${API_URL}/api/products/wishlist/${productId}`, { method: "POST", body: JSON.stringify({ priority: "medium" }) })
        .then(() => refreshServer())
        .catch(() => {});
    }
  }, [refreshServer]);

  const removeFromWishlist = useCallback((itemId: string) => {
    dispatch({ type: "REMOVE_FROM_WISHLIST", payload: itemId });
    setServerItems(prev => prev.filter(i => (i.product?._id || i.product) !== itemId));
    const token = getToken();
    if (token) {
      authFetch(`${API_URL}/api/products/wishlist/${itemId}`, { method: "DELETE" }).catch(() => {});
    }
  }, []);

  const clearWishlist = useCallback(() => {
    dispatch({ type: "CLEAR_WISHLIST" });
    setServerItems([]);
    const token = getToken();
    if (token) {
      authFetch(`${API_URL}/api/products/wishlist`, { method: "DELETE" }).catch(() => {});
    }
  }, []);

  const toggleWishlist = useCallback((item: ProductType) => {
    const id = (item as any)._id || item.id;
    const exists = wishlistState.wishlistArray.some(i => i.id === id || (i as any)._id === id);
    if (exists) removeFromWishlist(id);
    else addToWishlist(item);
  }, [wishlistState.wishlistArray, addToWishlist, removeFromWishlist]);

  const isInWishlist = useCallback((itemId: string) =>
    wishlistState.wishlistArray.some(i => i.id === itemId || (i as any)._id === itemId),
    [wishlistState.wishlistArray]);

  return (
    <WishlistContext.Provider value={{
      wishlistState, addToWishlist, removeFromWishlist, clearWishlist,
      toggleWishlist, isInWishlist,
      wishlistCount: wishlistState.wishlistArray.length,
      serverItems, serverLoading, refreshServer,
    }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
};
