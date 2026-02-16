'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  PiPackage, 
  PiClock, 
  PiTruck, 
  PiCheckCircle, 
  PiShoppingCart, 
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
  PiEye,
  PiPhone,
  PiSparkle,
  PiWarningCircle,
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
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: PiClock, label: 'Pending' },
  confirmed: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: PiCheckCircle, label: 'Confirmed' },
  processing: { color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: PiSparkle, label: 'Processing' },
  shipped: { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: PiTruck, label: 'Shipped' },
  delivered: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: PiCheckCircle, label: 'Delivered' },
  cancelled: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: PiX, label: 'Cancelled' },
};

const paymentStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Pending' },
  paid: { color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Paid' },
  failed: { color: 'text-red-700', bg: 'bg-red-100', label: 'Failed' },
  refunded: { color: 'text-gray-700', bg: 'bg-gray-100', label: 'Refunded' },
};

const MyOrders = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOrders, setActiveOrders] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('http://localhost:5001/api/orders/my-orders', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch orders');
        }

        setOrders(data.data.orders || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    if (mounted) {
      fetchOrders();
    }
  }, [mounted, router]);

  const filteredOrders = activeOrders === 'all' 
    ? orders 
    : orders.filter(order => order.status === activeOrders);

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
    }).format(amount);
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

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      return;
    }

    setCancellingId(orderId);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/orders/${orderId}/cancel`, {
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

      setOrders(prev => prev.map(order => 
        order._id === orderId ? { ...order, status: 'cancelled' } : order
      ));
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin border-t-gray-900"></div>
          </div>
          <p className="text-gray-500 animate-pulse">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-gray-900">Home</Link>
          <PiArrowRight size={14} />
          <span>My Account</span>
          <PiArrowRight size={14} />
          <span>Orders</span>
        </div>
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin border-t-gray-900"></div>
            <p className="text-gray-500 animate-pulse">Loading your orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <PiArrowRight size={14} />
          <span>My Account</span>
          <PiArrowRight size={14} />
          <span className="text-gray-900 font-medium">Orders</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-500 mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''} placed</p>
          </div>
          <Link href="/my-account" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium">
            <PiArrowLeft size={18} /> Back to Account
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'All Orders', value: orderStats.total, icon: PiPackage, color: 'gray' },
            { label: 'Pending', value: orderStats.pending, icon: PiClock, color: 'amber' },
            { label: 'In Progress', value: orderStats.processing, icon: PiSparkle, color: 'blue' },
            { label: 'Shipped', value: orderStats.shipped, icon: PiTruck, color: 'purple' },
            { label: 'Delivered', value: orderStats.delivered, icon: PiCheckCircle, color: 'emerald' },
          ].map((stat) => {
            const Icon = stat.icon;
            const colorClasses: Record<string, string> = {
              gray: 'from-gray-500 to-gray-600',
              amber: 'from-amber-500 to-amber-600',
              blue: 'from-blue-500 to-blue-600',
              purple: 'from-purple-500 to-purple-600',
              emerald: 'from-emerald-500 to-emerald-600',
            };
            return (
              <button
                key={stat.label}
                onClick={() => setActiveOrders(stat.label.toLowerCase() === 'in progress' ? 'processing' : stat.label.toLowerCase())}
                className={`relative overflow-hidden bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md hover:-translate-y-0.5 text-left ${
                  activeOrders === (stat.label.toLowerCase() === 'in progress' ? 'processing' : stat.label.toLowerCase()) 
                    ? 'ring-2 ring-gray-900 border-gray-900' 
                    : 'border-gray-100'
                }`}
              >
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${colorClasses[stat.color]} opacity-10 rounded-bl-full`}></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl font-bold text-gray-900">{stat.value}</span>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[stat.color]} flex items-center justify-center`}>
                    <Icon size={20} className="text-white" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => {
            const isActive = activeOrders === status;
            const config = statusConfig[status];
            return (
              <button
                key={status}
                onClick={() => setActiveOrders(status)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {status === 'all' ? 'All Orders' : config?.label || status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl mb-6 flex items-center gap-3">
            <PiX className="text-red-500" size={20} />
            {error}
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
              <PiShoppingCart size={48} className="text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {activeOrders === 'all' ? 'No Orders Yet' : `No ${statusConfig[activeOrders]?.label || activeOrders} Orders`}
            </h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              {activeOrders === 'all' 
                ? "You haven't placed any orders yet. Start shopping to see your orders here." 
                : `You don't have any ${statusConfig[activeOrders]?.label || activeOrders} orders at the moment.`}
            </p>
            <Link href="/shop" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Start Shopping <PiArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const paymentStatus = paymentStatusConfig[order.paymentStatus] || paymentStatusConfig.pending;
              const StatusIcon = status.icon;
              const canCancel = ['pending', 'confirmed'].includes(order.status);
              
              return (
                <div key={order._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
                  <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-5">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Order Number</p>
                          <p className="font-bold text-gray-900">{order.orderNumber}</p>
                        </div>
                        <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
                        <div className="flex items-center gap-2">
                          <PiCalendar size={16} className="text-gray-400" />
                          <span className="text-gray-600">{formatDate(order.placedAt)}</span>
                        </div>
                        <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-lg">{getAlcoholIcon(order.items[0]?.product?.alcoholCategory)}</span>
                          </div>
                          <span className="text-gray-600">{order.itemCount} item{order.itemCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${paymentStatus.bg} ${paymentStatus.color}`}>
                          {paymentStatus.label}
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${status.bg} ${status.color}`}>
                          <StatusIcon size={14} />
                          {status.label}
                        </div>
                        <p className="font-bold text-xl text-gray-900 ml-2">{formatCurrency(order.totalAmount, order.currency)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex flex-wrap gap-3">
                      {order.items.slice(0, 5).map((item, idx) => {
                        const image = getProductImage(item);
                        return (
                          <div key={idx} className="relative group">
                            <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden border-2 border-transparent group-hover:border-gray-200 transition-all">
                              {image ? (
                                <Image
                                  src={image}
                                  alt={item.product?.name || 'Product'}
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <PiImage size={24} className="text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-bold shadow-lg">
                              {item.quantity}
                            </div>
                            {getAlcoholIcon(item.product?.alcoholCategory) && (
                              <div className="absolute -top-1 -right-1 text-lg filter drop-shadow-lg">
                                {getAlcoholIcon(item.product?.alcoholCategory)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {order.items.length > 5 && (
                        <div className="w-20 h-20 rounded-xl bg-gray-100 flex flex-col items-center justify-center border-2 border-dashed border-gray-300">
                          <PiEye size={20} className="text-gray-500 mb-1" />
                          <span className="text-xs text-gray-600 font-medium">+{order.items.length - 5} more</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <Link
                          href={`/order-tracking?orderId=${order._id}`}
                          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <PiTruck size={16} />
                          </div>
                          Track Order
                        </Link>
                        <Link
                          href={`/order-confirmation?orderId=${order._id}`}
                          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <PiReceipt size={16} />
                          </div>
                          View Receipt
                        </Link>
                        <Link
                          href={`/my-account/orders/${order._id}`}
                          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium text-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <PiPackage size={16} />
                          </div>
                          View Details
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        {canCancel && (
                          <button
                            onClick={() => handleCancelOrder(order._id)}
                            disabled={cancellingId === order._id}
                            className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                          >
                            {cancellingId === order._id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                                Cancelling...
                              </>
                            ) : (
                              <>
                                <PiWarningCircle size={16} />
                                Cancel Order
                              </>
                            )}
                          </button>
                        )}
                        {order.status === 'delivered' && (
                          <button className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm">
                            Write Review
                          </button>
                        )}
                        <Link
                          href={`/my-account/orders/${order._id}`}
                          className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all font-medium text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
                        >
                          View Order <PiArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
