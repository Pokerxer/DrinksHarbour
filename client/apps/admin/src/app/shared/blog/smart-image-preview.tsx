'use client';

// Smart image preview for the admin editor — handles broken URLs gracefully
// with a fallback state, and shows the image aspect-aware (no forced crop)
// so editors can judge how it will look in the article.

import { useEffect, useState } from 'react';
import { PiImageBrokenBold, PiImageBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface Props {
  src: string;
  alt: string;
  /** Tailwind aspect ratio class, e.g. 'aspect-[3/2]' or 'aspect-[16/9]'. */
  aspectClassName?: string;
  /** Force object-cover (crop) vs object-contain (show full image). */
  fit?: 'cover' | 'contain';
  className?: string;
  /** Empty-state label when there's no src. */
  emptyLabel?: string;
  showEmptyIcon?: boolean;
}

export default function SmartImagePreview({
  src,
  alt,
  aspectClassName = 'aspect-[16/9]',
  fit = 'contain',
  className,
  emptyLabel = 'No image yet',
  showEmptyIcon = true,
}: Props) {
  const [status, setStatus] = useState<'empty' | 'loading' | 'ok' | 'error'>(
    src ? 'loading' : 'empty',
  );

  useEffect(() => {
    if (!src) {
      setStatus('empty');
      return;
    }
    setStatus('loading');
    const img = new Image();
    img.onload = () => setStatus('ok');
    img.onerror = () => setStatus('error');
    img.src = src;
  }, [src]);

  if (status === 'empty' || !src) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400',
          aspectClassName,
          className,
        )}
      >
        {showEmptyIcon ? <PiImageBold className="h-6 w-6" /> : null}
        <span className="text-[11px]">{emptyLabel}</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50/50 text-red-400',
          aspectClassName,
          className,
        )}
      >
        <PiImageBrokenBold className="h-6 w-6" />
        <span className="text-[11px] font-medium">Image failed to load</span>
        <span className="max-w-[80%] truncate text-[10px] text-red-300">
          {src}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50',
        aspectClassName,
        className,
      )}
    >
      {status === 'loading' ? (
        <div className="absolute inset-0 animate-pulse bg-gray-100" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn(
          'h-full w-full transition-opacity duration-300',
          fit === 'cover' ? 'object-cover' : 'object-contain',
          status === 'loading' ? 'opacity-0' : 'opacity-100',
        )}
      />
    </div>
  );
}