'use client';
import Image, { type ImageProps } from 'next/image';
import { canOptimizeCloudinary, cloudinaryImageLoader } from '@/utils/cloudinaryImage';

/** Direct responsive CDN delivery for public Cloudinary raster uploads. */
export default function OptimizedImage({ src, alt, loader, ...props }: ImageProps) {
  const cdnLoader = typeof src === 'string' && canOptimizeCloudinary(src)
    ? cloudinaryImageLoader : undefined;
  return <Image {...props} src={src} alt={alt} loader={loader ?? cdnLoader} />;
}
