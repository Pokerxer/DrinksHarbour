'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  textColor?: string;
  image: { url: string; alt?: string };
}

const Banner = () => {
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/banners/placement/home_secondary?limit=2')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.length > 0) {
          setBanners(data.data.slice(0, 2));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClick = async (id: string) => {
    try { await fetch(`/api/banners/${id}/click`, { method: 'POST' }); } catch {}
  };

  if (loading) {
    return (
      <div className="banner-block style-one grid sm:grid-cols-2 gap-5 md:pt-20 pt-10">
        {[0, 1].map(i => (
          <div key={i} className="relative overflow-hidden bg-gray-200 animate-pulse rounded" style={{ aspectRatio: '20/13' }} />
        ))}
      </div>
    );
  }

  if (banners.length === 0) return null;

  return (
    <div className="banner-block style-one grid sm:grid-cols-2 gap-5 md:pt-20 pt-10">
      {banners.map(banner => (
        <Link
          key={banner._id}
          href={banner.ctaLink || '/shop'}
          onClick={() => handleClick(banner._id)}
          className="banner-item relative block overflow-hidden duration-500"
        >
          <div className="banner-img relative" style={{ aspectRatio: '20/13' }}>
            <Image
              src={banner.image.url}
              fill
              alt={banner.image.alt || banner.title}
              priority
              className="object-cover duration-1000"
            />
          </div>
          <div className="banner-content absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
            <div className="heading2" style={{ color: banner.textColor || '#f9fafb' }}>
              {banner.title}
            </div>
            <div
              className="text-button relative inline-block pb-1 border-b-2 border-current duration-500 mt-2"
              style={{ color: banner.textColor || '#f9fafb' }}
            >
              {banner.ctaText || 'Shop Now'}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default Banner;
