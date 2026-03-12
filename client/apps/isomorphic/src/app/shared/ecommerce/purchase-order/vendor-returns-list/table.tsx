'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { vendorReturnService, VendorReturn } from '@/services/vendorReturn.service';
import { Badge, Button, Text, Tooltip, ActionIcon, Flex } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiEyeBold,
  PiPencilBold,
  PiSparkle,
  PiArrowUUpLeftBold,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { routes } from '@/config/routes';

const statusColors: Record<string, 'warning' | 'info' | 'secondary' | 'success' | 'danger'> = {
  draft: 'warning',
  confirmed: 'info',
  requested: 'info',
  shipped: 'info',
  in_transit: 'secondary',
  received: 'success',
  refunded: 'success',
  rejected: 'danger',
  cancelled: 'danger',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  requested: 'Requested',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  received: 'Received',
  refunded: 'Refunded',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const refundStatusColors: Record<string, 'warning' | 'info' | 'success' | 'danger'> = {
  none: 'secondary',
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  rejected: 'danger',
};

const refundStatusLabels: Record<string, string> = {
  none: 'N/A',
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  rejected: 'Rejected',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-1/4 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function VendorReturnsTable({ pageSize = 10 }: { pageSize?: number }) {
  const { data: session, status: sessionStatus } = useSession();
  
  const [allReturns, setAllReturns] = useState<VendorReturn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchReturns = useCallback(async (showToast = false) => {
    if (!session?.user?.token) return;

    setError(null);
    setIsRefreshing(showToast);

    try {
      const response = await vendorReturnService.getVendorReturns(session.user.token, {
        limit: 500,
      });

      if (response.success) {
        const returns = response.data || [];
        setAllReturns(returns);
        
        if (showToast) {
          toast.success(`Loaded ${returns.length} returns`, {
            icon: <PiSparkle className="w-5 h-5" />,
            style: { borderRadius: '12px', background: '#10b981', color: '#fff' },
          });
        }
      } else {
        setError('Failed to load vendor returns');
      }
    } catch (err: any) {
      console.error('Failed to fetch vendor returns:', err);
      const errorMessage = err.message || 'Failed to load vendor returns';
      setError(errorMessage);
      
      if (!errorMessage.includes('Authentication expired')) {
        toast.error(`Error: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session?.user?.token]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.token) {
      fetchReturns();
    } else if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
      setError('Please sign in to view returns');
    }
  }, [sessionStatus, session?.user?.token, fetchReturns]);

  const filteredReturns = useMemo(() => {
    let filtered = allReturns;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        ret =>
          ret.returnNumber?.toLowerCase().includes(query) ||
          ret.vendorName?.toLowerCase().includes(query) ||
          ret.poNumber?.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(ret => ret.status === statusFilter);
    }

    return filtered;
  }, [allReturns, searchQuery, statusFilter]);

  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [filteredReturns, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredReturns.length / pageSize);

  const handleRefresh = useCallback(() => {
    fetchReturns(true);
  }, [fetchReturns]);

  const stats = useMemo(() => {
    return {
      total: allReturns.length,
      draft: allReturns.filter(r => r.status === 'draft').length,
      pending: allReturns.filter(r => ['confirmed', 'requested', 'shipped', 'in_transit'].includes(r.status)).length,
      received: allReturns.filter(r => r.status === 'received').length,
      refunded: allReturns.filter(r => r.status === 'refunded').length,
      totalRefundAmount: allReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0),
    };
  }, [allReturns]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="text-center max-w-md">
          <Text className="text-red-500 mb-4 font-medium">Unable to Load Returns</Text>
          <Text className="text-gray-600 mb-6 text-sm">{error}</Text>
          <Button onClick={() => fetchReturns()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Total Returns</Text>
          <Text className="text-2xl font-bold text-gray-900">{stats.total}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Draft</Text>
          <Text className="text-2xl font-bold text-amber-600">{stats.draft}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">In Progress</Text>
          <Text className="text-2xl font-bold text-blue-600">{stats.pending}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Received</Text>
          <Text className="text-2xl font-bold text-purple-600">{stats.received}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Refunded</Text>
          <Text className="text-2xl font-bold text-green-600">{stats.refunded}</Text>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search return number, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="requested">Requested</option>
          <option value="shipped">Shipped</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button variant="outline" onClick={handleRefresh} isLoading={isRefreshing}>
          <PiArrowsClockwiseBold className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Link href={routes.eCommerce.createVendorReturn}>
          <Button>
            <PiPlusBold className="mr-2 h-4 w-4" />
            New Return
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Return #</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">PO Reference</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Vendor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Items</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Refund</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedReturns.map((ret) => (
                <motion.tr
                  key={ret._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Text className="font-semibold text-gray-900">{ret.returnNumber}</Text>
                  </td>
                  <td className="px-4 py-3">
                    <Text className="truncate">{ret.poNumber || '-'}</Text>
                  </td>
                  <td className="px-4 py-3">
                    <Text className="truncate">{ret.vendorName || '-'}</Text>
                  </td>
                  <td className="px-4 py-3">
                    <Text>{ret.items?.length || 0} items</Text>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Text className="font-semibold">
                      {ret.currency} {ret.totalAmount.toLocaleString()}
                    </Text>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="flat" color={statusColors[ret.status] || 'secondary'}>
                      {statusLabels[ret.status] || ret.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Flex align="center" gap="2">
                      <Badge variant="flat" color={refundStatusColors[ret.refundStatus] || 'secondary'}>
                        {refundStatusLabels[ret.refundStatus] || ret.refundStatus}
                      </Badge>
                      {ret.refundAmount > 0 && (
                        <Text className="text-sm text-gray-500">
                          ({ret.currency} {ret.refundAmount.toLocaleString()})
                        </Text>
                      )}
                    </Flex>
                  </td>
                  <td className="px-4 py-3">
                    <Text>
                      {ret.returnDate ? new Date(ret.returnDate).toLocaleDateString() : '-'}
                    </Text>
                  </td>
                  <td className="px-4 py-3">
                    <Flex align="center" gap="2">
                      <Tooltip content="View Details">
                        <ActionIcon as="span" variant="text" size="sm">
                          <Link href={routes.eCommerce.vendorReturnDetails(ret._id)}>
                            <PiEyeBold className="h-4 w-4" />
                          </Link>
                        </ActionIcon>
                      </Tooltip>
                      {ret.status === 'draft' && (
                        <Tooltip content="Edit">
                          <ActionIcon as="span" variant="text" size="sm">
                            <Link href={`${routes.eCommerce.createVendorReturn}?id=${ret._id}`}>
                              <PiPencilBold className="h-4 w-4" />
                            </Link>
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Flex>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Text className="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredReturns.length)} of {filteredReturns.length} returns
          </Text>
          <Flex gap="2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <Button
                key={page}
                variant={page === currentPage ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </Flex>
        </div>
      )}
    </div>
  );
}
