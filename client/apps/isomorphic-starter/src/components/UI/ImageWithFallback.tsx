'use client';

import Image, { ImageProps } from 'next/image';
import React, { useState } from 'react';

interface ImageWithFallbackProps extends ImageProps {
  fallbackSrc?: string;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fallbackSrc = '/images/placeholder.jpg',
  alt,
  ...props
}) => {
  const [error, setError] = useState(false);

  const handleError = () => {
    setError(true);
  };

  return (
    <Image
      src={error ? fallbackSrc : src}
      alt={alt}
      onError={handleError}
      onLoad={() => setError(false)}
      {...props}
    />
  );
};

export default ImageWithFallback;

export const getImageUrl = (url: string | undefined | null): string => {
  if (!url) return '/images/placeholder.jpg';
  
  if (url.startsWith('http')) {
    return url;
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  return `${baseUrl}${url}`;
};