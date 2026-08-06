// @ts-nocheck
'use client';

import {
  useForm,
  useWatch,
  FormProvider,
  type SubmitHandler,
} from 'react-hook-form';
import { useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import toast from 'react-hot-toast';
import isEmpty from 'lodash/isEmpty';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import DifferentBillingAddress from '@/app/shared/ecommerce/order/order-form/different-billing-address';
import { defaultValues } from '@/app/shared/ecommerce/order/order-form/form-utils';
import CustomerInfo from '@/app/shared/ecommerce/order/order-form/customer-info';
import AddressInfo from '@/app/shared/ecommerce/order/order-form/address-info';
import { Text } from 'rizzui';
import cn from '@core/utils/class-names';
import OrderSummery from '@/app/shared/ecommerce/checkout/order-summery';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import OrderNote from '@/app/shared/ecommerce/checkout/order-note';
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

/** Split "First Last" into first/last names for the order's customer block. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
}

// main order form component for create and update order
export default function CreateOrder({
  // `id` arrives from the edit route but the API has no order-edit endpoint
  // yet, so the form always creates — kept in the props for route parity.
  id: _id,
  order,
  className,
}: {
  id?: string;
  className?: string;
  order?: CreateOrderInput;
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

  const methods = useForm<CreateOrderInput>({
    defaultValues: defaultValues(order),
    resolver: zodResolver(orderFormSchema),
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
    const shipping = data.shippingAddress?.street
      ? data.shippingAddress
      : billing;

    if (!billing.email?.trim()) {
      toast.error(
        <Text as="b">Customer email is required to place an order.</Text>
      );
      return;
    }

    const orderItems = items.map((item) => ({
      subProductId: item.subProductId,
      productId:
        item.productId || (typeof item.id === 'string' ? item.id : undefined),
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
      setBillingAddress(data.billingAddress);
      setShippingAddress(data.billingAddress);
    } else {
      if (!isEmpty(data.shippingAddress)) {
        setShippingAddress(data.shippingAddress);
      }
    }

    const { firstName, lastName } = splitName(billing.customerName);

    setLoading(true);
    try {
      const created = await orderService.createOrder(token, {
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
        paymentMethod: 'cash_on_delivery',
        items: orderItems,
        subtotal: total,
        total,
        note: data?.note || undefined,
        couponCode: couponCode || undefined,
      });

      resetCart();
      toast.success(
        <Text as="b">Order {created.orderNumber} placed successfully!</Text>
      );
      router.push(routes.eCommerce.orderDetails(created._id));
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

  const sameShippingAddress = useWatch({
    control: methods.control,
    name: 'sameShippingAddress',
  });

  return (
    <FormProvider {...methods}>
      <form
        // @ts-ignore
        onSubmit={methods.handleSubmit(onSubmit)}
        className={cn(
          'isomorphic-form flex flex-grow flex-col @container [&_label.block>span]:font-medium',
          className
        )}
      >
        <div className="items-start @5xl:grid @5xl:grid-cols-12 @5xl:gap-7 @6xl:grid-cols-10 @7xl:gap-10">
          <div className="flex-grow @5xl:col-span-8 @5xl:pb-10 @6xl:col-span-7">
            <div className="flex flex-col gap-4 @xs:gap-7 @5xl:gap-9">
              <AddressInfo type="billingAddress" title="Billing Information" />

              <DifferentBillingAddress />

              {!sameShippingAddress && <AddressInfo type="shippingAddress" />}

              <OrderNote />
            </div>
          </div>

          <div className="pb-7 pt-10 @container @5xl:col-span-4 @5xl:py-0 @6xl:col-span-3">
            <CustomerInfo />
            <OrderSummery isLoading={isLoading} className="static" />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
