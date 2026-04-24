"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Icon from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";

interface Tenant {
  id: string;
  name: string;
  subdomain?: string;
}

interface UserDropdownProps {
  isOpen: boolean;
  isLoggedIn: boolean;
  tenant?: Tenant;
  onLogout: () => void;
  onClose: () => void;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({
  isOpen,
  isLoggedIn,
  tenant,
  onLogout,
  onClose,
}) => {
  const router = useRouter();

  const userMenuItems = [
    { icon: Icon.PiUser, label: "My Account", href: "/my-account" },
    { icon: Icon.PiShoppingCart, label: "Orders", href: "/my-account/orders" },
    { icon: Icon.PiHeart, label: "Wishlist", href: "/wishlist" },
    { icon: Icon.PiClock, label: "Order Tracking", href: "/order-tracking" },
  ];

  const handleLogout = () => {
    onLogout();
    router.push("/login");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
        >
          {isLoggedIn ? (
            <>
              <div className="p-4 bg-gradient-to-r from-green-50 to-white border-b border-gray-100">
                <p className="font-semibold text-gray-900">Welcome back!</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Manage your account
                </p>
              </div>
              <div className="p-2">
                {userMenuItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                      <item.icon size={18} />
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
              <div className="p-2 border-t border-gray-100">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                    <Icon.PiSignOut size={18} />
                  </div>
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-5">
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mx-auto mb-3">
                  <Icon.PiUser size={28} className="text-green-600" />
                </div>
                <p className="text-gray-600 text-sm mb-5">
                  Sign in to access your account, orders, and wishlist
                </p>
              </div>
              <Link
                href="/login"
                onClick={onClose}
                className="block w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white text-center rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-200"
              >
                Sign In
              </Link>
              <p className="text-center text-sm text-gray-500 mt-4">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  onClick={onClose}
                  className="text-green-600 font-semibold hover:underline"
                >
                  Create one
                </Link>
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};