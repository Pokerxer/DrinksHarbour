'use client';

import React from 'react';
import Marquee from 'react-fast-marquee';
import AnnouncementBanner from './AnnouncementBanner';

interface TopBannerProps {
  textColor?: string;
  bgColor?: string;
  showMarquee?: boolean;
}

const TopBanner: React.FC<TopBannerProps> = ({
  textColor = 'text-gray-50',
  bgColor = 'bg-gray-900',
  showMarquee = true
}) => {
  const announcements = [
    'Get 10% off on selected items',
    'New customers save 10% with the code GET10',
    '10% off swim suits',
    'Free shipping on all orders over $50',
    '10% off on all summer essentials!',
    'Get summer-ready: 10% off swim suits',
    '10% off on all product'
  ];

  const divider = (
    <div className="line w-8 h-px bg-current opacity-30"></div>
  );

  return (
    <div className={`banner-top ${bgColor}`}>
      {showMarquee ? (
        <AnnouncementBanner
          placement="header"
          layout="marquee"
          variant="promo"
        />
      ) : (
        <Marquee>
          {announcements.map((text, index) => (
            <React.Fragment key={index}>
              <div className={`text-button-uppercase px-8 ${textColor}`}>
                {text}
              </div>
              {index < announcements.length - 1 && divider}
            </React.Fragment>
          ))}
        </Marquee>
      )}
    </div>
  );
};

export default TopBanner;
