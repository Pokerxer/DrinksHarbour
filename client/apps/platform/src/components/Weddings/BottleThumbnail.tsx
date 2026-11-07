'use client';

import { useState } from 'react';
import { PiWineBold } from 'react-icons/pi';
import OptimizedImage from '@/components/UI/OptimizedImage';

export default function BottleThumbnail({ src }: { src?: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  return <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-100 bg-white" aria-hidden="true">
    {src && src !== failedSource ? <OptimizedImage src={src} alt="" width={48} height={48} sizes="48px" className="h-12 w-12 object-contain p-1" onError={() => setFailedSource(src)} /> : <span data-thumbnail-fallback className="grid h-full w-full place-items-center bg-rose-50 text-[#7c1d1d]"><PiWineBold className="h-5 w-5" /></span>}
  </span>;
}
