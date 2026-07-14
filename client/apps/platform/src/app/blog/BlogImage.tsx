'use client';

import { useState, useEffect } from 'react';
import Image, { type ImageProps } from 'next/image';
import * as Icon from 'react-icons/pi';

// A tiny grey shimmer SVG encoded as a data URL — used as the blur
// placeholder so there's never a white flash while a remote image loads.
// 24×16 px, ~220 bytes, renders instantly. Pre-encoded for client safety.
const SHIMMER_BLUR =
  'data:image/svg+xml;base64,' +
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDE2Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9InMiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIwIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNlNWU3ZWIiLz48c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iI2YzZjRmNiIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2U1ZTdlYiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIyNCIgaGVpZ2h0PSIxNiIgZmlsbD0idXJsKCNzKSIvPjwvc3ZnPg==';

type BlogImageProps = Omit<ImageProps, 'placeholder' | 'blurDataURL'> & {
  /** Aspect ratio class for the container when using `fill` (e.g. 'aspect-[16/9]'). */
  aspectClassName?: string;
  /** Show a fallback icon when the image fails to load. */
  showFallback?: boolean;
};

export default function BlogImage({
  aspectClassName,
  showFallback = true,
  className,
  alt,
  ...rest
}: BlogImageProps) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    // Reset error state if the src changes.
    setErrored(false);
  }, [rest.src]);

  if (errored && showFallback) {
    // With `fill`, the caller supplies a positioned+sized container, so the
    // fallback must stretch to fill it; otherwise fall back to aspectClassName.
    const sizing = rest.fill ? 'absolute inset-0' : (aspectClassName ?? '');
    const base = `flex items-center justify-center bg-gray-100 text-gray-400 ${sizing}`;
    return (
      <div className={`${base} ${className ?? ''}`} role="img" aria-label={alt as string}>
        <Icon.PiImageBrokenBold size={28} />
      </div>
    );
  }

  if (rest.fill) {
    // The wrapper must be an absolutely-positioned box that fills the caller's
    // container — a bare `relative` div has no height, which collapses the
    // filled <Image> to zero and makes it invisible.
    return (
      <div className={`absolute inset-0 ${aspectClassName ?? ''}`}>
        <Image
          {...rest}
          alt={alt}
          className={className}
          placeholder="blur"
          blurDataURL={SHIMMER_BLUR}
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  return (
    <Image
      {...rest}
      alt={alt}
      className={className}
      placeholder="blur"
      blurDataURL={SHIMMER_BLUR}
      onError={() => setErrored(true)}
    />
  );
}

export { SHIMMER_BLUR };