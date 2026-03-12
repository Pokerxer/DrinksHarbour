'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { purchaseOrderService, PurchaseOrder, POItem } from '@/services/purchaseOrder.service';
import { Badge, Button, Text, Tooltip, ActionIcon, Flex } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiPlusBold,
  PiEyeBold,
  PiPencilBold,
  PiPackageBold,
  PiSparkle,
  PiPrinterBold,
  PiLockBold,
  PiLockOpenBold,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { routes } from '@/config/routes';

interface PurchaseOrderListItem extends PurchaseOrder {
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
}

const statusColors: Record<string, 'warning' | 'info' | 'secondary' | 'success' | 'danger'> = {
  draft: 'warning',
  confirmed: 'info',
  received: 'secondary',
  validated: 'success',
  cancelled: 'danger',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  received: 'Received',
  validated: 'Validated',
  cancelled: 'Cancelled',
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

export default function PurchaseOrdersTable({ pageSize = 10 }: { pageSize?: number }) {
  const { data: session, status: sessionStatus } = useSession();
  
  const [allOrders, setAllOrders] = useState<PurchaseOrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    poNumber: 120,
    vendor: 150,
    items: 100,
    quantity: 100,
    amount: 120,
    status: 100,
    expected: 120,
    created: 120,
    actions: 100,
  });
  
  const resizingRef = useRef<{
    column: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Handle mouse events for column resizing
  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column],
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    
    const { column, startX, startWidth } = resizingRef.current;
    const width = startWidth + (e.clientX - startX);
    const newWidth = Math.max(50, width); // Minimum width of 50px
    
    setColumnWidths(prev => ({
      ...prev,
      [column]: newWidth,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (resizingRef.current) {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [handleMouseMove]);

  const enrichOrders = useCallback((orders: PurchaseOrder[]): PurchaseOrderListItem[] => {
    return orders.map(order => {
      const totalItems = order.items?.length || 0;
      const totalQuantity = order.items?.reduce(
        (sum: number, item: POItem) => sum + (item.quantity || 0),
        0
      ) || 0;
      const totalAmount = order.items?.reduce(
        (sum: number, item: POItem) => sum + ((item.packPrice || 0) * (item.packQty || 1)),
        0
      ) || 0;
      
      return {
        ...order,
        totalItems,
        totalQuantity,
        totalAmount,
      } as PurchaseOrderListItem;
    });
  }, []);

  const fetchOrders = useCallback(async (showToast = false) => {
    if (!session?.user?.token) return;

    setError(null);
    setIsRefreshing(showToast);

    try {
      const response = await purchaseOrderService.getPurchaseOrders(session.user.token, {
        limit: 500,
      }) as { success: boolean; data?: PurchaseOrder[]; message?: string };

      if (response.success) {
        const orders = response.data || [];
        const enriched = enrichOrders(orders);
        setAllOrders(enriched);
        
        if (showToast) {
          toast.success(`Loaded ${orders.length} purchase orders`, {
            icon: <PiSparkle className="w-5 h-5" />,
            style: { borderRadius: '12px', background: '#10b981', color: '#fff' },
          });
        }
      } else {
        setError(response.message || 'Failed to load purchase orders');
      }
    } catch (err: any) {
      console.error('Failed to fetch purchase orders:', err);
      const errorMessage = err.message || 'Failed to load purchase orders. Please check your network connection and try again.';
      setError(errorMessage);
      
      // Don't show toast for auth expiration, the SessionHandler will redirect
      if (!errorMessage.includes('Authentication expired')) {
        toast.error(`Error: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session?.user?.token, enrichOrders]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.token) {
      fetchOrders();
    } else if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
      setError('Please sign in to view purchase orders');
    }
  }, [sessionStatus, session?.user?.token, fetchOrders]);

  const filteredOrders = useMemo(() => {
    let filtered = allOrders;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        order =>
          order.poNumber?.toLowerCase().includes(query) ||
          order.vendorName?.toLowerCase().includes(query) ||
          order.vendorReference?.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    return filtered;
  }, [allOrders, searchQuery, statusFilter]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  const handleRefresh = useCallback(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  const handleLockUnlock = useCallback(async (id: string, lock: boolean) => {
    try {
      const session = await getSession();
      if (!session?.user?.token) {
        toast.error('Authentication required');
        return;
      }

      if (lock) {
        const reason = prompt('Enter lock reason (optional):');
        await purchaseOrderService.lockPO(id, reason || '', session.user.token);
        toast.success('Purchase Order locked');
      } else {
        await purchaseOrderService.unlockPO(id, session.user.token);
        toast.success('Purchase Order unlocked');
      }
      fetchOrders(true);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${lock ? 'lock' : 'unlock'} PO`);
    }
  }, [fetchOrders]);

  const stats = useMemo(() => {
    return {
      total: allOrders.length,
      draft: allOrders.filter(o => o.status === 'draft').length,
      confirmed: allOrders.filter(o => o.status === 'confirmed').length,
      received: allOrders.filter(o => o.status === 'received').length,
      validated: allOrders.filter(o => o.status === 'validated').length,
      cancelled: allOrders.filter(o => o.status === 'cancelled').length,
    };
  }, [allOrders]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <Text className="text-red-500 mb-4 font-medium">Unable to Load Purchase Orders</Text>
          <Text className="text-gray-600 mb-6 text-sm">
            {error}
          </Text>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => fetchOrders()} className="w-full sm:w-auto">
              Retry
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="w-full sm:w-auto"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Total Orders</Text>
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
          <Text className="text-gray-500 text-sm">Confirmed</Text>
          <Text className="text-2xl font-bold text-blue-600">{stats.confirmed}</Text>
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
          <Text className="text-gray-500 text-sm">Validated</Text>
          <Text className="text-2xl font-bold text-green-600">{stats.validated}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Cancelled</Text>
          <Text className="text-2xl font-bold text-red-600">{stats.cancelled}</Text>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search PO number, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <option value="received">Received</option>
          <option value="validated">Validated</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button
          variant="outline"
          onClick={handleRefresh}
          isLoading={isRefreshing}
        >
          <PiArrowsClockwiseBold className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Link href={routes.eCommerce.createPurchase}>
          <Button>
            <PiPlusBold className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
        </Link>
      </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.poNumber}px`, minWidth: `${columnWidths.poNumber}px` }}
                  >
                    PO Number
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'poNumber')}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.vendor}px`, minWidth: `${columnWidths.vendor}px` }}
                  >
                    Vendor
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'vendor')}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.items}px`, minWidth: `${columnWidths.items}px` }}
                  >
                    Items
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'items')}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.quantity}px`, minWidth: `${columnWidths.quantity}px` }}
                  >
                    Total Qty
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'quantity')}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.amount}px`, minWidth: `${columnWidths.amount}px` }}
                  >
                    Total Amount
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'amount')}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px` }}
                  >
                    Status
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'status')}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.expected}px`, minWidth: `${columnWidths.expected}px` }}
                  >
                    Expected
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'expected')}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.created}px`, minWidth: `${columnWidths.created}px` }}
                  >
                    Created
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'created')}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                    style={{ width: `${columnWidths.actions}px`, minWidth: `${columnWidths.actions}px` }}
                  >
                    Actions
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                      onMouseDown={(e) => handleMouseDown(e, 'actions')}
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedOrders.map((order) => (
                  <motion.tr
                    key={order._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3" style={{ width: `${columnWidths.poNumber}px` }}>
                      <Text className="font-semibold text-gray-900 truncate">{order.poNumber}</Text>
                    </td>
                    <td className="px-4 py-3" style={{ width: `${columnWidths.vendor}px` }}>
                      <Text className="truncate">{order.vendorName || '-'}</Text>
                    </td>
                    <td className="px-4 py-3" style={{ width: `${columnWidths.items}px` }}>
                      <Flex align="center" gap="2">
                        <PiPackageBold className="h-4 w-4 text-gray-500" />
                        <Text>{order.totalItems} items</Text>
                      </Flex>
                    </td>
                    <td className="px-4 py-3" style={{ width: `${columnWidths.quantity}px` }}>
                      <Text>{order.totalQuantity.toLocaleString()}</Text>
                    </td>
                    <td className="px-4 py-3" style={{ width: `${columnWidths.amount}px` }}>
                      <Text className="font-semibold truncate">
                        {order.currency} {order.totalAmount.toLocaleString()}
                      </Text>
                    </td>
                    <td className="px-4 py-3" style={{ width: `${columnWidths.status}px` }}>
                      <Badge variant="flat" color={statusColors[order.status] || 'secondary'}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3" style={{ width: `${columnWidths.expected}px` }}>
                      <Text>
                        {order.expectedArrival
                          ? new Date(order.expectedArrival).toLocaleDateString()
                          : '-'}
                      </Text>
                    </td>
                    <td className="px-4 py-3" style={{ width: `${columnWidths.created}px` }}>
                      <Text>
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString()
                          : '-'}
                      </Text>
                    </td>
                    <td className="px-4 py-3" style={{ width: `${columnWidths.actions}px` }}>
                      <Flex align="center" gap="2">
                        <Tooltip content="View Details">
                          <ActionIcon as="span" variant="text" size="sm">
                            <Link href={routes.eCommerce.purchaseDetails(order._id)}>
                              <PiEyeBold className="h-4 w-4" />
                            </Link>
                          </ActionIcon>
                        </Tooltip>
                        {order.status === 'draft' && (
                          <Tooltip content="Edit">
                            <ActionIcon as="span" variant="text" size="sm">
                              <Link href={`${routes.eCommerce.createPurchase}?id=${order._id}`}>
                                <PiPencilBold className="h-4 w-4" />
                              </Link>
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {order.status === 'confirmed' && (
                          <Tooltip content="Receive">
                            <ActionIcon as="span" variant="text" size="sm">
                              <Link href={`${routes.eCommerce.receivePurchase}?id=${order._id}`}>
                                <PiPackageBold className="h-4 w-4" />
                              </Link>
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {order.status === 'received' && (
                          <Tooltip content="Validate">
                            <ActionIcon as="span" variant="text" size="sm">
                              <Link href={`${routes.eCommerce.validateReceipt}?id=${order._id}`}>
                                <PiSparkle className="h-4 w-4" />
                              </Link>
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip content="Print">
                          <ActionIcon as="span" variant="text" size="sm">
                            <Link href={`/ecommerce/purchases/receipt/${order._id}`} target="_blank">
                              <PiPrinterBold className="h-4 w-4" />
                            </Link>
                          </ActionIcon>
                        </Tooltip>
                        {(order.status === 'confirmed' || order.status === 'received' || order.status === 'validated') && !order.isLocked && (
                          <Tooltip content="Lock">
                            <ActionIcon 
                              as="span" 
                              variant="text" 
                              size="sm"
                              onClick={() => handleLockUnlock(order._id, true)}
                              className="cursor-pointer"
                            >
                              <PiLockBold className="h-4 w-4 text-orange-500" />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {order.isLocked && (
                          <Tooltip content="Unlock">
                            <ActionIcon 
                              as="span" 
                              variant="text" 
                              size="sm"
                              onClick={() => handleLockUnlock(order._id, false)}
                              className="cursor-pointer"
                            >
                              <PiLockOpenBold className="h-4 w-4 text-blue-500" />
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
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
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
