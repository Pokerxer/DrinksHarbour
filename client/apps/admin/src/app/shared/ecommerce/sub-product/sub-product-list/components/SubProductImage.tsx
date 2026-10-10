// @ts-nocheck
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { resolveSubProductImages } from '../../image-utils';
import { subProductListImage } from '../../list-image';

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
  const [original, setOriginal] = useState(false);
  const src = candidates[idx];

  if (!src) return <>{fallback}</>;

  return (
    <img
      src={original ? src : subProductListImage(src, 320)}
      srcSet={!original && subProductListImage(src, 320) !== src ? `${subProductListImage(src, 320)} 320w, ${subProductListImage(src, 640)} 640w` : undefined}
      sizes="(max-width: 640px) 50vw, 320px"
      loading="lazy"
      decoding="async"
      alt={alt || 'Product'}
      className={className}
      onError={() => {
        if (!original && subProductListImage(src, 320) !== src) setOriginal(true);
        else { setIdx(i => i + 1); setOriginal(false); }
      }}
    />
  );
}
