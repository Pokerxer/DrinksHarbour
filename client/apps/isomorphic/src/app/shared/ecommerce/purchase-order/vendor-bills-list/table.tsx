'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { vendorBillService, VendorBill, BillItem } from '@/services/vendorBill.service';
import { Badge, Button, Text, Tooltip, ActionIcon, Flex } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiPlusBold,
  PiEyeBold,
  PiPencilBold,
  PiCheckBold,
  PiMoneyBold,
  PiWarningBold,
  PiSparkle,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { routes } from '@/config/routes';

const statusColors: Record<string, 'warning' | 'info' | 'secondary' | 'success' | 'danger'> = {
  draft: 'warning',
  confirmed: 'info',
  paid: 'success',
  partial: 'secondary',
  overdue: 'danger',
  cancelled: 'danger',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

const matchingColors: Record<string, 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  matched: 'success',
  mismatch: 'danger',
  overreceived: 'info',
  underreceived: 'danger',
};

const matchingLabels: Record<string, string> = {
  pending: 'Pending',
  matched: 'Matched',
  mismatch: 'Mismatch',
  overreceived: 'Over-received',
  underreceived: 'Under-received',
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

export default function VendorBillsTable({ pageSize = 10 }: { pageSize?: number }) {
  const { data: session, status: sessionStatus } = useSession();
  
  const [allBills, setAllBills] = useState<VendorBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    billNumber: 120,
    vendor: 150,
    po: 100,
    items: 80,
    amount: 120,
    paid: 100,
    due: 100,
    status: 100,
    matching: 100,
    created: 100,
    actions: 100,
  });
  
  const resizingRef = useRef<{
    column: string;
    startX: number;
    startWidth: number;
  } | null>(null);

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
    const newWidth = Math.max(50, width);
    
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

  const fetchBills = useCallback(async (showToast = false) => {
    if (!session?.user?.token) return;

    setError(null);
    setIsRefreshing(showToast);

    try {
      const response = await vendorBillService.getVendorBills(session.user.token, {
        limit: 500,
      });

      if (response.success) {
        const bills = response.data || [];
        setAllBills(bills);
        
        if (showToast) {
          toast.success(`Loaded ${bills.length} vendor bills`, {
            icon: <PiSparkle className="w-5 h-5" />,
            style: { borderRadius: '12px', background: '#10b981', color: '#fff' },
          });
        }
      } else {
        setError('Failed to load vendor bills');
      }
    } catch (err: any) {
      console.error('Failed to fetch vendor bills:', err);
      const errorMessage = err.message || 'Failed to load vendor bills. Please check your network connection and try again.';
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
      fetchBills();
    } else if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
      setError('Please sign in to view vendor bills');
    }
  }, [sessionStatus, session?.user?.token, fetchBills]);

  const filteredBills = useMemo(() => {
    let filtered = allBills;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        bill =>
          bill.billNumber?.toLowerCase().includes(query) ||
          bill.vendorName?.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    return filtered;
  }, [allBills, searchQuery, statusFilter]);

  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBills.slice(start, start + pageSize);
  }, [filteredBills, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredBills.length / pageSize);

  const handleRefresh = useCallback(() => {
    fetchBills(true);
  }, [fetchBills]);

  const stats = useMemo(() => {
    return {
      total: allBills.length,
      draft: allBills.filter(b => b.status === 'draft').length,
      confirmed: allBills.filter(b => b.status === 'confirmed').length,
      partial: allBills.filter(b => b.status === 'partial').length,
      paid: allBills.filter(b => b.status === 'paid').length,
      overdue: allBills.filter(b => b.status === 'overdue').length,
      totalOutstanding: allBills.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0),
    };
  }, [allBills]);

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
          <Text className="text-red-500 mb-4 font-medium">Unable to Load Vendor Bills</Text>
          <Text className="text-gray-600 mb-6 text-sm">
            {error}
          </Text>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => fetchBills()} className="w-full sm:w-auto">
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
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Total Bills</Text>
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
          <Text className="text-gray-500 text-sm">Partial</Text>
          <Text className="text-2xl font-bold text-purple-600">{stats.partial}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Paid</Text>
          <Text className="text-2xl font-bold text-green-600">{stats.paid}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Overdue</Text>
          <Text className="text-2xl font-bold text-red-600">{stats.overdue}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Outstanding</Text>
          <Text className="text-2xl font-bold text-indigo-600">
            ${stats.totalOutstanding.toLocaleString()}
          </Text>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search bill number, vendor..."
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
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
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
        <Link href={routes.eCommerce.createVendorBill}>
          <Button>
            <PiPlusBold className="mr-2 h-4 w-4" />
            New Vendor Bill
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
                  style={{ width: `${columnWidths.billNumber}px`, minWidth: `${columnWidths.billNumber}px` }}
                >
                  Bill Number
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                    onMouseDown={(e) => handleMouseDown(e, 'billNumber')}
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
                  style={{ width: `${columnWidths.po}px`, minWidth: `${columnWidths.po}px` }}
                >
                  PO Reference
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                    onMouseDown={(e) => handleMouseDown(e, 'po')}
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
                  style={{ width: `${columnWidths.amount}px`, minWidth: `${columnWidths.amount}px` }}
                >
                  Total
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                    onMouseDown={(e) => handleMouseDown(e, 'amount')}
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                  style={{ width: `${columnWidths.paid}px`, minWidth: `${columnWidths.paid}px` }}
                >
                  Paid
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                    onMouseDown={(e) => handleMouseDown(e, 'paid')}
                  />
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-900 relative group"
                  style={{ width: `${columnWidths.due}px`, minWidth: `${columnWidths.due}px` }}
                >
                  Due Date
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                    onMouseDown={(e) => handleMouseDown(e, 'due')}
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
                  style={{ width: `${columnWidths.matching}px`, minWidth: `${columnWidths.matching}px` }}
                >
                  3-Way Match
                  <div 
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent group-hover:bg-blue-400"
                    onMouseDown={(e) => handleMouseDown(e, 'matching')}
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
              {paginatedBills.map((bill) => (
                <motion.tr
                  key={bill._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3" style={{ width: `${columnWidths.billNumber}px` }}>
                    <Text className="font-semibold text-gray-900 truncate">{bill.billNumber}</Text>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.vendor}px` }}>
                    <Text className="truncate">{bill.vendorName || '-'}</Text>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.po}px` }}>
                    <Text className="truncate">{bill.purchaseOrder || '-'}</Text>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.items}px` }}>
                    <Text>{bill.items?.length || 0} items</Text>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.amount}px` }}>
                    <Text className="font-semibold truncate">
                      {bill.currency} {bill.totalAmount.toLocaleString()}
                    </Text>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.paid}px` }}>
                    <Flex align="center" gap="2">
                      <PiMoneyBold className={`h-4 w-4 ${bill.paidAmount > 0 ? 'text-green-500' : 'text-gray-400'}`} />
                      <Text className={bill.paidAmount > 0 ? 'text-green-600' : ''}>
                        {bill.currency} {bill.paidAmount.toLocaleString()}
                      </Text>
                    </Flex>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.due}px` }}>
                    <Flex align="center" gap="2">
                      {bill.status === 'overdue' && (
                        <PiWarningBold className="h-4 w-4 text-red-500" />
                      )}
                      <Text className={bill.status === 'overdue' ? 'text-red-600' : ''}>
                        {bill.dueDate
                          ? new Date(bill.dueDate).toLocaleDateString()
                          : '-'}
                      </Text>
                    </Flex>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.status}px` }}>
                    <Badge variant="flat" color={statusColors[bill.status] || 'secondary'}>
                      {statusLabels[bill.status] || bill.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.matching}px` }}>
                    <Badge variant="flat" color={matchingColors[bill.matchingStatus] || 'secondary'}>
                      {matchingLabels[bill.matchingStatus] || bill.matchingStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.created}px` }}>
                    <Text>
                      {bill.createdAt
                        ? new Date(bill.createdAt).toLocaleDateString()
                        : '-'}
                    </Text>
                  </td>
                  <td className="px-4 py-3" style={{ width: `${columnWidths.actions}px` }}>
                    <Flex align="center" gap="2">
                      <Tooltip content="View Details">
                        <ActionIcon as="span" variant="text" size="sm">
                          <Link href={routes.eCommerce.vendorBillDetails(bill._id)}>
                            <PiEyeBold className="h-4 w-4" />
                          </Link>
                        </ActionIcon>
                      </Tooltip>
                      {bill.status === 'draft' && (
                        <Tooltip content="Edit">
                          <ActionIcon as="span" variant="text" size="sm">
                            <Link href={`${routes.eCommerce.createVendorBill}?id=${bill._id}`}>
                              <PiPencilBold className="h-4 w-4" />
                            </Link>
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {(bill.status === 'confirmed' || bill.status === 'partial') && (
                        <Tooltip content="Record Payment">
                          <ActionIcon as="span" variant="text" size="sm">
                            <Link href={`${routes.eCommerce.vendorBillDetails(bill._id)}?action=payment`}>
                              <PiMoneyBold className="h-4 w-4" />
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
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredBills.length)} of {filteredBills.length} bills
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
