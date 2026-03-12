// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { purchaseAnalyticsService, PurchaseAnalyticsSummary, VendorAnalytics } from '@/services/purchaseAnalytics.service';
import { Button, Text, Flex, Badge } from 'rizzui';
import {
  PiArrowsClockwiseBold,
  PiPackage,
  PiCheckCircle,
  PiClock,
  PiWarningCircle,
  PiChartLine,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function PurchaseAnalyticsPage() {
  const { data: session, status: sessionStatus } = useSession();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<PurchaseAnalyticsSummary | null>(null);
  const [vendorData, setVendorData] = useState<VendorAnalytics[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  const fetchAnalytics = useCallback(async (showToast = false) => {
    if (!session?.user?.token) return;

    setIsRefreshing(showToast);
    try {
      const [summaryRes, vendorRes] = await Promise.all([
        purchaseAnalyticsService.getSummary(session.user.token, {
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
        purchaseAnalyticsService.getByVendor(session.user.token, {
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
      ]);

      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }
      if (vendorRes.success) {
        setVendorData(vendorRes.data);
      }

      if (showToast) {
        toast.success('Analytics refreshed');
      }
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      toast.error(err.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session?.user?.token, dateRange]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.token) {
      fetchAnalytics();
    }
  }, [sessionStatus, session?.user?.token, fetchAnalytics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Text className="text-2xl font-bold text-gray-900">Purchase Analytics</Text>
          <Text className="text-gray-500">Track your purchase performance and vendor activity</Text>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <Button variant="outline" onClick={() => fetchAnalytics(true)} isLoading={isRefreshing}>
            <PiArrowsClockwiseBold className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {summary && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
            >
              <Flex align="center" gap="2" className="mb-2">
                <PiPackage className="h-5 w-5 text-gray-500" />
                <Text className="text-gray-500 text-sm">Total POs</Text>
              </Flex>
              <Text className="text-3xl font-bold text-gray-900">{summary.totalPOs}</Text>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
            >
              <Flex align="center" gap="2" className="mb-2">
                <PiChartLine className="h-5 w-5 text-gray-500" />
                <Text className="text-gray-500 text-sm">Total Spend</Text>
              </Flex>
              <Text className="text-3xl font-bold text-blue-600">
                ${summary.totalAmount.toLocaleString()}
              </Text>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
            >
              <Flex align="center" gap="2" className="mb-2">
                <PiClock className="h-5 w-5 text-gray-500" />
                <Text className="text-gray-500 text-sm">Pending Approvals</Text>
              </Flex>
              <Text className="text-3xl font-bold text-amber-600">{summary.pendingApprovals}</Text>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
            >
              <Flex align="center" gap="2" className="mb-2">
                <PiCheckCircle className="h-5 w-5 text-gray-500" />
                <Text className="text-gray-500 text-sm">Validated</Text>
              </Flex>
              <Text className="text-3xl font-bold text-green-600">{summary.statusBreakdown?.validated || 0}</Text>
            </motion.div>
          </div>

          {/* Status & Approval Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Status Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <Text className="text-lg font-semibold mb-4">PO Status Breakdown</Text>
              <div className="space-y-3">
                {Object.entries(summary.statusBreakdown || {}).map(([status, count]) => (
                  <Flex key={status} justify="between" align="center" className="p-3 bg-gray-50 rounded-lg">
                    <Text className="capitalize">{status}</Text>
                    <Badge variant="flat" color={
                      status === 'validated' ? 'success' :
                      status === 'confirmed' ? 'info' :
                      status === 'received' ? 'primary' :
                      status === 'cancelled' ? 'danger' : 'warning'
                    }>
                      {count}
                    </Badge>
                  </Flex>
                ))}
              </div>
            </div>

            {/* Approval Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <Text className="text-lg font-semibold mb-4">Approval Status</Text>
              <div className="space-y-3">
                {Object.entries(summary.approvalBreakdown || {}).map(([status, count]) => (
                  <Flex key={status} justify="between" align="center" className="p-3 bg-gray-50 rounded-lg">
                    <Text className="capitalize">{status}</Text>
                    <Badge variant="flat" color={
                      status === 'approved' ? 'success' :
                      status === 'rejected' ? 'danger' : 'warning'
                    }>
                      {count}
                    </Badge>
                  </Flex>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          {summary.monthlyTrend && summary.monthlyTrend.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
              <Text className="text-lg font-semibold mb-4">Monthly Trend</Text>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Month</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Orders</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {summary.monthlyTrend.map((month) => (
                      <tr key={month.month} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{month.month}</td>
                        <td className="px-4 py-3 text-right">{month.count}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${month.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Size Breakdown */}
          {summary.sizeBreakdown && summary.sizeBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
              <Text className="text-lg font-semibold mb-4">Purchases by Size</Text>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Size</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantity</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Orders</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {summary.sizeBreakdown.map((size) => (
                      <tr key={size.sizeName} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{size.sizeName}</td>
                        <td className="px-4 py-3 text-right">{size.totalQuantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{size.orderCount}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${size.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Products with Size */}
          {summary.topProducts && summary.topProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
              <Text className="text-lg font-semibold mb-4">Top Products (by Size)</Text>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Size</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantity</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {summary.topProducts.slice(0, 15).map((product, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{product.productName}</td>
                        <td className="px-4 py-3">{product.sizeName || 'Default'}</td>
                        <td className="px-4 py-3 text-right">{product.totalQuantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${product.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Vendors */}
          {vendorData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <Text className="text-lg font-semibold mb-4">Vendor Performance</Text>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Vendor</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Orders</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantity</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total Spend</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Validated</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vendorData.slice(0, 10).map((vendor) => (
                      <tr key={vendor.vendorName} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{vendor.vendorName}</td>
                        <td className="px-4 py-3 text-right">{vendor.totalOrders}</td>
                        <td className="px-4 py-3 text-right">{vendor.totalQuantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${vendor.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="flat" color="success">{vendor.validated}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="flat" color="warning">{vendor.pending}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
