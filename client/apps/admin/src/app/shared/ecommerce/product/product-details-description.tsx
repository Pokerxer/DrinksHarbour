// @ts-nocheck
'use client';

import { Collapse, Title, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiCaretDownBold, PiTagLight } from 'react-icons/pi';
import ProductSpecTable from '@/app/shared/ecommerce/product/product-spec-table';

export default function ProductDetailsDescription({
  product,
}: {
  product?: any;
}) {
  if (product?.isReal) {
    return (
      <Collapse
        className="border-t last-of-type:border-t-0"
        defaultOpen={true}
        header={({ open, toggle }) => (
          <div
            role="button"
            onClick={toggle}
            className="flex w-full cursor-pointer items-center justify-between py-6 font-lexend text-lg font-semibold text-gray-900"
          >
            Product Details
            <div className="flex shrink-0 items-center justify-center">
              <PiCaretDownBold
                className={cn(
                  'h-[18px] w-[18px] transform transition-transform duration-300',
                  open && 'rotate-180'
                )}
              />
            </div>
          </div>
        )}
      >
        <div className="-mt-2 pb-7">
          {product.description ? (
            <Text as="p" className="pb-4 leading-relaxed">
              {product.description}
            </Text>
          ) : (
            <Text className="pb-4 text-gray-400">
              No description has been provided for this product.
            </Text>
          )}
          <ProductSpecTable product={product} />
        </div>
      </Collapse>
    );
  }

  return (
    <Collapse
      className="border-t last-of-type:border-t-0"
      defaultOpen={true}
      header={({ open, toggle }) => (
        <div
          role="button"
          onClick={toggle}
          className="flex w-full cursor-pointer items-center justify-between py-6 font-lexend text-lg font-semibold text-gray-900"
        >
          Product Details
          <div className="flex shrink-0 items-center justify-center">
            <PiCaretDownBold
              className={cn(
                'h-[18px] w-[18px] transform transition-transform duration-300',
                open && 'rotate-180'
              )}
            />
          </div>
        </div>
      )}
    >
      <div className="-mt-2 pb-7">
        <Text as="p" className="pb-2 leading-relaxed">
          Monochrome elegance. Made with a relaxed wide-leg, these trousers are
          made from a sustainable soft organic cotton with a mechanical stretch
          making the garment easily recycled.
        </Text>
        <ul className="space-y-2.5">
          <li>Synthetic leather upper</li>
          <li>Cushioned footbed</li>
          <li>Textured and patterned outsole</li>
          <li>Warranty: 1 month</li>
        </ul>
        <Title as="h6" className="mt-6 font-inter text-sm font-semibold">
          Material & Care
        </Title>
        <ul className="space-y-2.5 pt-3.5">
          <li>Synthetic Leather</li>
          <li>Chocolate</li>
          <li>Timberland Private White</li>
        </ul>
        <div className="mt-6 flex items-center">
          <PiTagLight className="me-2 h-5 w-5 text-gray-400" />
          <p className="text-sm text-gray-500">
            100% brand new and high quality
          </p>
        </div>
      </div>
    </Collapse>
  );
}