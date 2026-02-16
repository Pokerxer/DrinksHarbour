'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { usePathname } from 'next/navigation';
import Product from '@/components/Product/Card';
import useLoginPopup from '@/store/useLoginPopup';
import useMenuMobile from '@/store/useMenuMobile';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import { useModalSearchContext } from '@/context/ModalSearchContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useRouter } from 'next/navigation';

const MenuTwo = () => {;
const pathname = usePathname();
  const router = useRouter();
  const { openLoginPopup, handleLoginPopup } = useLoginPopup();
  const { openMenuMobile, handleMenuMobile } = useMenuMobile();
  const [openSubNavMobile, setOpenSubNavMobile] = useState<number | null>(null);
  const { openModalCart } = useModalCartContext();
  const { cartState } = useCart();
  const { openModalWishlist } = useModalWishlistContext();
  const { openModalSearch } = useModalSearchContext();

  const handleOpenSubNavMobile = (index: number) => {
    setOpenSubNavMobile(openSubNavMobile === index ? null : index);
  };

  const [fixedHeader, setFixedHeader] = useState(false);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);

  useEffect(() => {
const handleScroll = () => {;
const scrollPosition = window.scrollY;
      setFixedHeader(scrollPosition > 0 && scrollPosition < lastScrollPosition);
      setLastScrollPosition(scrollPosition);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollPosition]);

  const handleGenderClick = (gender: string) => {
    router.push(`/shop/breadcrumb1?gender=${gender}`);
  };

  const handleCategoryClick = (category: string) => {
    router.push(`/shop/breadcrumb1?category=${category}`);
  };

  const handleTypeClick = (type: string) => {
    router.push(`/shop/breadcrumb1?type=${type}`);
  };

  return (
<>
      <div
        className={`header-menu style-one ${
          fixedHeader ? ' fixed' : 'relative'
        } bg-gray-50 w-full md:h-[74px] h-[56px]`}
      >
        <div className="container mx-auto h-full">
          <div className="header-main flex justify-between h-full">
            <div className="menu-mobile-icon lg:hidden flex items-center" onClick={handleMenuMobile}>
              <i className="icon-category text-2xl"></i>
            </div>

            <Link href={'/'} className="flex items-center">
              <div className="heading4">Anvogue</div>
            </Link>

            <div className="right flex gap-12">
              <div className="max-md:hidden search-icon flex items-center cursor-pointer relative">
                <Icon.PiMagnifyingGlass size={24} color="black" onClick={openModalSearch} />
                <div className="line absolute bg-line w-px h-6 -right-6"></div>
              </div>

              <div className="list-action flex items-center gap-4">
                <div className="user-icon flex items-center justify-center cursor-pointer">
                  <Icon.PiUser size={24} color="black" onClick={handleLoginPopup} />
                  <div
                    className={`login-popup absolute top-[74px] w-[320px] p-7 rounded-xl bg-gray-50 box-shadow-sm ${
                      openLoginPopup ? 'open' : ''
                    }`}
                  >
                    <Link href={'/login'} className="button-main w-full text-center">
                      Login
                    </Link>
                    <div className="text-secondary text-center mt-3 pb-4">
                      Don't have an account?
                      <Link href={'/register'} className="text-gray-900 pl-1 hover:underline">
                        Register
                      </Link>
                    </div>
                    <Link
                      href={'/my-account'}
                      className="button-main bg-gray-50 text-gray-900 border border-black w-full text-center"
                    >
                      Dashboard
                    </Link>
                    <div className="bottom mt-4 pt-4 border-t border-line"></div>
                    <Link href={'#!'} className="body1 hover:underline">
                      Support
                    </Link>
                  </div>
                </div>

                <div
                  className="max-md:hidden wishlist-icon flex items-center cursor-pointer"
                  onClick={openModalWishlist}
                >
                  <Icon.PiHeart size={24} color="black" />
                </div>

                <div
                  className="cart-icon flex items-center relative cursor-pointer"
                  onClick={openModalCart}
                >
                  <Icon.PiHandbag size={24} color="black" />
                  <span className="quantity cart-quantity absolute -right-1.5 -top-1.5 text-xs text-gray-50 bg-black-900 w-4 h-4 flex items-center justify-center rounded-full">
                    {cartState.cartArray.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="menu-mobile" className={`${openMenuMobile ? 'open' : ''}`}>
        <div className="menu-container bg-gray-50 h-full">
          <div className="container h-full">
            <div className="menu-main h-full overflow-hidden">
              <div className="heading py-2 relative flex items-center justify-center">
                <div
                  className="close-menu-mobile-btn absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface flex items-center justify-center"
                  onClick={handleMenuMobile}
                >
                  <Icon.PiX size={14} />
                </div>
                <Link href={'/'} className="logo text-3xl font-semibold text-center">
                  Anvogue
                </Link>
              </div>

              <div className="form-search relative mt-2">
                <Icon.PiMagnifyingGlass
                  size={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer"
                />
                <input
                  type="text"
                  placeholder="What are you looking for?"
                  className=" h-12 rounded-lg border border-line text-sm w-full pl-10 pr-4"
                />
              </div>

              <div className="list-nav mt-6">
                <ul>
                  <li
                    className={`${openSubNavMobile === 1 ? 'open' : ''}`}
                    onClick={() => handleOpenSubNavMobile(1)}
                  >
                    <a href={'#!'} className={`text-xl font-semibold flex items-center justify-between`}>
                      Demo
                      <span className="text-right">
                        <Icon.PiCaretRight size={20} />
                      </span>
                    </a>
                    <div className="sub-nav-mobile">
                      <div
                        className="back-btn flex items-center gap-3"
                        onClick={() => handleOpenSubNavMobile(1)}
                      >
                        <Icon.PiCaretLeft /> Back
                      </div>
                    </div>
                  </li>
                  <li
                    className={`${openSubNavMobile === 2 ? 'open' : ''}`}
                    onClick={() => handleOpenSubNavMobile(2)}
                  >
                    <a href={'#!'} className={`text-xl font-semibold flex items-center justify-between`}>
                      Demo
                      <span className="text-right">
                        <Icon.PiCaretRight size={20} />
                      </span>
                    </a>
                    <div className="sub-nav-mobile">
                      <div
                        className="back-btn flex items-center gap-3"
                        onClick={() => handleOpenSubNavMobile(2)}
                      >
                        <Icon.PiCaretLeft /> Back
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MenuTwo;
