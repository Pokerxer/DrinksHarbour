// @ts-nocheck
'use client';

import toast from 'react-hot-toast';
import Link from 'next/link';
import isEmpty from 'lodash/isEmpty';
import { PiShoppingCartSimple } from 'react-icons/pi';
import { zodResolver } from '@hookform/resolvers/zod';
import { Product } from '@/types';
import { Button, Title, Text, Badge } from 'rizzui';
import { toCurrency } from '@core/utils/to-currency';
import GetSize from '@/app/shared/ecommerce/product/get-size';
import { calculatePercentage } from '@core/utils/calculate-percentage';
import { GetColor } from '@/app/shared/ecommerce/product/get-color';
import WishlistButton from '@/app/shared/ecommerce/product/wishlist-button';
import { useCart } from '@/store/quick-cart/cart.context';
import { FormProvider, useForm, SubmitHandler } from 'react-hook-form';
import { generateCartProduct } from '@/store/quick-cart/generate-cart-product';
import {
  ProductDetailsInput,
  productDetailsSchema,
} from '@/validators/product-details.schema';

export default function ProductDetailsSummery({
  product,
}: {
  product: Product;
}) {
  if ((product as any)?.isReal) {
    return <RealProductSummary product={product as any} />;
  }

  const { addItemToCart } = useCart();

  const methods = useForm<ProductDetailsInput>({
    mode: 'onChange',
    // defaultValues: defaultValues(order),
    resolver: zodResolver(productDetailsSchema),
  });

  const onSubmit: SubmitHandler<ProductDetailsInput> = (data) => {
    const item = generateCartProduct({
      ...product,
      color: data.productColor,
      size: data.productSize,
    });

    addItemToCart(item, 1);
    toast.success(<Text as="b">Product added to the cart</Text>);
  };

  // console.log('errors', methods.formState.errors?.productColor);

  return (
    <>
      <div className="border-b border-muted pb-6 @lg:pb-8">
        <Title as="h2" className="mb-2.5 font-bold @6xl:text-4xl">
          {product?.title}
        </Title>
        <Text as="p" className="text-base">
          {product?.description}
        </Text>
      </div>

      <FormProvider {...methods}>
        <form className="pb-8 pt-5" onSubmit={methods.handleSubmit(onSubmit)}>
          <div className="mb-1.5 mt-2 flex items-end font-lexend text-base">
            <div className="-mb-0.5 text-2xl font-semibold text-gray-900 lg:text-3xl">
              {toCurrency(product?.price as number)}
            </div>
            {/* Sale badge only when there is a genuine discount — never show
                "₦0" / NaN for products without a sale price. */}
            {product?.sale_price != null &&
              product.sale_price > (product?.price ?? 0) && (
                <>
                  <del className="ps-1.5 font-medium text-gray-500">
                    {toCurrency(product?.sale_price)}
                  </del>
                  <div className="ps-1.5 text-red">
                    (
                    {calculatePercentage(
                      product?.price as number,
                      product?.sale_price as number
                    )}
                    % OFF)
                  </div>
                </>
              )}
          </div>
          <div className="font-medium text-green-dark">
            Inclusive of all taxes
          </div>

          <div className="mb-3.5 flex items-start justify-between pt-6">
            <Title as="h6" className="font-inter text-sm font-medium">
              Select Size
            </Title>
            <Button size="sm" variant="text" className="h-auto py-0 underline">
              Size Guide
            </Button>
          </div>

          {!isEmpty(product.sizes) && <GetSize sizes={product.sizes} />}

          <Title as="h6" className="mb-3.5 mt-6 font-inter text-sm font-medium">
            Select Color
          </Title>

          <GetColor colors={product?.colors ?? []} />

          <div className="grid grid-cols-1 gap-4 pt-7 @md:grid-cols-2 @xl:gap-6">
            <Button
              size="xl"
              type="submit"
              className="h-12 text-sm lg:h-14 lg:text-base"
            >
              <PiShoppingCartSimple className="me-2 h-5 w-5 lg:h-[22px] lg:w-[22px]" />{' '}
              Add To Cart
            </Button>
            <WishlistButton />
          </div>
        </form>
      </FormProvider>
    </>
  );
}

// ── Read-only summary for real products loaded from the API ──────────────────
const formatPrice = (value: number | undefined | null, currency: string) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return null;
  }
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency || 'NGN'} ${Number(value).toLocaleString()}`;
  }
};

const typeLabel = (type: string) =>
  type
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const humanizeSize = (code: string) => {
  if (!code) return code;
  const setMatch = code.match(/^set-(\d+)$/);
  if (setMatch) return `Set of ${setMatch[1]}`;
  const bagMatch = code.match(/^bag-(.+)$/);
  if (bagMatch) return `Bag ${bagMatch[1]}`;
  const tinMatch = code.match(/^tin-(.+)$/);
  if (tinMatch) return `Tin ${tinMatch[1]}`;
  const map: Record<string, string> = {
    'unit-single': 'Single',
    'piece-single': 'Single Piece',
    unit: 'Single',
    pair: 'Pair',
    'box-single': 'Single Box',
    'bar-single': 'Single Bar',
    'bar-2': '2-Bar Pack',
    'gift-set': 'Gift Set',
    'tasting-set': 'Tasting Set',
    'variety-pack': 'Variety Pack',
    custom: 'Custom',
  };
  return map[code] || code;
};

function RealProductSummary({ product }: { product: any }) {
  const price = formatPrice(product.basePrice, product.currency);
  const finalPrice = formatPrice(product.salePrice, product.currency);

  return (
    <>
      <div className="border-b border-muted pb-6 @lg:pb-8">
        <Title as="h2" className="mb-2.5 font-bold @6xl:text-4xl">
          {product.name}
        </Title>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="primary" rounded="md">
            {typeLabel(product.type)}
          </Badge>
          {product.subType && (
            <Badge color="secondary" rounded="md">
              {product.subType}
            </Badge>
          )}
          {product.isAlcoholic && (
            <Badge color="danger" rounded="md">
              Alcoholic
            </Badge>
          )}
          <Badge
            color={product.isPublished ? 'success' : 'warning'}
            rounded="md"
          >
            {product.isPublished
              ? 'Published'
              : product.status
                ? typeLabel(product.status)
                : 'Unpublished'}
          </Badge>
        </div>
      </div>

      <div className="pb-8 pt-5">
        <div className="mb-1.5 flex items-end font-lexend text-base">
          <div className="-mb-0.5 text-2xl font-semibold text-gray-900 lg:text-3xl">
            {finalPrice || price || 'Price not set'}
          </div>
          {product.isOnSale && price !== finalPrice && (
            <del className="ps-1.5 font-medium text-gray-500">{price}</del>
          )}
        </div>

        {product.shortDescription && (
          <Text as="p" className="mt-4 leading-relaxed text-gray-600">
            {product.shortDescription}
          </Text>
        )}

        <div className="mt-5 space-y-2 border-t border-muted pt-5 text-sm text-gray-600">
          {product.brandName && (
            <p>
              <span className="font-medium text-gray-900">Brand: </span>
              {product.brandName}
            </p>
          )}
          {product.producer && (
            <p>
              <span className="font-medium text-gray-900">Producer: </span>
              {product.producer}
            </p>
          )}
          {(product.region || product.originCountry) && (
            <p>
              <span className="font-medium text-gray-900">Origin: </span>
              {[product.region, product.originCountry]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
        </div>

        <div className="mt-5">
          <Title as="h6" className="mb-3 font-inter text-sm font-medium">
            Size / Variants
          </Title>
          {product.sizes?.length ? (
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s: any) => (
                <span
                  key={s.size || s.displayName}
                  className="rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800"
                >
                  {s.displayName && s.displayName !== s.size
                    ? s.displayName
                    : humanizeSize(s.size || s.displayName)}
                </span>
              ))}
            </div>
          ) : (
            <Text className="text-sm text-gray-500">No size variants</Text>
          )}
        </div>

        <div className="mt-8">
          <Link href={`/products/${product.id}/edit`}>
            <Button size="xl" className="h-12 w-full text-sm lg:h-14 lg:text-base">
              Edit Product
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
