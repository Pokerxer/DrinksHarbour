// @ts-nocheck
'use client';

import {
  useForm,
  useWatch,
  FormProvider,
  type SubmitHandler,
} from 'react-hook-form';
import { useSetAtom, useAtomValue } from 'jotai';
import toast from 'react-hot-toast';
import isEmpty from 'lodash/isEmpty';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { zodResolver } from '@hookform/resolvers/zod';
import DifferentBillingAddress from '@/app/shared/ecommerce/checkout/different-billing-address';
import AddressInfo from '@/app/shared/ecommerce/checkout/address-info';
import ShippingMethod from '@/app/shared/ecommerce/checkout/shipping-method';
import PaymentMethod from '@/app/shared/ecommerce/checkout/payment-method';
import OrderSummery from '@/app/shared/ecommerce/checkout/order-summery';
import OrderNote from '@/app/shared/ecommerce/checkout/order-note';
import { routes } from '@/config/routes';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  billingAddressAtom,
  couponCodeAtom,
  orderNoteAtom,
  shippingAddressAtom,
} from '@/store/checkout';
import {
  CreateOrderInput,
  orderFormSchema,
} from '@/validators/create-order.schema';
import { orderService } from '@/services/order.service';
import { useCart } from '@/store/quick-cart/cart.context';
import { useState } from 'react';

/** Split "First Last" into first/last names for the order's customer block. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
}

// main order form component for create and update order
export default function CheckoutPageWrapper({
  className,
}: {
  className?: string;
}) {
  const [isLoading, setLoading] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as any)?.token as string | undefined;

  const { items, total, resetCart } = useCart();
  const setOrderNote = useSetAtom(orderNoteAtom);
  const setBillingAddress = useSetAtom(billingAddressAtom);
  const setShippingAddress = useSetAtom(shippingAddressAtom);
  const couponCode = useAtomValue(couponCodeAtom);

  const methods = useForm({
    mode: 'onChange',
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      sameShippingAddress: true,
      paymentMethod: 'cash_on_delivery',
    },
  });

  const sameShippingAddress = useWatch({
    control: methods.control,
    name: 'sameShippingAddress',
  });

  const onSubmit: SubmitHandler<CreateOrderInput> = async (data) => {
    if (!token) {
      toast.error(<Text as="b">You must be signed in to place an order.</Text>);
      return;
    }

    if (isEmpty(items)) {
      toast.error(<Text as="b">Your cart is empty.</Text>);
      return;
    }

    const billing = data.billingAddress;
    const shipping = sameShippingAddress
      ? billing
      : data.shippingAddress && data.shippingAddress.street
        ? data.shippingAddress
        : billing;

    // The server requires a valid customer email (order notifications).
    if (!billing.email?.trim()) {
      toast.error(
        <Text as="b">Customer email is required to place an order.</Text>
      );
      return;
    }

    // A toggled "different shipping address" must actually be filled in.
    if (!sameShippingAddress && !data.shippingAddress?.street) {
      toast.error(
        <Text as="b">Please complete the shipping address fields.</Text>
      );
      return;
    }

    // Real orders need a backend product/sub-product reference per line.
    const orderItems = items.map((item) => ({
      subProductId: item.subProductId,
      productId: item.productId || (typeof item.id === 'string' ? item.id : undefined),
      sizeId: item.sizeId,
      quantity: item.quantity,
      price: item.price,
    }));
    if (orderItems.some((i) => !i.subProductId && !i.productId)) {
      toast.error(
        <Text as="b">
          Some items in your cart are missing product data and cannot be
          ordered yet.
        </Text>
      );
      return;
    }

    setOrderNote(data?.note as string);
    if (sameShippingAddress) {
      setBillingAddress(billing);
      setShippingAddress(billing);
    } else if (!isEmpty(data.shippingAddress)) {
      setShippingAddress(data.shippingAddress);
    }

    const { firstName, lastName } = splitName(billing.customerName);

    setLoading(true);
    try {
      const order = await orderService.createOrder(token, {
        customer: {
          firstName,
          lastName,
          email: billing.email.trim(),
          phone: billing.phoneNumber,
        },
        shipping: {
          address: shipping.street,
          city: shipping.city,
          state: shipping.state,
          zipCode: shipping.zip,
          country: shipping.country,
        },
        paymentMethod: data.paymentMethod || 'cash_on_delivery',
        items: orderItems,
        subtotal: total,
        total,
        note: data?.note || undefined,
        couponCode: couponCode || undefined,
      });

      resetCart();
      toast.success(
        <Text as="b">
          Order {order.orderNumber} placed successfully!
        </Text>
      );
      router.push(routes.eCommerce.orderDetails(order._id));
    } catch (err) {
      toast.error(
        <Text as="b">
          {(err as Error).message || 'Failed to place order. Please try again.'}
        </Text>
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        // @ts-ignore
        onSubmit={methods.handleSubmit(onSubmit)}
        className={cn(
          'isomorphic-form isomorphic-form mx-auto flex w-full max-w-[1536px] flex-grow flex-col @container [&_label.block>span]:font-medium',
          className
        )}
      >
        <div className="items-start @5xl:grid @5xl:grid-cols-12 @5xl:gap-7 @6xl:grid-cols-10 @7xl:gap-10">
          <div className="gap-4 border-muted @container @5xl:col-span-8 @5xl:border-e @5xl:pb-12 @5xl:pe-7 @6xl:col-span-7 @7xl:pe-12">
            <div className="flex flex-col gap-4 @xs:gap-7 @5xl:gap-9">
              <AddressInfo type="billingAddress" title="Billing Information" />

              <DifferentBillingAddress />

              {!sameShippingAddress && <AddressInfo type="shippingAddress" />}

              <OrderNote />

              <ShippingMethod />

              <PaymentMethod />
            </div>
          </div>

          <OrderSummery isLoading={isLoading} />
        </div>
      </form>
    </FormProvider>
  );
}
