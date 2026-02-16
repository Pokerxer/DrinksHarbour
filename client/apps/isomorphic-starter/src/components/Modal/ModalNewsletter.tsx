'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import * as Icon from 'react-icons/pi';
import productData from '@/data/Product.json';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import Image from 'next/image';

const ModalNewsletter = () => {;
const [open, setOpen] = useState<boolean>(false);
  const router = useRouter();
  const { openQuickview } = useModalQuickviewContext();

  const handleDetailProduct = (productId: string) => {
    // redirect to shop with category selected
    router.push(`/product/default?id=${productId}`);
  };

  useEffect(() => {
    setTimeout(() => {
      setOpen(true);
    }, 3000);
  }, []);

  return (
<div className="modal-newsletter" onClick={() => setOpen(false)}>
      <div className="container h-full flex items-center justify-center w-full">
        <div
          className={`modal-newsletter-main ${open ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="main-content flex rounded-[20px] overflow-hidden w-full">
            <div className="left lg:w-1/2 sm:w-2/5 max-sm:hidden bg-green-400 flex flex-col items-center justify-center gap-5 py-14">
              <div className="text-xs font-semibold uppercase text-center">Special Offer</div>
              <div className="lg:text-[70px] text-4xl lg:leading-[78px] leading-[42px] font-bold uppercase text-center">
                Black
                <br />
                Fridays
              </div>
              <div className="text-button-uppercase text-center">
                New customers save <span className="text-red-500">30%</span> with the code
              </div>
              <div className="text-button-uppercase text-red-500 bg-gray-50 py-2 px-4 rounded-lg">
                GET20off
              </div>
              <div className="button-main w-fit bg-black-900 text-gray-50 hover:bg-gray-50 uppercase">
                Copy coupon code
              </div>
            </div>

            <div className="right lg:w-1/2 sm:w-3/5 w-full bg-gray-50 sm:pt-10 sm:pl-10 max-sm:p-6 relative">
              <div
                className="close-newsletter-btn w-10 h-10 flex items-center justify-center border border-line rounded-full absolute right-5 top-5 cursor-pointer"
                onClick={() => setOpen(false)}
              >
                <Icon.PiXBold className="text-xl" />
              </div>

              <div className="heading5 pb-5">You May Also Like</div>
              <div className="list flex flex-col gap-5 overflow-x-auto sm:pr-6">
                {/* Product list can be added here */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalNewsletter;
