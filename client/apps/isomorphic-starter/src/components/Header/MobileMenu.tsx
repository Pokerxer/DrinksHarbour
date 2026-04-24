"use client";

import React from "react";
import Link from "next/link";
import * as Icon from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";

interface Tenant {
  id: string;
  name: string;
  subdomain?: string;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: { name: string; href: string }[];
  isMainSite: boolean;
  tenant?: Tenant;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  navLinks,
  isMainSite,
  tenant,
}) => {
  const mobileNavLinks = [
    { name: "Home", href: "/", icon: Icon.PiHouse },
    ...navLinks.map((link) => ({
      name: link.name,
      href: link.href,
      icon: Icon.PiShoppingCart,
    })),
    { name: "Help Center", href: "/pages/faqs", icon: Icon.PiQuestion },
    { name: "Track Order", href: "/order-tracking", icon: Icon.PiTruck },
    { name: "Contact Us", href: "/pages/contact", icon: Icon.PiEnvelope },
  ];

  const displayName = isMainSite ? "DrinksHarbour" : tenant?.name || "DrinksHarbour";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 lg:hidden"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <Link href="/" onClick={onClose} className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
                  <Icon.PiWineFill className="text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900">
                  {displayName}
                </span>
              </Link>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Icon.PiX size={20} />
              </button>
            </div>

            <nav className="p-4">
              <div className="space-y-1">
                {mobileNavLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    <link.icon size={20} />
                    <span className="font-medium">{link.name}</span>
                  </Link>
                ))}
              </div>
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/wishlist"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  <Icon.PiHeart size={18} />
                  Wishlist
                </Link>
                <Link
                  href="/cart"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  <Icon.PiShoppingCart size={18} />
                  Cart
                </Link>
              </div>
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full mt-3 px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-200"
              >
                <Icon.PiSignIn size={18} />
                Sign In
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};