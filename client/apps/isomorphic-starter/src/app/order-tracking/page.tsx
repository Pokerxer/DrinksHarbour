'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';

interface OrderItem {
  product: {
    _id: string;
    name: string;
    slug: string;
    images: { url: string; alt: string }[];
  };
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  totalAmount: number;
  placedAt: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone: string;
  };
}

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: '📦' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'processing', label: 'Processing', icon: '⚙️' },
  { key: 'shipped', label: 'Shipped', icon: '🚚' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
];

const getStatusIndex = (status: string) => {
  const index = statusSteps.findIndex(step => step.key === status.toLowerCase());
  return index >= 0 ? index : 0;
};

const OrderTracking = () => {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderId') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    const orderEmail = searchParams.get('email');
    if (orderId) {
      setOrderNumber(orderId);
      if (orderEmail) {
        setEmail(orderEmail);
      }
      if (orderId && orderEmail) {
        fetchOrder(orderId, orderEmail);
      }
    }
  }, [searchParams]);

  const fetchOrder = async (orderNum: string, orderEmail: string) => {
    if (!orderNum.trim()) {
      setFormError('Please enter your order number');
      return;
    }
    if (!orderEmail.trim()) {
      setFormError('Please enter your billing email');
      return;
    }

    setLoading(true);
    setError('');
    setFormError('');
    setOrder(null);

    try {
      const url = 'http://localhost:5001/api/orders/number/' + orderNum + '?email=' + encodeURIComponent(orderEmail);
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch order');
      }

      setOrder(data.data.order);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(orderNumber, email);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'confirmed': return 'text-blue-600 bg-blue-50';
      case 'processing': return 'text-orange-600 bg-orange-50';
      case 'shipped': return 'text-purple-600 bg-purple-50';
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      case 'refunded': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="order-tracking md:py-20 py-10 bg-gray-50 min-h-screen">
      <div className="container">
        {order ? (
          <div className="content-main flex gap-y-8 max-md:flex-col">
            <div className="w-full">
              <div className="flex justify-between items-center mb-6">
                <div className="heading4">Order #{order.orderNumber}</div>
                <div className={'px-4 py-2 rounded-lg font-medium capitalize ' + getStatusColor(order.status)}>
                  {order.status}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-line mb-8">
                <div className="heading5 mb-6">Order Status</div>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    {statusSteps.map((step, index) => {
                      const currentIndex = getStatusIndex(order.status);
                      const isCompleted = index <= currentIndex;
                      const isCurrent = index === currentIndex;

                      return (
                        <div key={step.key} className="flex flex-col items-center flex-1 relative">
                          {index < statusSteps.length - 1 && (
                            <div className={'absolute top-6 left-1/2 w-full h-1 ' + (isCompleted ? 'bg-green-500' : 'bg-gray-200')} style={{ transform: 'translateX(50%)' }} />
                          )}
                          <div className={'w-12 h-12 rounded-full flex items-center justify-center text-xl z-10 ' + (isCompleted ? (isCurrent ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600') : 'bg-gray-100 text-gray-400')}>
                            {isCompleted ? step.icon : '○'}
                          </div>
                          <div className={'mt-2 text-sm font-medium ' + (isCurrent ? 'text-green-600' : 'text-gray-500')}>
                            {step.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-line">
                  <div className="heading5 mb-4">Shipping Address</div>
                  <div className="text-secondary">
                    <p className="font-medium text-black">{order.shippingAddress.fullName}</p>
                    <p>{order.shippingAddress.addressLine1}</p>
                    {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                    <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                    <p>{order.shippingAddress.country}</p>
                    <p className="mt-2">{order.shippingAddress.phone}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-line">
                  <div className="heading5 mb-4">Order Information</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-secondary">Order Number:</span>
                      <span className="font-medium">{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Order Date:</span>
                      <span className="font-medium">{formatDate(order.placedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Payment Method:</span>
                      <span className="font-medium capitalize">{order.paymentMethod.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Payment Status:</span>
                      <span className={'font-medium capitalize px-2 py-1 rounded text-xs ' + getStatusColor(order.paymentStatus)}>
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-line mb-8">
                <div className="heading5 mb-4">Order Items</div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="text-left py-3 px-4 font-medium text-secondary">Product</th>
                        <th className="text-center py-3 px-4 font-medium text-secondary">Price</th>
                        <th className="text-center py-3 px-4 font-medium text-secondary">Quantity</th>
                        <th className="text-right py-3 px-4 font-medium text-secondary">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, index) => (
                        <tr key={index} className="border-b border-line last:border-0">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {item.product.images?.[0] && (
                                <div className="w-16 h-16 relative rounded-lg overflow-hidden">
                                  <Image
                                    src={item.product.images[0].url}
                                    alt={item.product.images[0].alt || item.product.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              )}
                              <div>
                                <Link href={'/product/' + item.product.slug} className="font-medium hover:text-primary">
                                  {item.product.name}
                                </Link>
                              </div>
                            </div>
                          </td>
                          <td className="text-center py-4 px-4">
                            {formatCurrency(item.priceAtPurchase)}
                          </td>
                          <td className="text-center py-4 px-4">
                            {item.quantity}
                          </td>
                          <td className="text-right py-4 px-4 font-medium">
                            {formatCurrency(item.itemSubtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-line max-w-md ml-auto">
                <div className="heading5 mb-4">Order Summary</div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-secondary">Subtotal</span>
                    <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Shipping</span>
                    <span className="font-medium">{order.shippingFee > 0 ? formatCurrency(order.shippingFee) : 'Free'}</span>
                  </div>
                  {order.discountTotal > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(order.discountTotal)}</span>
                    </div>
                  )}
                  <div className="border-t border-line pt-3 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold text-xl">{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="content-main flex gap-y-8 max-md:flex-col">
            <div className="left md:w-1/2 w-full lg:pr-[60px] md:pr-[40px] md:border-r border-line">
              <div className="heading4">Order Tracking</div>
              <div className="mt-2 text-secondary">
                To track your order please enter your Order ID in the box below and press the &quot;Track&quot; button.
                This was given to you on your receipt and in the confirmation email you should have received.
              </div>

              {formError && (
                <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
                  {formError}
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="md:mt-7 mt-4">
                <div className="email">
                  <label className="block text-sm font-medium mb-2">Order Number *</label>
                  <input
                    className="border-line px-4 pt-3 pb-3 w-full rounded-lg"
                    type="text"
                    placeholder="e.g., DH2602090029"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="billing mt-5">
                  <label className="block text-sm font-medium mb-2">Billing Email *</label>
                  <input
                    className="border-line px-4 pt-3 pb-3 w-full rounded-lg"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="block-button md:mt-7 mt-4">
                  <button
                    type="submit"
                    className="button-main flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Icon.PiSpinner className="animate-spin text-lg" />
                        Tracking...
                      </>
                    ) : (
                      <>
                        <Icon.PiMagnifyingGlass />
                        Track Order
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            <div className="right md:w-1/2 w-full lg:pl-[60px] md:pl-[40px] flex items-center">
              <div className="text-content">
                <div className="heading4">Already have an account?</div>
                <div className="mt-2 text-secondary">
                  Sign in to access your personalized experience, saved preferences, and more.
                  We are thrilled to have you with us again!
                </div>
                <div className="block-button md:mt-7 mt-4">
                  <Link href="/login" className="button-main">
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;
