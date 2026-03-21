'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

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

const statusConfig: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  pending: { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Icon.PiClockBold },
  confirmed: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: Icon.PiCheckCircleBold },
  processing: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: Icon.PiPackageBold },
  shipped: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: Icon.PiTruckBold },
  delivered: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: Icon.PiCheckCircleBold },
  cancelled: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: Icon.PiXCircleBold },
  refunded: { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', icon: Icon.PiArrowUUpLeftBold },
};

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Icon.PiPackageBold },
  { key: 'confirmed', label: 'Confirmed', icon: Icon.PiCheckCircleBold },
  { key: 'processing', label: 'Processing', icon: Icon.PiPackageBold },
  { key: 'shipped', label: 'Shipped', icon: Icon.PiTruckBold },
  { key: 'delivered', label: 'Delivered', icon: Icon.PiCheckCircleBold },
];

const getStatusIndex = (status: string) => {
  const index = statusSteps.findIndex(step => step.key === status.toLowerCase());
  return index >= 0 ? index : 0;
};

function OrderTrackingContent() {
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
      const response = await fetch(`${API_URL}/api/orders/number/${orderNum}?email=${encodeURIComponent(orderEmail)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch order');
      }

      setOrder(data.data.order);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order. Please check your order number and email.');
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

  const getStatusConfig = (status: string) => {
    const key = status?.toLowerCase() || 'pending';
    return statusConfig[key] || statusConfig.pending;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {order ? (
            <motion.div
              key="order-details"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
              >
                <div className="flex items-center gap-4">
                  <Link href="/my-account/orders" className="p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all">
                    <Icon.PiArrowLeftBold className="w-5 h-5 text-gray-600" />
                  </Link>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
                    <p className="text-gray-500 text-sm">{formatDate(order.placedAt)}</p>
                  </div>
                </div>
                {(() => {
                  const status = getStatusConfig(order.status);
                  const StatusIcon = status.icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${status.bg} ${status.border} border ${status.color} w-fit`}>
                      <StatusIcon className="w-4 h-4" />
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  );
                })()}
              </motion.div>

              <motion.div 
                variants={itemVariants}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
              >
                <div className="flex items-center justify-between overflow-x-auto">
                  {statusSteps.map((step, index) => {
                    const currentIndex = getStatusIndex(order.status);
                    const isCompleted = index <= currentIndex;
                    const isCurrent = index === currentIndex;
                    const StepIcon = step.icon;

                    return (
                      <div key={step.key} className="flex flex-col items-center flex-1 relative min-w-[80px]">
                        {index < statusSteps.length - 1 && (
                          <div 
                            className={`absolute top-6 left-1/2 w-full h-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} 
                            style={{ transform: 'translateX(50%)' }} 
                          />
                        )}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl z-10 transition-all ${
                          isCompleted 
                            ? (isCurrent ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-green-100 text-green-600') 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          <StepIcon className="w-5 h-5" />
                        </div>
                        <div className={`mt-3 text-xs font-medium text-center ${isCurrent ? 'text-green-600' : 'text-gray-500'}`}>
                          {step.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon.PiMapPinBold className="w-5 h-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">Shipping Address</h3>
                  </div>
                  <div className="text-secondary space-y-1">
                    <p className="font-medium text-gray-900">{order.shippingAddress.fullName}</p>
                    <p>{order.shippingAddress.addressLine1}</p>
                    {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                    <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                    <p>{order.shippingAddress.country}</p>
                    <p className="mt-2 flex items-center gap-2 text-gray-500">
                      <Icon.PiPhoneBold className="w-4 h-4" /> {order.shippingAddress.phone}
                    </p>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon.PiInfoBold className="w-5 h-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">Order Information</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-secondary">Order Number</span>
                      <span className="font-medium">{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Order Date</span>
                      <span className="font-medium">{formatDate(order.placedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">Payment Method</span>
                      <span className="font-medium capitalize">{order.paymentMethod?.replace('_', ' ') || 'Card'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-secondary">Payment Status</span>
                      {(() => {
                        const status = getStatusConfig(order.paymentStatus);
                        const StatusIcon = status.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.border} border ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {order.paymentStatus}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              </div>

              <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Icon.PiShoppingBagBold className="w-5 h-5 text-gray-400" />
                    Order Items ({order.items.length})
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {order.items.map((item, index) => (
                    <div key={index} className="p-4 md:p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                      <div className="w-20 h-20 relative rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        {item.product.images?.[0] ? (
                          <Image
                            src={item.product.images[0].url}
                            alt={item.product.images[0].alt || item.product.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon.PiImageBold className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={'/product/' + item.product.slug} className="font-medium text-gray-900 hover:text-primary transition-colors line-clamp-1">
                          {item.product.name}
                        </Link>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatCurrency(item.priceAtPurchase)} × {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(item.itemSubtotal)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-md ml-auto">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Icon.PiReceiptBold className="w-5 h-5 text-gray-400" />
                  Order Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-secondary">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-secondary">
                    <span>Shipping</span>
                    <span className="font-medium">{order.shippingFee > 0 ? formatCurrency(order.shippingFee) : 'Free'}</span>
                  </div>
                  {order.discountTotal > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(order.discountTotal)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3 flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-xl text-gray-900">{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="tracking-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"
            >
              <div className="bg-white rounded-3xl shadow-lg p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gray-900 rounded-xl">
                    <Icon.PiMagnifyingGlassBold className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Track Your Order</h2>
                </div>
                <p className="text-gray-500 mb-6">
                  Enter your order number and billing email to track your order status.
                </p>

                <AnimatePresence>
                  {(formError || error) && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3"
                    >
                      <Icon.PiWarningCircleBold className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-600 text-sm">{formError || error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Order Number</label>
                    <div className="relative">
                      <Icon.PiTagBold className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        type="text"
                        placeholder="e.g., DH2602090029"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Billing Email</label>
                    <div className="relative">
                      <Icon.PiEnvelopeBold className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Icon.PiSpinner className="animate-spin w-5 h-5" />
                        Tracking...
                      </>
                    ) : (
                      <>
                        <Icon.PiMagnifyingGlassBold className="w-5 h-5" />
                        Track Order
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="hidden lg:block">
                <motion.div 
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 text-white relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full translate-y-1/2 -translate-x-1/2" />
                  
                  <div className="relative">
                    <Icon.PiTruckBold className="w-16 h-16 mb-4" />
                    <h3 className="text-2xl font-bold mb-2">Need Help?</h3>
                    <p className="text-gray-300 mb-6">
                      Can't find your order? Contact our support team for assistance.
                    </p>
                    <Link 
                      href="/contact" 
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      Contact Support <Icon.PiArrowRightBold />
                    </Link>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function OrderTracking() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full" />
      </div>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}
