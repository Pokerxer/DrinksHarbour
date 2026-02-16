'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ProductType } from '@/types/product.types';

interface ModalQuickviewContextProps {
  children: ReactNode;
}

interface ModalQuickviewContextValue {
  selectedProduct: ProductType | null;
  isOpen: boolean;
  openQuickview: (product: ProductType) => void;
  closeQuickview: () => void;
};
const ModalQuickviewContext = createContext<ModalQuickviewContextValue | undefined>(undefined);

export const ModalQuickviewProvider: React.FC<ModalQuickviewContextProps> = ({ children }) => {
const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openQuickview = useCallback((product: ProductType) => {
    setSelectedProduct(product);
    setIsOpen(true);
  }, []);

  const closeQuickview = useCallback(() => {
    setIsOpen(false);
    // Delay clearing the product to allow exit animation
    setTimeout(() => setSelectedProduct(null), 300);
  }, []);

  return (
<ModalQuickviewContext.Provider
      value={{
        selectedProduct,
        isOpen,
        openQuickview,
        closeQuickview,
      }}
    >
      {children}
    </ModalQuickviewContext.Provider>
  );
};

export const useModalQuickviewContext = () => {;
const context = useContext(ModalQuickviewContext);
  if (!context) {
    throw new Error('useModalQuickviewContext must be used within a ModalQuickviewProvider');
  }
  return context;
};
