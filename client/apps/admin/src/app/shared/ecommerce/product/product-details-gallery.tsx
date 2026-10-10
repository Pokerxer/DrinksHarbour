'use client';

import Image from 'next/image';
import { PiImageLight, PiStarFill } from 'react-icons/pi';
import {
  getPrimaryImageIndex,
  type ProductGalleryImage,
} from './primary-image';

const productGallery: ProductGalleryImage[] = [
  'https://isomorphic-furyroad.s3.amazonaws.com/public/products/details/1.jpg',
  'https://isomorphic-furyroad.s3.amazonaws.com/public/products/details/2.jpg',
  'https://isomorphic-furyroad.s3.amazonaws.com/public/products/details/3.jpg',
  'https://isomorphic-furyroad.s3.amazonaws.com/public/products/details/4.jpg',
].map((url) => ({ url }));

export default function ProductDetailsGallery({
  images,
  productName = 'Product',
  onMakePrimary,
  isSavingPrimary = false,
}: {
  images?: ProductGalleryImage[] | null;
  productName?: string;
  onMakePrimary?: (index: number) => void;
  isSavingPrimary?: boolean;
}) {
  const source = images === undefined ? productGallery : (images ?? []);
  const primaryIndex = getPrimaryImageIndex(source);
  const list = source
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => image?.url);

  return (
    <div
      className="grid grid-cols-2 gap-3 @sm:gap-4 @2xl:gap-5 @4xl:gap-7"
      aria-busy={isSavingPrimary}
    >
      {list.length === 0 ? (
        <div className="col-span-2 flex aspect-[4/2.4] w-full items-center justify-center rounded bg-gray-100 @sm:rounded-md">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <PiImageLight className="h-10 w-10" />
            <span className="text-xs font-medium">No images yet</span>
          </div>
        </div>
      ) : (
        list.map(({ image, index }) => (
          <div
            key={`product-gallery-${image.url}-${index}`}
            className="overflow-hidden rounded border border-gray-200 bg-gray-100 @sm:rounded-md"
          >
            <div className="relative aspect-[4/4.65] w-full">
              <Image
                fill
                priority={index === primaryIndex}
                src={image.url}
                alt={image.alt || `${productName} - Image ${index + 1}`}
                sizes="(max-width: 767px) 46vw, (max-width: 1279px) 30vw, 28vw"
                className="h-full w-full object-cover"
              />
              {index === primaryIndex && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm">
                  <PiStarFill
                    className="h-3.5 w-3.5 text-amber-500"
                    aria-hidden="true"
                  />
                  Primary image
                </span>
              )}
            </div>
            {onMakePrimary && index !== primaryIndex && (
              <button
                type="button"
                aria-label={`Make image ${index + 1} primary`}
                disabled={isSavingPrimary}
                onClick={() => onMakePrimary(index)}
                className="w-full bg-white px-3 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50"
              >
                {isSavingPrimary ? 'Saving…' : 'Make primary'}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
