'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';

interface Props {
  props: string;
  slogan: string;
};
const TopNavOne: React.FC<Props> = ({ props, slogan }) => {
const [isOpenLanguage, setIsOpenLanguage] = useState(false);
  const [isOpenCurrence, setIsOpenCurrence] = useState(false);
  const [language, setLanguage] = useState('English');
  const [currence, setCurrence] = useState('USD');

  return (
<>
      <div className={`top-nav md:h-[44px] h-[30px] ${props}`}>
        <div className="container mx-auto h-full">
          <div className="top-nav-main flex justify-between max-md:justify-center h-full">
            <div className="left-content flex items-center gap-5 max-md:hidden">
              <div
                className="choose-type choose-language flex items-center gap-1.5"
                onClick={() => {
                  setIsOpenLanguage(!isOpenLanguage);
                  setIsOpenCurrence(false);
                }}
              >
                <div className="select relative">
                  <p className="selected caption2 text-gray-50">{language}</p>
                  <ul className={`list-option bg-gray-50 ${isOpenLanguage ? 'open' : ''}`}>
                    {['English', 'Espana', 'France'].map((item, index) => (
                      <li key={index} className="caption2" onClick={() => setLanguage(item)}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <Icon.PiCaretDown size={12} color="#fff" />
              </div>

              <div
                className="choose-type choose-currency flex items-center gap-1.5"
                onClick={() => {
                  setIsOpenCurrence(!isOpenCurrence);
                  setIsOpenLanguage(false);
                }}
              >
                <div className="select relative">
                  <p className="selected caption2 text-gray-50">{currence}</p>
                  <ul className={`list-option bg-gray-50 ${isOpenCurrence ? 'open' : ''}`}>
                    {['USD', 'EUR', 'GBP'].map((item, index) => (
                      <li key={index} className="caption2" onClick={() => setCurrence(item)}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <Icon.PiCaretDown size={12} color="#fff" />
              </div>
            </div>

            <div className="text-center text-button-uppercase text-gray-50 flex items-center">
              {slogan}
            </div>

            <div className="right-content flex items-center gap-5 max-md:hidden">
              <Link href={'https://www.facebook.com/'} target="_blank">
                <i className="icon-facebook text-gray-50"></i>
              </Link>
              <Link href={'https://www.instagram.com/'} target="_blank">
                <i className="icon-instagram text-gray-50"></i>
              </Link>
              <Link href={'https://www.youtube.com/'} target="_blank">
                <i className="icon-youtube text-gray-50"></i>
              </Link>
              <Link href={'https://twitter.com/'} target="_blank">
                <i className="icon-twitter text-gray-50"></i>
              </Link>
              <Link href={'https://pinterest.com/'} target="_blank">
                <i className="icon-pinterest text-gray-50"></i>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TopNavOne;
