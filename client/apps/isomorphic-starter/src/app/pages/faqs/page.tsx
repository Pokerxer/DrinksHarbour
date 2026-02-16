'use client';

import React, { useState } from 'react';
import Breadcrumb from '@/components/Breadcrumb/Breadcrumb';
import * as Icon from "react-icons/pi";

const Faqs = () => {;
const [activeTab, setActiveTab] = useState<string | undefined>('how to buy');
  const [activeQuestion, setActiveQuestion] = useState<string | undefined>('');

  const handleActiveTab = (tab: string) => {
    setActiveTab(tab);
  };

  const handleActiveQuestion = (question: string) => {
    setActiveQuestion(prevQuestion => prevQuestion === question ? undefined : question);
  };

  return (
<>
      <div className='relative w-full'>
        <Breadcrumb heading='FAQs' subHeading='FAQs' />
      </div>
      <div className='faqs-block md:py-20 py-10'>
        <div className="container">
          <div className="flex justify-between">
            <div className="left w-1/4">
              <div className="menu-tab flex flex-col gap-5">
                {[
                  'how to buy',
                  'payment methods',
                  'delivery',
                  'exchanges & returns',
                  'registration',
                  'look after your garments',
                  'contacts'
                ].map((item, index) => (
                  <div
                    key={index}
                    className={`tab-item inline-block w-fit heading6 has-line-before text-secondary2 hover:text-gray-900 duration-300 ${activeTab === item ? 'active' : ''}`}
                    onClick={() => handleActiveTab(item)}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="right w-2/3">
              <p className="text-secondary">FAQ content goes here...</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Faqs;
