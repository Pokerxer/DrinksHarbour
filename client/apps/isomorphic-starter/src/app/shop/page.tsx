'use client';

import React, { useEffect, useState, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Shop from '@/components/Shop';
import LoadingSpinner from '@/components/loader/LoadingSpinner';
import * as Icon from 'react-icons/pi';
import RecommendedForYou from '@/components/Shop/RecommendedForYou';

export default function ShopPage(props: PageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-red-50 to-white">
        <div className="animate-spin w-12 h-12 border-4 border-red-100 border-t-red-700 rounded-full" />
      </div>
    }>
      <ShopPageContent {...props} />
    </Suspense>
  );
}
