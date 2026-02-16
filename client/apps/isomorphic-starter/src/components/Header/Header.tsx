'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { AnnouncementBanner } from '@/components/Banner';
import { useModalSearchContext } from '@/context/ModalSearchContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

interface HeaderProps {
  variant?: 'default' | 'transparent' | 'dark';
  showAnnouncement?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  variant = 'default',
  showAnnouncement = true
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { openModalSearch } = useModalSearchContext();
  const { openModalCart } = useModalCartContext();
  const { cartCount } = useCart();
  const { wishlistState } = useWishlist();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setIsLoggedIn(false);
    setUserDropdownOpen(false);
    router.push('/login');
  };

  const getHeaderBg = () => {
    if (variant === 'transparent') {
      return isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent';
    }
    if (variant === 'dark') {
      return 'bg-[#1A1A2E]';
    }
    return 'bg-white';
  };

  const getTextColor = () => {
    if (variant === 'dark' || variant === 'transparent') {
      return 'text-white';
    }
    return 'text-gray-900';
  };

  const userMenuItems = [
    { icon: Icon.PiUser, label: 'My Account', href: '/my-account' },
    { icon: Icon.PiShoppingCart, label: 'Orders', href: '/my-account/orders' },
    { icon: Icon.PiHeart, label: 'Wishlist', href: '/wishlist' },
    { icon: Icon.PiClock, label: 'Order Tracking', href: '/order-tracking' },
  ];

  const navLinks = [
    { name: 'Shop', href: '/shop' },
    { name: 'New Arrivals', href: '/shop?tag=new-arrival' },
    { name: 'Sale', href: '/shop?sale=true' },
    { name: 'VIP Club', href: '/vip-signup' },
  ];

  return (
    <>
      <header className={`header relative z-50 transition-all duration-300 ${getHeaderBg()} ${isScrolled ? 'shadow-sm' : ''}`}>
        {/* Top Bar */}
        <div className={`top-bar py-2.5 border-b border-gray-100/50 ${variant === 'dark' ? 'bg-[#0D0D1A]' : 'bg-gray-50/80'}`}>
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              {/* Promo Text */}
              <div className="hidden md:block flex-1">
                <p className={`text-sm font-medium ${variant === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                  <Icon.PiTruck size={16} className="inline mr-1.5" />
                  Free delivery on orders over ₦50,000
                </p>
              </div>

              {/* Right Side */}
              <div className="flex items-center gap-5 ml-auto">
                {/* Quick Links */}
                <div className="hidden lg:flex items-center gap-5">
                  {[
                    { name: 'Help', href: '/pages/faqs' },
                    { name: 'Track Order', href: '/order-tracking' },
                  ].map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      className={`text-sm font-medium hover:text-green-600 transition-colors ${variant === 'dark' ? 'text-white/70 hover:text-white' : 'text-gray-600'}`}
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>

                {/* Divider */}
                <div className={`hidden lg:block w-px h-5 ${variant === 'dark' ? 'bg-white/20' : 'bg-gray-200'}`} />

                {/* Social Icons */}
                <div className="flex items-center gap-2">
                  {[
                    { name: 'FB', url: 'https://facebook.com', color: '#1877F2' },
                    { name: 'IG', url: 'https://instagram.com', color: '#E4405F' },
                    { name: 'TW', url: 'https://twitter.com', color: '#1DA1F2' }
                  ].map((social) => (
                    <a
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${variant === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
                      style={{ color: variant === 'dark' ? 'white' : '#374151' }}
                    >
                      {social.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className={`main-header transition-all duration-300 ${isScrolled ? 'py-3' : 'py-4'}`}>
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between gap-6">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={`lg:hidden p-2.5 rounded-lg hover:bg-gray-100 transition-colors ${getTextColor()}`}
              >
                <Icon.PiList size={24} />
              </button>

              {/* Logo */}
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
                  <Icon.PiWineFill className="text-white text-xl" />
                </div>
                <span className={`text-xl md:text-2xl font-bold tracking-tight ${getTextColor()}`}>
                  DrinksHarbour
                </span>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-100 ${getTextColor()}`}
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>

              {/* Search Bar */}
              <div className="hidden md:block flex-1 max-w-md">
                <button
                  onClick={openModalSearch}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200 hover:border-green-500 hover:shadow-md ${
                    variant === 'dark'
                      ? 'bg-white/10 border-white/20 hover:bg-white/15'
                      : 'bg-gray-50 border-gray-200 hover:bg-white'
                  }`}
                >
                  <Icon.PiMagnifyingGlass size={18} className={variant === 'dark' ? 'text-white/50' : 'text-gray-400'} />
                  <span className={`flex-1 text-left text-sm ${variant === 'dark' ? 'text-white/70 placeholder-white/50' : 'text-gray-500 placeholder-gray-400'}`}>
                    Search products...
                  </span>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    variant === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-500'
                  }`}>
                    /
                  </div>
                </button>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                {/* Mobile Search */}
                <button
                  onClick={openModalSearch}
                  className={`md:hidden p-2.5 rounded-lg hover:bg-gray-100 transition-colors ${getTextColor()}`}
                >
                  <Icon.PiMagnifyingGlass size={22} />
                </button>

                {/* Wishlist */}
                <Link
                  href="/wishlist"
                  className={`relative p-2.5 rounded-xl transition-all hover:bg-gray-100 ${getTextColor()}`}
                >
                  <Icon.PiHeart size={22} />
                  {wishlistState.wishlistArray.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                      {wishlistState.wishlistArray.length}
                    </span>
                  )}
                </Link>

                {/* Cart */}
                <button
                  onClick={openModalCart}
                  className={`relative p-2.5 rounded-xl transition-all hover:bg-gray-100 ${getTextColor()}`}
                >
                  <Icon.PiShoppingCart size={22} />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                      {cartCount}
                    </span>
                  )}
                </button>

                {/* User Dropdown */}
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className={`p-2.5 rounded-xl transition-all hover:bg-gray-100 ${getTextColor()}`}
                  >
                    <Icon.PiUser size={22} />
                  </button>

                  <AnimatePresence>
                    {userDropdownOpen && (
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
                              <p className="text-sm text-gray-500 mt-0.5">Manage your account</p>
                            </div>
                            <div className="p-2">
                              {userMenuItems.map((item) => (
                                <Link
                                  key={item.label}
                                  href={item.href}
                                  onClick={() => setUserDropdownOpen(false)}
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
                              onClick={() => setUserDropdownOpen(false)}
                              className="block w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white text-center rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-200"
                            >
                              Sign In
                            </Link>
                            <p className="text-center text-sm text-gray-500 mt-4">
                              Don't have an account?{' '}
                              <Link
                                href="/register"
                                onClick={() => setUserDropdownOpen(false)}
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Announcement Banner */}
      {showAnnouncement && (
        <div className="border-b border-gray-100">
          <AnnouncementBanner placement="header" layout="static" variant="promo" />
        </div>
      )}

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
                    <Icon.PiWineFill className="text-white" />
                  </div>
                  <span className="text-lg font-bold text-gray-900">DrinksHarbour</span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <Icon.PiX size={20} />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-gray-100">
                <button
                  onClick={openModalSearch}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-green-500 transition-colors"
                >
                  <Icon.PiMagnifyingGlass size={20} className="text-gray-400" />
                  <span className="text-gray-500">Search products...</span>
                </button>
              </div>

              {/* Navigation */}
              <nav className="p-4">
                <div className="space-y-1">
                  {[
                    { name: 'Home', href: '/', icon: Icon.PiHouse },
                    { name: 'Shop', href: '/shop', icon: Icon.PiShoppingCart },
                    { name: 'New Arrivals', href: '/shop?tag=new-arrival', icon: Icon.PiSparkle },
                    { name: 'Sale', href: '/shop?sale=true', icon: Icon.PiTag },
                    { name: 'VIP Club', href: '/vip-signup', icon: Icon.PiStar },
                    { name: 'Help Center', href: '/pages/faqs', icon: Icon.PiQuestion },
                    { name: 'Track Order', href: '/order-tracking', icon: Icon.PiTruck },
                    { name: 'Contact Us', href: '/pages/contact', icon: Icon.PiEnvelope },
                  ].map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                    >
                      <link.icon size={20} />
                      <span className="font-medium">{link.name}</span>
                    </Link>
                  ))}
                </div>
              </nav>

              {/* User Actions */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/wishlist"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Icon.PiHeart size={18} />
                    Wishlist
                  </Link>
                  <Link
                    href="/cart"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                  >
                    <Icon.PiShoppingCart size={18} />
                    Cart
                  </Link>
                </div>
                {!isLoggedIn && (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full mt-3 px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-200"
                  >
                    <Icon.PiSignIn size={18} />
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
