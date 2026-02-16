'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  PiPackage, 
  PiClock, 
  PiTruck, 
  PiCheckCircle, 
  PiImage, 
  PiReceipt, 
  PiX,
  PiArrowRight,
  PiArrowLeft,
  PiUser,
  PiMapPin,
  PiCreditCard,
  PiCalendar,
  PiTag,
  PiPhone,
  PiSparkle,
  PiWarningCircle,
  PiPrinter,
  PiShareNetwork,
  PiArrowUUpLeft
} from 'react-icons/pi';

interface OrderItem {
  product: {
    _id: string;
    name: string;
    slug: string;
    images: { url: string; alt?: string }[];
    alcoholCategory?: string;
  };
  subproduct?: {
    _id: string;
    name?: string;
    size?: { name: string; volumeMl?: number };
  };
  size?: {
    _id: string;
    name: string;
    volumeMl?: number;
  };
  tenant?: {
    _id: string;
    name: string;
  };
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  discountAmount: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  discountTotal: number;
  coupon?: {
    code: string;
    discount: number;
  };
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  placedAt: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  billingAddress?: {
    fullName: string;
    addressLine1: string;
    city: string;
    state: string;
    country: string;
  };
  itemCount: number;
  notes?: string;
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: PiClock, label: 'Pending' },
  confirmed: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: PiCheckCircle, label: 'Confirmed' },
  processing: { color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: PiSparkle, label: 'Processing' },
  shipped: { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: PiTruck, label: 'Shipped' },
  delivered: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: PiCheckCircle, label: 'Delivered' },
  cancelled: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: PiX, label: 'Cancelled' },
};

const OrderDetails = () => {
  const params = useParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!params.id) return;

      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch(`http://localhost:5001/api/orders/${params.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch order');
        }

        setOrder(data.data.order);
      } catch (err: any) {
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    if (mounted && params.id) {
      fetchOrder();
    }
  }, [mounted, params.id, router]);

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getProductImage = (item: OrderItem) => {
    if (item.product?.images?.[0]?.url) return item.product.images[0].url;
    return null;
  };

  const getAlcoholIcon = (category?: string) => {
    if (!category) return null;
    const icons: Record<string, string> = {
      beer: '🍺',
      wine: '🍷',
      spirit: '🥃',
      liqueur: '🍸',
      cocktail_ready_to_drink: '🍹',
      non_alcoholic: '💧',
      cider: '🍎',
    };
    return icons[category.toLowerCase()] || '🍾';
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      return;
    }

    setCancelling(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/orders/${order._id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Cancelled by customer' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel order');
      }

      setOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin border-t-gray-900"></div>
          <p className="text-gray-500 animate-pulse">Loading order...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin border-t-gray-900"></div>
            <p className="text-gray-500 animate-pulse">Loading order details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <PiX size={48} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-500 mb-8">{error || 'The order you are looking for does not exist.'}</p>
          <Link href="/my-account/orders" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium">
            <PiArrowLeft size={18} /> Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const canCancel = ['pending', 'confirmed'].includes(order.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <PiArrowRight size={14} />
          <Link href="/my-account" className="hover:text-gray-900 transition-colors">My Account</Link>
          <PiArrowRight size={14} />
          <Link href="/my-account/orders" className="hover:text-gray-900 transition-colors">Orders</Link>
          <PiArrowRight size={14} />
          <span className="text-gray-900 font-medium">{order.orderNumber}</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              Order {order.orderNumber}
              {order.coupon && (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full flex items-center gap-1">
                  <PiTag size={14} /> {order.coupon.code}
                </span>
              )}
            </h1>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <PiCalendar size={14} />
              {formatDateTime(order.placedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              <PiPrinter size={18} /> Print
            </button>
            <Link href="/my-account/orders" className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              <PiArrowLeft size={18} /> Back
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${status.bg} ${status.color}`}>
                      <StatusIcon size={28} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-300">Order Status</p>
                      <p className="text-2xl font-bold">{status.label}</p>
                    </div>
                  </div>
                  {canCancel && (
                    <button
                      onClick={handleCancelOrder}
                      disabled={cancelling}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                    >
                      {cancelling ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <PiWarningCircle size={18} /> Cancel Order
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <PiPackage size={22} /> Order Items ({order.items.length})
                  </h2>
                  <span className="text-gray-500">{order.itemCount} items total</span>
                </div>

                <div className="space-y-4">
                  {order.items.map((item, idx) => {
                    const image = getProductImage(item);
                    return (
                      <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div className="w-24 h-24 rounded-xl overflow-hidden bg-white flex-shrink-0">
                          {image ? (
                            <Image
                              src={image}
                              alt={item.product?.name || 'Product'}
                              width={96}
                              height={96}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PiImage size={32} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Link href={`/product/${item.product?.slug}`} className="font-bold text-gray-900 hover:text-gray-700 truncate">
                              {item.product?.name}
                            </Link>
                            {getAlcoholIcon(item.product?.alcoholCategory) && (
                              <span className="text-xl" title={item.product?.alcoholCategory}>
                                {getAlcoholIcon(item.product?.alcoholCategory)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            {item.subproduct?.size?.name && (
                              <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">{item.subproduct.size.name}</span>
                            )}
                            {item.size?.name && !item.subproduct?.size?.name && (
                              <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">{item.size.name}</span>
                            )}
                            {item.tenant && (
                              <span className="flex items-center gap-1">
                                <PiUser size={12} /> {item.tenant.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-gray-500">Qty: {item.quantity} × {formatCurrency(item.priceAtPurchase, order.currency)}</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(item.itemSubtotal, order.currency)}</p>
                          {item.discountAmount > 0 && (
                            <p className="text-xs text-green-600 font-medium">Save {formatCurrency(item.discountAmount, order.currency)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <PiReceipt size={22} /> Order Notes
                </h2>
                <p className="text-gray-600">{order.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <PiMapPin size={22} /> Shipping Address
              </h2>
              <div className="space-y-1 text-gray-600">
                <p className="font-semibold text-gray-900 text-lg">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.addressLine1}</p>
                {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                <p>{order.shippingAddress.country}</p>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <PiPhone size={16} className="text-gray-400" />
                  <span className="text-gray-500">{order.shippingAddress.phone}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <PiCreditCard size={22} /> Payment Method
              </h2>
              <div className="space-y-3">
                <p className="font-semibold text-gray-900 capitalize text-lg">
                  {order.paymentMethod?.replace(/_/g, ' ') || 'Pending'}
                </p>
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 
                  order.paymentStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                  order.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </div>
                {order.billingAddress && (
                  <div className="pt-3 border-t border-gray-100 mt-3">
                    <p className="text-sm font-medium text-gray-500 mb-1">Billing Address</p>
                    <p className="text-gray-600">{order.billingAddress.addressLine1}</p>
                    <p className="text-gray-600">{order.billingAddress.city}, {order.billingAddress.state}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <PiReceipt size={22} /> Order Summary
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotal ({order.itemCount} items)</span>
                  <span>{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>-{formatCurrency(order.discountTotal, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-300">
                  <span>Shipping</span>
                  <span>{order.shippingFee === 0 ? 'FREE' : formatCurrency(order.shippingFee, order.currency)}</span>
                </div>
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-gray-300">
                    <span>Tax</span>
                    <span>{formatCurrency(order.taxAmount, order.currency)}</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-3 flex justify-between font-bold text-xl">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalAmount, order.currency)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href={`/order-tracking?orderId=${order._id}`}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium shadow-lg hover:shadow-xl"
              >
                <PiTruck size={20} /> Track Order
              </Link>
              <Link
                href={`/order-confirmation?orderId=${order._id}`}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                <PiReceipt size={20} /> View Receipt
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
