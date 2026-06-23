'use client';

import React from 'react';
import { AnnouncementBanner } from '@/components/Banner';

interface PageLayoutProps {
  children: React.ReactNode;
  showAnnouncement?: boolean;
  announcementVariant?: 'info' | 'success' | 'warning' | 'error' | 'promo';
  announcementLayout?: 'marquee' | 'static' | 'alert' | 'toast';
  announcementPlacement?: string;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  showAnnouncement = true,
  announcementVariant = 'promo',
  announcementLayout = 'static',
  announcementPlacement = 'header'
}) => {
  return (
    <>
      {showAnnouncement && (
        <AnnouncementBanner
          placement={announcementPlacement}
          layout={announcementLayout}
          variant={announcementVariant}
        />
      )}
      {children}
    </>
  );
};

export default PageLayout;
