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
import { FirstOrderPerkProvider } from "@/context/FirstOrderPerkContext";

const GlobalProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <AuthProvider>
      <TenantProvider>
        {/* Reads auth state, so it must sit inside AuthProvider. */}
        <FirstOrderPerkProvider>
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
        </FirstOrderPerkProvider>
      </TenantProvider>
    </AuthProvider>
  );
};

export default GlobalProvider;
