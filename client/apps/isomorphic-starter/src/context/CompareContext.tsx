"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
} from "react";
import { ProductType } from "@/type/ProductType";

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
  isInCompare: (itemId: string) => boolean;
  compareCount: number;
  maxCompareLimit: number;
}

const COMPARE_STORAGE_KEY = "drinksharbour_compare";
const MAX_COMPARE_ITEMS = 4;

const CompareContext = createContext<CompareContextProps | undefined>(undefined);

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
          (item) => item.id !== action.payload,
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
    // Check if already in compare
    if (compareState.compareArray.some((compareItem) => compareItem.id === item.id)) {
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

  const isInCompare = useCallback(
    (itemId: string) => {
      return compareState.compareArray.some((item) => item.id === itemId);
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
        isInCompare,
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
