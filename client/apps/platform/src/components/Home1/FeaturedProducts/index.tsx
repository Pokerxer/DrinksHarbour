"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PiCheckCircle, PiWarning } from "react-icons/pi";
import { useCart } from "@/context/CartContext";
import { useModalCartContext } from "@/context/ModalCartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useModalWishlistContext } from "@/context/ModalWishlistContext";
import type { ApiProduct, Product, ProductSize } from "./types";
import { filterFeatured, mapApiProductToProduct } from "./mapApiProduct";
import FeaturedProductCard from "./FeaturedProductCard";
import FeaturedProductsHeader, { FeaturedProductsCta } from "./FeaturedProductsHeader";
import FeaturedProductsSkeleton from "./FeaturedProductsSkeleton";

interface FeaturedProductsContainerProps {
  limit?: number;
  title?: string;
  subtitle?: string;
  initialProducts?: ApiProduct[];
}

const FeaturedProducts: React.FC<FeaturedProductsContainerProps> = ({
  limit = 8,
  title = "Featured Products",
  subtitle = "Handpicked selections from our premium collection",
  initialProducts,
}) => {
  const seeded = (initialProducts?.length ?? 0) > 0;
  const sectionRef = useRef<HTMLElement>(null);

  const { addToCart, removeFromCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();

  // Defense-in-depth: only honor products the API explicitly flagged isFeatured.
  const seed = initialProducts ? filterFeatured(initialProducts) : [];

  const [products, setProducts] = useState<Product[]>(seed.map(mapApiProductToProduct));
  const [loading, setLoading] = useState(!seeded);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [wishlistAdding, setWishlistAdding] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (seeded) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${API_URL}/api/products?isFeatured=true&limit=${limit}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        const raw: ApiProduct[] =
          (data?.success && data?.data?.products) ||
          (Array.isArray(data?.products) ? data.products : []) ||
          [];
        const featured = filterFeatured(raw);
        if (cancelled) return;
        setProducts(featured.map(mapApiProductToProduct));
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const buildCartItemId = (product: Product, size?: string) => {
    const tenantName = product.availableAt?.[0]?.tenant?.name || "default";
    const sizeKey = size || product.sizes?.[0]?.size || "default";
    return `${product._id}-${sizeKey}-${tenantName}-default`;
  };

  const isProductInCart = useCallback(
    (product: Product) =>
      cartState.cartArray.some((item) => item.cartItemId === buildCartItemId(product)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartState.cartArray],
  );

  const getCartQuantity = useCallback(
    (product: Product) => {
      const item = cartState.cartArray.find((i) => i.cartItemId === buildCartItemId(product));
      return item?.quantity || 0;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartState.cartArray],
  );

  const isProductInWishlist = useCallback(
    (product: Product) =>
      wishlistState.wishlistArray.some((item) => item.id === product._id || item._id === product._id),
    [wishlistState.wishlistArray],
  );

  const handleAddToCart = async (product: Product, selectedSize?: ProductSize) => {
    setAddingToCart(product._id);
    try {
      const availableAt = product.availableAt?.[0];
      const sizeData = selectedSize || product.sizes?.[0];
      const size = sizeData?.size || product.defaultSize || "Default";
      const tenantName = availableAt?.tenant?.name || "";
      const tenantId = availableAt?.tenant?._id || "";

      const existing = cartState.cartArray.find(
        (item) => item.cartItemId === buildCartItemId(product, size),
      );

      await addToCart(
        { ...product, id: product._id } as any,
        size,
        "",
        tenantName,
        tenantId,
        1,
        sizeData?._id || "",
        availableAt?._id || "",
      );

      showToast(
        existing ? `Quantity increased to ${(existing?.quantity || 0) + 1}!` : `${product.name} added!`,
        "success",
      );
      openModalCart();
    } catch {
      showToast("Failed to add to cart", "error");
    } finally {
      setTimeout(() => setAddingToCart(null), 300);
    }
  };

  const handleRemoveFromCart = (product: Product) => {
    try {
      const item = cartState.cartArray.find((i) => i.cartItemId.startsWith(product._id));
      if (item) {
        removeFromCart(item.cartItemId);
        showToast(`${product.name} removed from cart`, "success");
      }
    } catch {
      showToast("Failed to remove from cart", "error");
    }
  };

  const handleWishlistToggle = (product: Product) => {
    setWishlistAdding(product._id);
    try {
      if (isProductInWishlist(product)) {
        removeFromWishlist(product._id);
        showToast("Removed from wishlist", "success");
      } else {
        addToWishlist({ ...product, id: product._id } as any);
        showToast("Added to wishlist!", "success");
        setTimeout(() => openModalWishlist(), 300);
      }
    } catch {
      showToast("Failed to update wishlist", "error");
    } finally {
      setWishlistAdding(null);
    }
  };

  if (loading) return <FeaturedProductsSkeleton limit={limit} />;

  if (products.length === 0) return null;

  const tenantKeys = new Set<string>();
  products.forEach((p) =>
    (p.availableAt ?? []).forEach((e) => {
      const key = e?.tenant?._id || e?.tenant?.name;
      if (key) tenantKeys.add(String(key));
    })
  );
  const totalTenants = tenantKeys.size;
  const avgRating = products.reduce((sum, p) => sum + p.averageRating, 0) / products.length;

  return (
    <section ref={sectionRef} className="overflow-hidden bg-gradient-to-b from-white via-amber-50/20 to-white py-16 sm:py-24">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-5 py-3.5 text-white shadow-xl ${
              toast.type === "success" ? "bg-amber-500 text-gray-900" : "bg-red-500"
            }`}
          >
            {toast.type === "success" ? <PiCheckCircle size={20} /> : <PiWarning size={20} />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4">
        <FeaturedProductsHeader
          title={title}
          subtitle={subtitle}
          count={products.length}
          avgRating={avgRating}
          tenantsCount={totalTenants}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <FeaturedProductCard
              key={product._id}
              product={product}
              index={index}
              inCart={isProductInCart(product)}
              cartQty={getCartQuantity(product)}
              inWishlist={isProductInWishlist(product)}
              addingToCart={addingToCart === product._id}
              wishlistAdding={wishlistAdding === product._id}
              onAddToCart={(size) => handleAddToCart(product, size)}
              onRemoveFromCart={() => handleRemoveFromCart(product)}
              onWishlistToggle={() => handleWishlistToggle(product)}
            />
          ))}
        </div>

        <FeaturedProductsCta />
      </div>
    </section>
  );
};

export default FeaturedProducts;