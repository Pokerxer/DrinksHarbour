'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as Icon from 'react-icons/pi';

interface OrderData {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  totalAmount: number;
  placedAt: string;
  shippingAddress: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  coupon: {
    code: string;
    discountType: string;
    discountValue: number;
  } | null;
  items: Array<{
    product: {
      name: string;
      slug: string;
      images: Array<{ url: string; alt?: string }>;
    };
    subproduct: {
      name: string;
      sku: string;
    } | null;
    size: {
      name: string;
    } | null;
    tenant: {
      name: string;
    } | null;
    quantity: number;
    priceAtPurchase: number;
  }>;
}

const OrderConfirmation = () => {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        // For guest users, we need to provide email for verification
        let url = `http://localhost:5001/api/orders/${orderId}`;
        if (!token) {
          const customerEmail = localStorage.getItem('customerEmail') || sessionStorage.getItem('customerEmail');
          if (customerEmail) {
            url += `?email=${encodeURIComponent(customerEmail)}`;
          }
        }
        
        const response = await fetch(url, {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch order');
        }

        setOrder(data.data.order);
        // Clean up stored email after successful fetch
        localStorage.removeItem('customerEmail');
        sessionStorage.removeItem('customerEmail');
      } catch (err: any) {
        setError(err.message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Icon.PiShoppingCart size={64} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Order Found</h2>
        <p className="text-gray-600 mb-6">We couldn't find an order associated with your request.</p>
        <Link href="/shop" className="inline-block py-3 px-8 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">
          Start Shopping
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Icon.PiWarning size={64} className="mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Order</h2>
        <p className="text-gray-600 mb-6">{error || 'Order not found'}</p>
        <Link href="/" className="inline-block py-3 px-8 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmation</h1>
        <p className="text-gray-600 mb-8">
          <Link href="/" className="hover:text-gray-900">Home</Link>
          <span className="mx-2">/</span>
          <span>Order Confirmation</span>
        </p>
      </div>

      <div className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon.PiCheck size={40} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You for Your Order!</h2>
            <p className="text-gray-600 mb-4">Your order has been placed successfully.</p>
            <div className="inline-block bg-gray-100 rounded-lg px-6 py-3">
              <p className="text-sm text-gray-500 mb-1">Order Number</p>
              <p className="text-xl font-bold text-gray-900">{order.orderNumber}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon.PiTruck size={20} />
              Shipping Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{order.shippingAddress?.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{order.shippingAddress?.phone}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">
                  {order.shippingAddress?.addressLine1}, {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.postalCode}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon.PiShoppingCart size={20} />
              Order Items
            </h3>
            <div className="space-y-4">
              {order.items?.map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.product?.images?.[0]?.url ? (
                      <Image src={item.product.images[0].url} alt={item.product.name} width={80} height={80} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon.PiImage size={24} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.product?.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {item.tenant && (
                        <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                          {item.tenant.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        Qty: {item.quantity}
                      </span>
                      {item.size && (
                        <span className="text-xs text-gray-500">
                          {item.size.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-semibold">₦{(item.priceAtPurchase * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon.PiCreditCard size={20} />
              Order Summary
            </h3>
            <div className="space-y-3">
              {/* Price Breakdown */}
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">₦{(order.subtotal || 0).toLocaleString()}</span>
              </div>
              
              {/* Coupon */}
              {order.coupon && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Icon.PiTag size={14} />
                    Coupon: {order.coupon.code}
                  </span>
                  <span className="font-medium">-₦{(order.discountTotal || 0).toLocaleString()}</span>
                </div>
              )}
              
              {/* Shipping */}
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className={`font-medium ${order.shippingFee === 0 ? 'text-green-600' : ''}`}>
                  {order.shippingFee === 0 ? 'Free' : `₦${(order.shippingFee || 0).toLocaleString()}`}
                </span>
              </div>
              
              {/* Total */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-xl text-gray-900">₦{order.totalAmount.toLocaleString()}</span>
                </div>
              </div>
              
              {/* Payment Status */}
              <div className="flex justify-between pt-2">
                <span className="text-gray-600">Payment Status</span>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {order.paymentStatus === 'paid' ? <Icon.PiCheck size={14} /> : <Icon.PiClock size={14} />}
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </span>
              </div>
              
              {/* Order Status */}
              <div className="flex justify-between">
                <span className="text-gray-600">Order Status</span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  <Icon.PiPackage size={14} />
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shop" className="inline-flex items-center justify-center gap-2 py-3 px-8 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">
              <Icon.PiArrowLeft size={18} />
              Continue Shopping
            </Link>
            <Link href="/my-account/orders" className="inline-flex items-center justify-center gap-2 py-3 px-8 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
              <Icon.PiUser size={18} />
              View My Orders
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderConfirmation;
