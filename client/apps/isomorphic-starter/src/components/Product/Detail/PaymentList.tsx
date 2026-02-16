import Image from 'next/image';
import React from 'react';

interface PaymentListProps {
  className?: string;
};
const PaymentList: React.FC<PaymentListProps> = ({ className = '' }) => {
const paymentImages = [
    '/images/payment/Frame-0.png',
    '/images/payment/Frame-1.png',
    '/images/payment/Frame-2.png',
    '/images/payment/Frame-3.png',
    '/images/payment/Frame-4.png',
    '/images/payment/Frame-5.png',
  ];

  return (
<div className={`list-payment mt-7 ${className}`}>
      <div className="main-content lg:pt-8 pt-6 lg:pb-6 pb-4 sm:px-4 px-3 border border-line rounded-xl relative max-md:w-2/3 max-sm:w-full">
        <div className="heading6 px-5 bg-linear absolute -top-[14px] left-1/2 -translate-x-1/2 whitespace-nowrap uppercase tracking-widest text-[10px] font-bold text-slate-400">
          Guaranteed safe checkout
        </div>
        <div className="list grid grid-cols-6">
          {paymentImages.map((src, index) => (
            <div key={index} className="item flex items-center justify-center lg:px-3 px-1">
              <Image
                src={src}
                width={500}
                height={450}
                alt={`payment method ${index + 1}`}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaymentList;
