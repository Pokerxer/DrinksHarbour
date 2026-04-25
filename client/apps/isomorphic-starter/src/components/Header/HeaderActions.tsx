"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import * as Icon from "react-icons/pi";
import { useModalCartContext } from "@/context/ModalCartContext";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { UserDropdown } from "./UserDropdown";

interface Tenant {
  id: string;
  name: string;
  subdomain?: string;
}

interface HeaderActionsProps {
  variant: "default" | "transparent" | "dark";
  getTextColor: () => string;
  tenant?: Tenant | null;
  mobile?: boolean;
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({
  variant,
  getTextColor,
  tenant,
  mobile = false,
}) => {
  const { openModalCart } = useModalCartContext();
  const { cartCount } = useCart();
  const { wishlistState } = useWishlist();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const isDark = variant === "dark";

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setIsLoggedIn(false);
    setUserDropdownOpen(false);
  };

  const iconBtn = `relative p-2.5 rounded-xl transition-all duration-200 ${
    isDark
      ? "text-white/80 hover:text-white hover:bg-white/10"
      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
  }`;

  if (mobile) {
    return (
      <>
        <button onClick={openModalCart} className={iconBtn}>
          <Icon.PiShoppingCart size={22} />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className={iconBtn}
          >
            <Icon.PiUser size={22} />
          </button>
          <UserDropdown
            isOpen={userDropdownOpen}
            isLoggedIn={isLoggedIn}
            tenant={tenant}
            onLogout={handleLogout}
            onClose={() => setUserDropdownOpen(false)}
          />
        </div>
      </>
    );
  }

  return (
    <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
      {/* Wishlist */}
      <Link href="/wishlist" className={iconBtn}>
        <Icon.PiHeart size={22} />
        {wishlistState.wishlistArray.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {wishlistState.wishlistArray.length}
          </span>
        )}
      </Link>

      {/* Cart — accented */}
      <button
        onClick={openModalCart}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
          isDark
            ? "bg-white/10 text-white hover:bg-white/20"
            : "bg-red-500 text-white hover:bg-red-600 shadow-sm hover:shadow-md"
        }`}
      >
        <Icon.PiShoppingCart size={18} />
        <span>Cart</span>
        {cartCount > 0 && (
          <span className={`min-w-[20px] h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center ${
            isDark ? "bg-white text-red-600" : "bg-white/25 text-white"
          }`}>
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </button>

      {/* Account */}
      <div className="relative ml-1" ref={userDropdownRef}>
        <button
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 ${
            isDark
              ? "text-white/80 hover:text-white hover:bg-white/10"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            isLoggedIn ? "bg-red-100 text-red-600" : isDark ? "bg-white/15 text-white" : "bg-gray-200 text-gray-500"
          }`}>
            <Icon.PiUser size={15} />
          </div>
          <span className="text-sm font-medium hidden xl:block">
            {isLoggedIn ? "Account" : "Sign in"}
          </span>
        </button>

        <UserDropdown
          isOpen={userDropdownOpen}
          isLoggedIn={isLoggedIn}
          tenant={tenant}
          onLogout={handleLogout}
          onClose={() => setUserDropdownOpen(false)}
        />
      </div>
    </div>
  );
};
