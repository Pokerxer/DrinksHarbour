'use client';

// app/shared/warehouses/warehouse-detail/thumb.tsx
// Product thumbnail with a graceful package-icon placeholder.

import { PiPackageBold } from 'react-icons/pi';

export default function Thumb({
  src,
  alt,
  className = 'h-11 w-11',
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <PiPackageBold className="h-5 w-5 text-gray-300" />
      )}
    </div>
  );
}
