"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import * as Icon from "react-icons/pi";
import { useModalSearchContext } from "@/context/ModalSearchContext";
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
  tenant?: Tenant;
  mobile?: boolean;
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({
  variant,
  getTextColor,
  tenant,
  mobile = false,
}) => {
  const { openModalSearch } = useModalSearchContext();
  const { openModalCart } = useModalCartContext();
  const { cartCount } = useCart();
  const { wishlistState } = useWishlist();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
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

  const buttonClass = mobile
    ? `relative p-2 rounded-lg transition-all hover:bg-gray-100 ${getTextColor()}`
    : `relative p-2.5 rounded-xl transition-all hover:bg-gray-100 ${getTextColor()}`;

  return (
    <div className="hidden lg:flex items-center gap-1">
      <button
        onClick={openModalSearch}
        className={buttonClass}
      >
        <Icon.PiMagnifyingGlass size={22} />
      </button>

      <button onClick={openModalCart} className={buttonClass}>
        <Icon.PiShoppingCart size={22} />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </button>

      <Link href="/wishlist" className={buttonClass}>
        <Icon.PiHeart size={22} />
        {wishlistState.wishlistArray.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
            {wishlistState.wishlistArray.length}
          </span>
        )}
      </Link>

      <div className="relative" ref={userDropdownRef}>
        <button
          onClick={() => setUserDropdownOpen(!userDropdownOpen)}
          className={buttonClass}
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
    </div>
  );
};