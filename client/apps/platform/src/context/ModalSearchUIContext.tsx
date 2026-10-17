'use client';
import React, {createContext,useContext,useState,useCallback,useRef,useMemo,useEffect} from 'react';
import type {ReactNode} from 'react';
// ─── UI Context (modal open/close only — stable, rarely changes) ─────────────

interface ModalSearchUIValue {
  isModalOpen: boolean;
  openModalSearch: () => void;
  closeModalSearch: () => void;
  toggleModalSearch: () => void;
}

const ModalSearchUIContext = createContext<ModalSearchUIValue | undefined>(undefined);

export const useModalSearchUIContext = (): ModalSearchUIValue => {
  const ctx = useContext(ModalSearchUIContext);
  if (!ctx) throw new Error('useModalSearchUIContext must be used within ModalSearchUIProvider');
  return ctx;
};

export const ModalSearchUIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const originalOverflow = useRef<string>('');

  const openModalSearch = useCallback(() => {
    if (typeof document !== 'undefined') {
      originalOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    setIsModalOpen(true);
  }, []);

  const closeModalSearch = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = originalOverflow.current;
    }
    setIsModalOpen(false);
  }, []);

  const toggleModalSearch = useCallback(() => {
    setIsModalOpen((open) => {
      if (open) {
        if (typeof document !== 'undefined')
          document.body.style.overflow = originalOverflow.current;
        return false;
      } else {
        if (typeof document !== 'undefined') {
          originalOverflow.current = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
        }
        return true;
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined')
        document.body.style.overflow = originalOverflow.current;
    };
  }, []);

  const value = useMemo(
    () => ({ isModalOpen, openModalSearch, closeModalSearch, toggleModalSearch }),
    [isModalOpen, openModalSearch, closeModalSearch, toggleModalSearch],
  );

  return (
    <ModalSearchUIContext.Provider value={value}>
      {children}
    </ModalSearchUIContext.Provider>
  );
};
