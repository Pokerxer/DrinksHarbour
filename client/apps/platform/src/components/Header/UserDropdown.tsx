"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Icon from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { TenantData } from "@/context/TenantContext";

interface UserDropdownProps {
  isOpen: boolean;
  isLoggedIn: boolean;
  tenant?: TenantData | null;
  onLogout: () => void;
  onClose: () => void;
}

const MENU_ITEMS = [
  { icon: Icon.PiUser,         label: "My Account",     href: "/my-account"         },
  { icon: Icon.PiPackage,      label: "My Orders",      href: "/my-account/orders"  },
  { icon: Icon.PiHeart,        label: "Wishlist",       href: "/wishlist"            },
  { icon: Icon.PiTruck,        label: "Track Order",    href: "/order-tracking"     },
  { icon: Icon.PiMapPin,       label: "Addresses",      href: "/my-account/addresses" },
];

export const UserDropdown: React.FC<UserDropdownProps> = ({
  isOpen,
  isLoggedIn,
  onLogout,
  onClose,
}) => {
  const router = useRouter();

  const handleLogout = () => {
    onLogout();
    router.push("/login");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
        >
          {/* Brand stripe */}
          <div className="h-[3px] bg-gradient-to-r from-[#b20202] via-[#ff3232] to-[#b20202]" />

          {isLoggedIn ? (
            <>
              <div className="px-4 py-3.5 border-b border-gray-100 bg-[#b20202]/5">
                <p className="font-bold text-gray-900 text-sm">Welcome back!</p>
                <p className="text-xs text-gray-500 mt-0.5">Manage your account</p>
              </div>
              <div className="p-1.5">
                {MENU_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:bg-[#b20202]/6 hover:text-[#b20202] transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#b20202]/10 flex items-center justify-center flex-shrink-0 transition-colors">
                      <item.icon size={16} className="text-gray-500 group-hover:text-[#b20202] transition-colors" />
                    </div>
                    <span className="font-medium text-sm">{item.label}</span>
                  </Link>
                ))}
              </div>
              <div className="p-1.5 border-t border-gray-100">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Icon.PiSignOut size={16} />
                  </div>
                  <span className="font-medium text-sm">Sign Out</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-5">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-[#b20202]/10 flex items-center justify-center mx-auto mb-3">
                  <Icon.PiUser size={26} className="text-[#b20202]" />
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Sign in to access your account, orders, and wishlist
                </p>
              </div>
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-br from-[#b20202] to-[#8b0000] text-white text-sm font-bold rounded-xl hover:from-[#8b0000] hover:to-[#6b0000] transition-all shadow-sm"
              >
                <Icon.PiSignIn size={16} />
                Sign In
              </Link>
              <p className="text-center text-xs text-gray-500 mt-3.5">
                No account?{" "}
                <Link
                  href="/register"
                  onClick={onClose}
                  className="text-[#b20202] font-semibold hover:underline"
                >
                  Create one free
                </Link>
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
