'use client';
import { useState } from 'react';
import Image from 'next/image';
import { PiWine } from 'react-icons/pi';
export default function WarehouseProductImage({
  src,
  name,
}: {
  src?: string | null;
  name: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-2">
      {src && failed !== src ? (
        <Image
          src={src}
          alt={name}
          width={80}
          height={96}
          unoptimized
          className="h-full w-full object-contain"
          onError={() => setFailed(src)}
        />
      ) : (
        <PiWine aria-hidden className="h-9 w-9 text-gray-300" />
      )}
    </span>
  );
}
