'use client';

import { useRef, useState } from 'react';
import { productService } from '@/services/product.service';
import {
  normalizePrimaryImages,
  type ProductGalleryImage,
} from './primary-image';

export function useProductPrimaryImage(
  productId: string | undefined,
  images: ProductGalleryImage[],
  token: string | undefined,
  onSaved: (images: ProductGalleryImage[]) => void
) {
  const saving = useRef(false);
  const [isSavingPrimary, setIsSavingPrimary] = useState(false);
  const [primaryError, setPrimaryError] = useState('');
  const [primarySuccess, setPrimarySuccess] = useState('');

  async function makePrimary(index: number) {
    if (!productId || !token || saving.current || !images[index]?.url) return;
    saving.current = true;
    setIsSavingPrimary(true);
    setPrimaryError('');
    setPrimarySuccess('');
    try {
      const selectedImages = normalizePrimaryImages(images, index);
      await productService.updateProduct(
        productId,
        { images: selectedImages },
        token
      );
      onSaved(selectedImages);
      setPrimarySuccess('Primary image updated');
    } catch (error) {
      setPrimaryError(
        error instanceof Error
          ? error.message
          : 'Unable to update primary image. Please try again.'
      );
    } finally {
      saving.current = false;
      setIsSavingPrimary(false);
    }
  }

  return { makePrimary, isSavingPrimary, primaryError, primarySuccess };
}
