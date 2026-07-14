"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
  useRef,
} from "react";
import { ProductType } from "@/types/product.types";
import { API_URL } from "@/lib/api";
import { resolveProductPrice, resolveProductOriginPrice } from "@/utils/product.utils";

interface CompareItem extends ProductType {}

interface CompareState {
  compareArray: CompareItem[];
}

type CompareAction =
  | { type: "ADD_TO_COMPARE"; payload: ProductType }
  | { type: "REMOVE_FROM_COMPARE"; payload: string }
  | { type: "LOAD_COMPARE"; payload: CompareItem[] }
  | { type: "CLEAR_COMPARE" }
  | { type: "SET_COMPARE"; payload: CompareItem[] };

interface CompareContextProps {
  compareState: CompareState;
  addToCompare: (item: ProductType) => { success: boolean; message: string };
  removeFromCompare: (itemId: string) => void;
  clearCompare: () => void;
  toggleCompare: (item: ProductType) => { success: boolean; message: string };
  isInCompare: (itemId: string) => boolean;
  refreshCompareData: () => Promise<void>;
  isRefreshing: boolean;
  compareCount: number;
  maxCompareLimit: number;
}

const COMPARE_STORAGE_KEY = "drinksharbour_compare";
const MAX_COMPARE_ITEMS = 4;

const CompareContext = createContext<CompareContextProps | undefined>(undefined);

const getProductId = (item: ProductType | CompareItem): string => {
  return item._id || item.id || '';
};

const CompareReducer = (
  state: CompareState,
  action: CompareAction,
): CompareState => {
  switch (action.type) {
    case "ADD_TO_COMPARE":
      const newItem: CompareItem = { ...action.payload };
      return { ...state, compareArray: [...state.compareArray, newItem] };
    case "REMOVE_FROM_COMPARE":
      return {
        ...state,
        compareArray: state.compareArray.filter(
          (item) => getProductId(item) !== action.payload,
        ),
      };
    case "LOAD_COMPARE":
    case "SET_COMPARE":
      return { ...state, compareArray: action.payload };
    case "CLEAR_COMPARE":
      return { ...state, compareArray: [] };
    default:
      return state;
  }
};

export const CompareProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [compareState, dispatch] = useReducer(CompareReducer, {
    compareArray: [],
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Snapshot of the current array for callbacks that must not re-create on every change.
  const compareRef = useRef<CompareItem[]>([]);
  compareRef.current = compareState.compareArray;

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COMPARE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          dispatch({ type: "LOAD_COMPARE", payload: parsed });
        }
      }
    } catch (error) {
      console.error("Error loading compare from localStorage:", error);
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage when compareState changes
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(
          COMPARE_STORAGE_KEY,
          JSON.stringify(compareState.compareArray),
        );
      } catch (error) {
        console.error("Error saving compare to localStorage:", error);
      }
    }
  }, [compareState.compareArray, isInitialized]);

  const addToCompare = useCallback((item: ProductType): { success: boolean; message: string } => {
    const itemId = getProductId(item);
    
    // Check if already in compare
    if (compareState.compareArray.some((compareItem) => getProductId(compareItem) === itemId)) {
      return {
        success: false,
        message: "Product is already in your comparison list",
      };
    }

    // Check limit
    if (compareState.compareArray.length >= MAX_COMPARE_ITEMS) {
      return {
        success: false,
        message: `You can only compare up to ${MAX_COMPARE_ITEMS} products`,
      };
    }

    dispatch({ type: "ADD_TO_COMPARE", payload: item });
    return {
      success: true,
      message: "Product added to comparison",
    };
  }, [compareState.compareArray.length]);

  const removeFromCompare = useCallback((itemId: string) => {
    dispatch({ type: "REMOVE_FROM_COMPARE", payload: itemId });
  }, []);

  const clearCompare = useCallback(() => {
    dispatch({ type: "CLEAR_COMPARE" });
  }, []);

  const toggleCompare = useCallback(
    (item: ProductType): { success: boolean; message: string } => {
      const itemId = getProductId(item);
      if (compareRef.current.some((c) => getProductId(c) === itemId)) {
        dispatch({ type: "REMOVE_FROM_COMPARE", payload: itemId });
        return { success: true, message: "Removed from comparison" };
      }
      return addToCompare(item);
    },
    [addToCompare],
  );

  // Re-fetch live price/stock for stored items (localStorage snapshots go stale).
  // Runs at most 4 parallel requests; silently keeps the snapshot on any failure.
  const refreshCompareData = useCallback(async () => {
    const items = compareRef.current;
    if (items.length === 0) return;
    setIsRefreshing(true);
    try {
      const results = await Promise.all(
        items.map(async (item) => {
          if (!item.slug) return item;
          try {
            const res = await fetch(`${API_URL}/api/products/slug/${item.slug}`);
            if (!res.ok) return item;
            const data = await res.json();
            const fresh = data?.data?.product || data?.data;
            if (!fresh) return item;
            // Merge only the volatile fields; keep the rest of the snapshot.
            return {
              ...item,
              // getProductBySlug returns no top-level `price`, only priceRange /
              // availableAt — resolve from those so a stale ₦0 snapshot heals.
              price: resolveProductPrice(fresh) || item.price,
              originPrice: resolveProductOriginPrice(fresh) ?? item.originPrice,
              discount: fresh.discount ?? item.discount,
              sale: fresh.sale ?? item.sale,
              rating: fresh.rating ?? item.rating,
              rate: fresh.rate ?? item.rate,
              reviewCount: fresh.reviewCount ?? item.reviewCount,
              availability: fresh.availability ?? item.availability,
              availableAt: fresh.availableAt ?? item.availableAt,
              quantity: fresh.quantity ?? item.quantity,
            } as CompareItem;
          } catch {
            return item;
          }
        }),
      );
      dispatch({ type: "SET_COMPARE", payload: results });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const isInCompare = useCallback(
    (itemId: string) => {
      return compareState.compareArray.some((item) => getProductId(item) === itemId);
    },
    [compareState.compareArray],
  );

  const compareCount = compareState.compareArray.length;

  return (
    <CompareContext.Provider
      value={{
        compareState,
        addToCompare,
        removeFromCompare,
        clearCompare,
        toggleCompare,
        isInCompare,
        refreshCompareData,
        isRefreshing,
        compareCount,
        maxCompareLimit: MAX_COMPARE_ITEMS,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
};

export const useCompare = () => {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return context;
};
