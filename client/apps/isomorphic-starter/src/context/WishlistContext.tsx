"use client";

import React, {
  createContext,
  useContext,
  useState,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import { ProductType } from "@/types/product.types";

interface WishlistItem extends ProductType {
  addedAt?: number;
}

interface WishlistState {
  wishlistArray: WishlistItem[];
}

type WishlistAction =
  | { type: "ADD_TO_WISHLIST"; payload: ProductType }
  | { type: "REMOVE_FROM_WISHLIST"; payload: string }
  | { type: "CLEAR_WISHLIST" }
  | { type: "LOAD_WISHLIST"; payload: { items: WishlistItem[]; savedAt: number } };

interface WishlistContextProps {
  wishlistState: WishlistState;
  addToWishlist: (item: ProductType) => void;
  removeFromWishlist: (itemId: string) => void;
  clearWishlist: () => void;
  toggleWishlist: (item: ProductType) => void;
  isInWishlist: (itemId: string) => boolean;
  wishlistCount: number;
}

const WishlistContext = createContext<WishlistContextProps | undefined>(
  undefined
);

const WISHLIST_EXPIRY_DAYS = 30;
const STORAGE_KEY = "drinksharbour_wishlist";

const isWishlistExpired = (savedAt: number): boolean => {
  const expiryTime = WISHLIST_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - savedAt > expiryTime;
};

const WishlistReducer = (
  state: WishlistState,
  action: WishlistAction
): WishlistState => {
  switch (action.type) {
    case "ADD_TO_WISHLIST": {
      const exists = state.wishlistArray.some(
        (item) => item.id === action.payload.id
      );
      if (exists) {
        return state;
      }
      const newItem: WishlistItem = { ...action.payload, addedAt: Date.now() };
      return { ...state, wishlistArray: [...state.wishlistArray, newItem] };
    }
    case "REMOVE_FROM_WISHLIST":
      return {
        ...state,
        wishlistArray: state.wishlistArray.filter(
          (item) => item.id !== action.payload
        ),
      };
    case "CLEAR_WISHLIST":
      return { ...state, wishlistArray: [] };
    case "LOAD_WISHLIST":
      return { ...state, wishlistArray: action.payload.items };
    default:
      return state;
  }
};

export const WishlistProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [wishlistState, dispatch] = useReducer(WishlistReducer, {
    wishlistArray: [],
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedWishlist = localStorage.getItem(STORAGE_KEY);
    if (savedWishlist) {
      try {
        const parsed = JSON.parse(savedWishlist);
        if (parsed.items && Array.isArray(parsed.items)) {
          if (parsed.savedAt && isWishlistExpired(parsed.savedAt)) {
            localStorage.removeItem(STORAGE_KEY);
          } else {
            const validItems = parsed.items.filter((item: WishlistItem) => {
              if (item.addedAt) {
                const itemExpiry = 30 * 24 * 60 * 60 * 1000;
                return Date.now() - item.addedAt < itemExpiry;
              }
              return true;
            });
            dispatch({ type: "LOAD_WISHLIST", payload: { items: validItems, savedAt: parsed.savedAt } });
          }
        }
      } catch (error) {
        console.error("Failed to parse wishlist from localStorage:", error);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const storageData = {
        items: wishlistState.wishlistArray,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    }
  }, [wishlistState.wishlistArray, isLoaded]);

  const addToWishlist = useCallback((item: ProductType) => {
    dispatch({ type: "ADD_TO_WISHLIST", payload: item });
  }, []);

  const removeFromWishlist = useCallback((itemId: string) => {
    dispatch({ type: "REMOVE_FROM_WISHLIST", payload: itemId });
  }, []);

  const clearWishlist = useCallback(() => {
    dispatch({ type: "CLEAR_WISHLIST" });
  }, []);

  const toggleWishlist = useCallback((item: ProductType) => {
    const exists = wishlistState.wishlistArray.some(
      (wishlistItem) => wishlistItem.id === item.id
    );
    if (exists) {
      dispatch({ type: "REMOVE_FROM_WISHLIST", payload: item.id });
    } else {
      dispatch({ type: "ADD_TO_WISHLIST", payload: item });
    }
  }, [wishlistState.wishlistArray]);

  const isInWishlist = useCallback(
    (itemId: string): boolean => {
      return wishlistState.wishlistArray.some(
        (item) => item.id === itemId
      );
    },
    [wishlistState.wishlistArray]
  );

  const wishlistCount = wishlistState.wishlistArray.length;

  return (
    <WishlistContext.Provider
      value={{
        wishlistState,
        addToWishlist,
        removeFromWishlist,
        clearWishlist,
        toggleWishlist,
        isInWishlist,
        wishlistCount,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
