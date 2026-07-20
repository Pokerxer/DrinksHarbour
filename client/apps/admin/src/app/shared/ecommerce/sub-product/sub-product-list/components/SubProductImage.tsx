// @ts-nocheck
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { resolveSubProductImages } from '../image-utils';

interface SubProductImageProps {
  /** The sub-product list item (carries imagesOverride + populated product). */
  sp: any;
  alt?: string;
  className?: string;
  /** Rendered when no candidate image loads (missing or all URLs broken). */
  fallback: ReactNode;
}

/**
 * Renders a sub-product's image, trying each resolved candidate in order
 * (override image → product image) and advancing to the next on load error.
 * Falls back to `fallback` when there are no more candidates, so a missing or
 * dead override URL cascades to the product image before the placeholder.
 */
export default function SubProductImage({
  sp,
  alt,
  className,
  fallback,
}: SubProductImageProps) {
  const candidates = useMemo(() => resolveSubProductImages(sp), [sp]);
  const [idx, setIdx] = useState(0);
  const src = candidates[idx];

  if (!src) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt={alt || 'Product'}
      className={className}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
