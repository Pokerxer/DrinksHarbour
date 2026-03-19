"use client";
import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface LastAddedItem {
  name: string;
  quantity: number;
  isNewItem: boolean;
  cartItemId: string;
  price?: number;
  image?: string;
}

interface ModalCartContextProps {
  children: ReactNode;
}

interface ModalCartContextValue {
  isModalOpen: boolean;
  lastAddedItem: LastAddedItem | null;
  openModalCart: () => void;
  closeModalCart: () => void;
  toggleModalCart: () => void;
  openCartWithItem: (item: LastAddedItem) => void;
  clearLastAddedItem: () => void;
}

const ModalCartContext = createContext<ModalCartContextValue | undefined>(undefined);

export const useModalCartContext = (): ModalCartContextValue => {
  const context = useContext(ModalCartContext);
  if (!context) {
    throw new Error(
      "useModalCartContext must be used within a ModalCartProvider",
    );
  }
  return context;
};

export const ModalCartProvider: React.FC<ModalCartContextProps> = ({
  children,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<LastAddedItem | null>(null);

  const openModalCart = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModalCart = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const toggleModalCart = useCallback(() => {
    setIsModalOpen(prev => !prev);
  }, []);

  const openCartWithItem = useCallback((item: LastAddedItem) => {
    setLastAddedItem(item);
    setIsModalOpen(true);
  }, []);

  const clearLastAddedItem = useCallback(() => {
    setLastAddedItem(null);
  }, []);

  const contextValue: ModalCartContextValue = {
    isModalOpen,
    lastAddedItem,
    openModalCart,
    closeModalCart,
    toggleModalCart,
    openCartWithItem,
    clearLastAddedItem,
  };

  return (
    <ModalCartContext.Provider value={contextValue}>
      {children}
    </ModalCartContext.Provider>
  );
};
