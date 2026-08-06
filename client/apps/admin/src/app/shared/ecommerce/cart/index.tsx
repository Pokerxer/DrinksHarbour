// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAtom } from 'jotai';
import toast from 'react-hot-toast';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import { recentlyProducts, recommendationProducts } from '@/data/shop-products';
import CartProduct from '@/app/shared/ecommerce/cart/cart-product';
import { useCart } from '@/store/quick-cart/cart.context';
import { couponCodeAtom } from '@/store/checkout';
import usePrice from '@core/hooks/use-price';
import { toCurrency } from '@core/utils/to-currency';
import { Empty, EmptyProductBoxIcon, Title, Text, Input, Button } from 'rizzui';
import ProductCarousel from '@/app/shared/product-carousel';

type FormValues = {
  couponCode: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

interface AppliedCoupon {
  code: string;
  name: string;
  discount: number;
}

/**
 * Validate a promo code against POST /api/coupons/validate. Returns the
 * server-computed discount amount, or throws with the server's message.
 */
async function validateCoupon(
  code: string,
  subtotal: number,
  token?: string
): Promise<AppliedCoupon> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/coupons/validate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code, cartData: { subtotal } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.message || 'Invalid or expired coupon code');
  }
  const data = body.data ?? {};
  const discount = Math.max(0, Math.min(subtotal, Number(data.discount) || 0));
  return {
    code: data.coupon?.code ?? code,
    name: data.coupon?.name ?? code,
    discount,
  };
}

function CheckCoupon({
  subtotal,
  onApplied,
}: {
  subtotal: number;
  onApplied: (coupon: AppliedCoupon | null) => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string | undefined;
  const [reset, setReset] = useState({});
  const [isValidating, setValidating] = useState(false);

  const onSubmit = async (data: FormValues) => {
    const code = data.couponCode?.trim();
    if (!code) return;
    try {
      setValidating(true);
      const coupon = await validateCoupon(code, subtotal, token);
      onApplied(coupon);
      toast.success(
        <Text as="b">
          {coupon.name || coupon.code} applied — you save{' '}
          {toCurrency(coupon.discount)}
        </Text>
      );
      setReset({ couponCode: '' });
    } catch (err) {
      onApplied(null);
      toast.error((err as Error).message || 'Invalid or expired coupon code');
    } finally {
      setValidating(false);
    }
  };

  return (
    <Form<FormValues>
      resetValues={reset}
      onSubmit={onSubmit}
      useFormProps={{
        defaultValues: { couponCode: '' },
      }}
      className="w-full"
    >
      {({ register, formState: { errors }, watch }) => (
        <div className="relative flex items-end">
          <Input
            type="text"
            placeholder="Enter coupon code"
            inputClassName="text-sm"
            className="w-full"
            label={<Text>Do you have a promo code?</Text>}
            {...register('couponCode')}
            error={errors.couponCode?.message}
          />
          <Button
            type="submit"
            className="ms-3"
            disabled={!watch('couponCode') || isValidating}
            isLoading={isValidating}
          >
            Apply
          </Button>
        </div>
      )}
    </Form>
  );
}

// total cart balance calculation — real values from the cart, no hardcoded rows
function CartCalculations() {
  const router = useRouter();
  const { items, total } = useCart();
  const { price: totalPrice } = usePrice({ amount: total });
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  // Persist the applied code so checkout can pass it to POST /api/orders.
  const [couponCode, setCouponCode] = useAtom(couponCodeAtom);

  const applyCoupon = (c: AppliedCoupon | null) => {
    setCoupon(c);
    setCouponCode(c?.code ?? '');
  };

  const discount = coupon ? Math.min(coupon.discount, total) : 0;
  const payable = Math.max(0, total - discount);

  return (
    <div>
      <Title as="h2" className="border-b border-muted pb-4 text-lg font-medium">
        Cart Totals
      </Title>
      <div className="mt-6 grid grid-cols-1 gap-4 @md:gap-6">
        <div className="flex items-center justify-between">
          Subtotal
          <span className="font-medium text-gray-1000">{totalPrice}</span>
        </div>

        {discount > 0 && (
          <div className="flex items-center justify-between text-green-dark">
            <span className="flex items-center gap-2">
              Discount
              <button
                type="button"
                onClick={() => applyCoupon(null)}
                className="text-xs font-medium text-gray-500 underline hover:text-gray-900"
              >
                remove
              </button>
            </span>
            <span className="font-medium">−{toCurrency(discount)}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-gray-500">
          Shipping
          <span className="text-sm">Calculated at checkout</span>
        </div>

        <CheckCoupon subtotal={total} onApplied={applyCoupon} />

        {/* Restore a code persisted from a previous cart visit */}
        {!coupon && couponCode && (
          <p className="-mt-2 text-xs text-gray-500">
            Coupon <span className="font-mono">{couponCode}</span> will be
            applied at checkout.
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-muted py-4 font-semibold text-gray-1000">
          Total
          <span className="font-medium text-gray-1000">
            {toCurrency(payable)}
          </span>
        </div>

        {items.length > 0 ? (
          <>
            <Link href={routes.eCommerce.checkout}>
              <Button
                size="xl"
                rounded="pill"
                onClick={() => router.push(routes.eCommerce.checkout)}
                className="w-full"
              >
                Proceed To Checkout
              </Button>
            </Link>
            <Link href={routes.eCommerce.shop}>
              <Button
                size="xl"
                variant="outline"
                rounded="pill"
                className="w-full dark:bg-gray-100 dark:active:bg-gray-100"
              >
                Continue Shopping
              </Button>
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function CartPageWrapper() {
  const { items } = useCart();
  return (
    <div className="@container">
      <div className="mx-auto w-full max-w-[1536px] items-start @5xl:grid @5xl:grid-cols-12 @5xl:gap-7 @6xl:grid-cols-10 @7xl:gap-10">
        <div className="@5xl:col-span-8 @6xl:col-span-7">
          {items.length ? (
            items.map((item) => <CartProduct key={item.id} product={item} />)
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <Empty image={<EmptyProductBoxIcon />} text="No Product in the Cart" />
              <Link href={routes.eCommerce.shop}>
                <Button variant="outline" className="mt-4">
                  Start Shopping
                </Button>
              </Link>
            </div>
          )}
        </div>
        <div className="sticky top-24 mt-10 @container @5xl:col-span-4 @5xl:mt-0 @5xl:px-4 @6xl:col-span-3 2xl:top-28">
          <CartCalculations />
        </div>
      </div>

      <ProductCarousel title={'Recommendations'} data={recommendationProducts} />
      <ProductCarousel title={'Recently Viewed'} data={recentlyProducts} />
    </div>
  );
}
