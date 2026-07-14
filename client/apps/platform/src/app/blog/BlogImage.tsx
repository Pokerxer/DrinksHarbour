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
    const base =
      'flex items-center justify-center bg-gray-100 text-gray-400 ' +
      (aspectClassName ?? '');
    return (
      <div className={`${base} ${className ?? ''}`} role="img" aria-label={alt as string}>
        <Icon.PiImageBrokenBold size={28} />
      </div>
    );
  }

  if (rest.fill) {
    return (
      <div className={`relative ${aspectClassName ?? ''}`}>
        <Image
          {...rest}
          alt={alt}
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