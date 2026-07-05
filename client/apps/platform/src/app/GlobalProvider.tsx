import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { ModalCartProvider } from "@/context/ModalCartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { ModalWishlistProvider } from "@/context/ModalWishlistContext";
import { CompareProvider } from "@/context/CompareContext";
import { ModalCompareProvider } from "@/context/ModalCompareContext";
import { ModalSearchProvider, ModalSearchUIProvider } from "@/context/ModalSearchContext";
import { ModalQuickviewProvider } from "@/context/ModalQuickviewContext";
import { TenantProvider } from "@/context/TenantContext";

const GlobalProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <AuthProvider>
      <TenantProvider>
        <CartProvider>
          <ModalCartProvider>
            <WishlistProvider>
              <ModalWishlistProvider>
                <CompareProvider>
                  <ModalCompareProvider>
                    <ModalSearchUIProvider>
                      <ModalSearchProvider>
                      <ModalQuickviewProvider>
                        {children}
                      </ModalQuickviewProvider>
                      </ModalSearchProvider>
                    </ModalSearchUIProvider>
                    </ModalCompareProvider>
                </CompareProvider>
              </ModalWishlistProvider>
            </WishlistProvider>
          </ModalCartProvider>
        </CartProvider>
      </TenantProvider>
    </AuthProvider>
  );
};

export default GlobalProvider;
