'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

const statusConfig: Record<string, { color: string; bg: string; icon: any }> = {
  pending: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: Icon.PiClockBold },
  processing: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Icon.PiPackageBold },
  shipped: { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Icon.PiTruckBold },
  delivered: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: Icon.PiCheckCircleBold },
  cancelled: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: Icon.PiXCircleBold },
  completed: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: Icon.PiCheckCircleBold },
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/my-account/orders');
      return;
    }

    const fetchOrders = async () => {
      try {
        const response = await fetch(`${API_URL}/api/orders/my-orders`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          setOrders(data.data?.orders || data.orders || []);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router]);

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter((o: any) => o.status?.toLowerCase() === filter);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-500 mt-1">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/my-account" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
            <Icon.PiArrowLeftBold /> Back to Account
          </Link>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-2 mb-6 overflow-x-auto pb-2"
        >
          {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                filter === status 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </motion.div>

        {filteredOrders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-lg p-12 text-center"
          >
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Icon.PiPackageBold className="w-20 h-20 mx-auto text-gray-300" />
            </motion.div>
            <h2 className="mt-6 text-xl font-bold text-gray-900">No orders found</h2>
            <p className="mt-2 text-gray-500">
              {filter === 'all' 
                ? "You haven't placed any orders yet." 
                : `No orders with status "${filter}"`}
            </p>
            <Link href="/shop" className="mt-6 inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl">
              Start Shopping <Icon.PiArrowRightBold />
            </Link>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order: any) => {
                const status = getStatusConfig(order.status);
                const StatusIcon = status.icon;
                
                return (
                  <motion.div
                    key={order._id}
                    variants={itemVariants}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -2 }}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden group"
                  >
                    <div className="p-4 md:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-gray-900 text-lg">
                              #{order.orderNumber || order._id?.slice(-8).toUpperCase()}
                            </h3>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {order.status || 'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(order.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-xl font-bold text-gray-900">
                            {order.currency || '₦'}{(order.total || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-3">
                            {order.items?.slice(0, 4).map((item: any, idx: number) => (
                              <div 
                                key={idx} 
                                className="w-14 h-14 rounded-xl bg-gray-100 border-2 border-white overflow-hidden relative"
                              >
                                {item.image || item.thumbImage?.[0] ? (
                                  <Image 
                                    src={item.image || item.thumbImage?.[0]} 
                                    alt={item.name || 'Product'} 
                                    fill 
                                    className="object-cover" 
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Icon.PiImageBold className="w-5 h-5 text-gray-300" />
                                  </div>
                                )}
                              </div>
                            ))}
                            {order.items?.length > 4 && (
                              <div className="w-14 h-14 rounded-xl bg-gray-100 border-2 border-white flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-500">+{order.items.length - 4}</span>
                              </div>
                            )}
                          </div>
                          
                          <Link 
                            href={`/order-tracking?orderId=${order._id}`}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
                          >
                            <Icon.PiMagnifyingGlassBold className="w-4 h-4" />
                            View Details
                          </Link>
                        </div>
                      </div>

                      {order.shipping?.address && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2 text-sm text-gray-500">
                          <Icon.PiMapPinBold className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="truncate">{order.shipping.address}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}