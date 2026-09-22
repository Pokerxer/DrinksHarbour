// @ts-nocheck
'use client';

import Image from 'next/image';
import { PiImageLight } from 'react-icons/pi';

const productGallery = [
  'https://isomorphic-furyroad.s3.amazonaws.com/public/products/details/1.jpg',
  'https://isomorphic-furyroad.s3.amazonaws.com/public/products/details/2.jpg',
  'https://isomorphic-furyroad.s3.amazonaws.com/public/products/details/3.jpg',
  'https://isomorphic-furyroad.s3.amazonaws.com/public/products/details/4.jpg',
];

export default function ProductDetailsGallery({
  images,
  productName = 'Product',
}: {
  images?: Array<{ url?: string; alt?: string }> | null;
  productName?: string;
}) {
  // When no images prop is provided at all, fall back to the legacy demo
  // gallery (keeps the demo shop/product pages working unchanged).
  const list =
    images === undefined ? productGallery : images.filter((img) => img?.url);

  return (
    <div className="grid grid-cols-2 gap-3 @md:gap-4 @xl:gap-5 @2xl:gap-7">
      {list.length === 0 ? (
        <div className="col-span-2 flex aspect-[4/2.4] w-full items-center justify-center rounded bg-gray-100 @xl:rounded-md">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <PiImageLight className="h-10 w-10" />
            <span className="text-xs font-medium">No images yet</span>
          </div>
        </div>
      ) : (
        list.map((image, idx) => (
          <div
            key={`product-gallery-${image?.url || idx}`}
            className="relative mx-auto aspect-[4/4.65] w-full overflow-hidden rounded bg-gray-100 @xl:rounded-md"
          >
            <Image
              fill
              priority={idx === 0}
              src={image.url}
              alt={image.alt || `${productName} - Image ${idx + 1}`}
              sizes="(max-width: 768px) 100vw"
              className="h-full w-full object-cover"
            />
          </div>
        ))
      )}
    </div>
  );
}