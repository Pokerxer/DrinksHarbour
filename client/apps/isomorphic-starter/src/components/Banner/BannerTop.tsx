'use client';

import React, { useState, useEffect } from 'react';
import Marquee from 'react-fast-marquee';

interface Props {
  props: string;
  textColor: string;
  bgLine: string;
}

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
}

const BannerTop: React.FC<Props> = ({ props, textColor, bgLine }) => {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/banners/placement/header?limit=10')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.length > 0) {
          const texts: string[] = [];
          data.data.forEach((b: BannerData) => {
            texts.push(b.title);
            if (b.subtitle) texts.push(b.subtitle);
          });
          setItems(texts);
        }
      })
      .catch(() => {});
  }, []);

  const displayItems = items.length > 0 ? items : [
    'Get 10% off on selected items',
    'New customers save 10% with the code GET10',
    'Free shipping on all orders over ₦50,000',
    '10% off on all seasonal essentials!',
  ];

  return (
    <div className={`banner-top ${props}`}>
      <Marquee>
        {displayItems.map((text, i) => (
          <React.Fragment key={i}>
            <div className={`text-button-uppercase px-8 ${textColor}`}>{text}</div>
            <div className={`line w-8 h-px ${bgLine}`} />
          </React.Fragment>
        ))}
      </Marquee>
    </div>
  );
};

export default BannerTop;
