'use client';

import { Controller, useFormContext } from 'react-hook-form';

type ImageChoice = { url: string; alt?: string };

export default function VariantImageField({ index, colorLabel, optionLabel }: { index: number; colorLabel: string; optionLabel?: string }) {
  const { control, watch } = useFormContext();
  const listingImages: ImageChoice[] = watch('subProductData.imagesOverride') || [];
  const id = `variant-image-${index}`;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        Variant image
      </label>
      <Controller
        name={`subProductData.sizes.${index}.image`}
        control={control}
        render={({ field }) => {
          const current: ImageChoice | undefined = field.value ?? undefined;
          const images = [...new Map([...listingImages, ...(current ? [current] : [])]
            .filter(image => image?.url).map(image => [image.url, image])).values()];
          return (
            <select
              id={id}
              ref={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              value={current?.url || ''}
              onChange={event => field.onChange(images.find(image => image.url === event.target.value) ?? null)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Use shared or listing image</option>
              {images.map((image, position) => (
                <option key={image.url} value={image.url}>{image.alt || `Listing image ${position + 1}`}</option>
              ))}
            </select>
          );
        }}
      />
      {watch(`subProductData.sizes.${index}.image.url`) && (
        <Controller
          name={`subProductData.sizes.${index}.imageScope`}
          control={control}
          render={({ field }) => (
            <label className="mt-2 block text-sm">
              Use this photo for
              <select {...field} value={field.value || 'variant'}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="variant">This variant only</option>
                {watch(`subProductData.sizes.${index}.colorName`)?.trim() &&
                  <option value="color">All variants with this {colorLabel.toLowerCase()}</option>}
                {optionLabel && watch(`subProductData.sizes.${index}.optionName`)?.trim() &&
                  <option value="option">All variants with this option</option>}
              </select>
            </label>
          )}
        />
      )}
      <p className="mt-1 text-xs text-gray-500">
        Upload photos in Product Images, then choose one here. Variants can share a photo when they have the same colour or option.
      </p>
    </div>
  );
}
