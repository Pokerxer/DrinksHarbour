'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { vendorBillService, VendorBill, BillItem, Payment } from '@/services/vendorBill.service';
import { vendorReturnService } from '@/services/vendorReturn.service';
import { Button, Input, Text, Textarea, Flex, Badge, Modal } from 'rizzui';
import {
  PiArrowLeft,
  PiArrowsClockwiseBold,
  PiCheckCircle,
  PiMoneyBold,
  PiWarningCircle,
  PiPencil,
  PiTrash,
  PiDownload,
  PiArrowUUpLeft,
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
  partial: 'Partial Payment',
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
  pending: 'Pending Validation',
  matched: 'Matched',
  mismatch: 'Mismatch Found',
  overreceived: 'Over-received',
  underreceived: 'Under-received',
};

export default function VendorBillDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    method: 'cash',
    reference: '',
    notes: '',
  });

  const billId = params?.id as string;

  const fetchBill = useCallback(async (showToast = false) => {
    if (!session?.user?.token || !billId) return;

    setIsRefreshing(showToast);
    try {
      const response = await vendorBillService.getVendorBill(billId, session.user.token);
      
      if (response.success) {
        setBill(response.data);
        const remainingAmount = response.data.totalAmount - response.data.paidAmount;
        setPaymentData(prev => ({ ...prev, amount: remainingAmount > 0 ? remainingAmount : 0 }));
      } else {
        toast.error('Failed to load vendor bill');
      }
    } catch (err: any) {
      console.error('Failed to fetch vendor bill:', err);
      toast.error(err.message || 'Failed to load vendor bill');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session?.user?.token, billId]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.token && billId) {
      fetchBill();
    }
  }, [sessionStatus, session?.user?.token, billId, fetchBill]);

  useEffect(() => {
    if (searchParams.get('action') === 'payment') {
      setShowPaymentModal(true);
    }
  }, [searchParams]);

  const handleRecordPayment = async () => {
    if (!session?.user?.token || !billId) return;

    setIsRecordingPayment(true);
    try {
      const response = await vendorBillService.recordPayment(billId, paymentData, session.user.token);
      
      if (response.success) {
        toast.success('Payment recorded successfully');
        setShowPaymentModal(false);
        fetchBill();
      } else {
        toast.error(response.message || 'Failed to record payment');
      }
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleValidateBill = async (override?: string) => {
    if (!session?.user?.token || !billId) return;

    try {
      const response = await vendorBillService.validateBill(billId, session.user.token, override);
      
      if (response.success) {
        toast.success('Bill validated successfully');
        fetchBill();
      } else {
        toast.error(response.message || 'Failed to validate bill');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to validate bill');
    }
  };

  const handleDelete = async () => {
    if (!session?.user?.token || !billId) return;

    if (!confirm('Are you sure you want to delete this vendor bill?')) return;

    try {
      const response = await vendorBillService.deleteVendorBill(billId, session.user.token);
      
      if (response.success) {
        toast.success('Vendor bill deleted');
        router.push(routes.eCommerce.vendorBills);
      } else {
        toast.error(response.message || 'Failed to delete vendor bill');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete vendor bill');
    }
  };

  const handleCreateReturn = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }

    const reason = prompt('Enter return reason (e.g., damaged, defective, expired, wrong_item, over_supplied):');
    if (!reason) return;

    try {
      // Convert bill items to return items
      const returnItems = bill.items.map(item => ({
        subProductId: item.subProductId,
        subProductName: item.subProductName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        reason,
        condition: 'other' as const,
      }));

      const response = await vendorReturnService.createReturnFromBill(
        billId,
        returnItems,
        reason,
        session.user.token
      );

      toast.success('Vendor return created successfully!');
      router.push(`/ecommerce/purchases/returns/${response.data._id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create vendor return');
    }
  };

  const stats = useMemo(() => {
    if (!bill) return { totalItems: 0, subtotal: 0, taxAmount: 0 };
    
    const totalItems = bill.items?.length || 0;
    const subtotal = bill.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
    const taxAmount = bill.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate / 100), 0) || 0;
    const remainingAmount = bill.totalAmount - bill.paidAmount;
    
    return { totalItems, subtotal, taxAmount, remainingAmount };
  }, [bill]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Text className="text-gray-500 mb-4">Vendor bill not found</Text>
        <Link href={routes.eCommerce.vendorBills}>
          <Button>Back to Vendor Bills</Button>
        </Link>
      </div>
    );
  }

  const canRecordPayment = bill.status === 'confirmed' || bill.status === 'partial';
  const canValidate = bill.status === 'confirmed' && bill.matchingStatus === 'pending';
  const canEdit = bill.status === 'draft';
  const canDelete = bill.status === 'draft';

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href={routes.eCommerce.vendorBills}>
            <Button variant="text" size="sm">
              <PiArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <Flex align="center" gap="3">
              <Text className="text-2xl font-bold text-gray-900">{bill.billNumber}</Text>
              <Badge variant="flat" color={statusColors[bill.status]}>
                {statusLabels[bill.status] || bill.status}
              </Badge>
            </Flex>
            <Text className="text-gray-500">Vendor Bill Details</Text>
          </div>
        </div>
        <Flex gap="3">
          <Button variant="outline" onClick={() => fetchBill(true)} isLoading={isRefreshing}>
            <PiArrowsClockwiseBold className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {canRecordPayment && (
            <Button onClick={() => setShowPaymentModal(true)}>
              <PiMoneyBold className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
          {canValidate && (
            <Button onClick={() => handleValidateBill()}>
              <PiCheckCircle className="mr-2 h-4 w-4" />
              Validate Bill
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" onClick={handleDelete} className="text-red-600 border-red-300 hover:bg-red-50">
              <PiTrash className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={handleCreateReturn}>
            <PiArrowUUpLeft className="mr-2 h-4 w-4" />
            Create Return
          </Button>
        </Flex>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Total Amount</Text>
          <Text className="text-2xl font-bold text-gray-900">{bill.currency} {bill.totalAmount.toLocaleString()}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Paid Amount</Text>
          <Text className="text-2xl font-bold text-green-600">{bill.currency} {bill.paidAmount.toLocaleString()}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Remaining</Text>
          <Text className="text-2xl font-bold text-blue-600">{bill.currency} {stats.remainingAmount.toLocaleString()}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Due Date</Text>
          <Text className="text-2xl font-bold text-gray-900">
            {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '-'}
          </Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">3-Way Match</Text>
          <Badge variant="flat" color={matchingColors[bill.matchingStatus]} className="mt-1">
            {matchingLabels[bill.matchingStatus] || bill.matchingStatus}
          </Badge>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bill Items */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <Text className="text-lg font-semibold mb-4">Bill Items</Text>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Size</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Qty</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Tax %</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bill.items?.map((item, index) => (
                    <motion.tr
                      key={item.subProductId || index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <Text className="font-medium">{item.subProductName}</Text>
                        <Text className="text-xs text-gray-500">{item.sku}</Text>
                      </td>
                      <td className="px-4 py-3">{item.sizeName || '-'}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{bill.currency} {item.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{item.taxRate}%</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {bill.currency} {item.amount.toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-medium">Subtotal</td>
                    <td className="px-4 py-3 text-right font-medium">{bill.currency} {stats.subtotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-medium">Tax</td>
                    <td className="px-4 py-3 text-right font-medium">{bill.currency} {stats.taxAmount.toLocaleString()}</td>
                  </tr>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={5} class="px-4 py-3 text-right font-bold text-lg">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-lg">{bill.currency} {bill.totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payments History */}
          {bill.payments && bill.payments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <Text className="text-lg font-semibold mb-4">Payment History</Text>
              
              <div className="space-y-3">
                {bill.payments.map((payment, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div>
                      <Text className="font-medium">{bill.currency} {payment.amount.toLocaleString()}</Text>
                      <Text className="text-sm text-gray-500">
                        {payment.date ? new Date(payment.date).toLocaleDateString() : 'No date'}
                        {payment.method && ` • ${payment.method}`}
                        {payment.reference && ` • Ref: ${payment.reference}`}
                      </Text>
                    </div>
                    <Badge variant="flat" color="success">
                      Paid
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* 3-Way Matching Details */}
          {bill.matchingDetails && bill.matchingStatus !== 'pending' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <Flex justify="between" align="center" className="mb-4">
                <Text className="text-lg font-semibold">3-Way Matching Details</Text>
                <Badge variant="flat" color={
                  bill.shouldBePaid === 'yes' ? 'success' :
                  bill.shouldBePaid === 'exception' ? 'warning' : 'danger'
                }>
                  Should Pay: {bill.shouldBePaid?.toUpperCase() || 'PENDING'}
                </Badge>
              </Flex>
              
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Text className="text-sm text-gray-500">PO Ordered</Text>
                  <Text className="font-semibold">{bill.poOrderedQty || 0} units</Text>
                </div>
                <div>
                  <Text className="text-sm text-gray-500">PO Received</Text>
                  <Text className="font-semibold">{bill.poReceivedQty || 0} units</Text>
                </div>
                <div>
                  <Text className="text-sm text-gray-500">Bill Qty</Text>
                  <Text className="font-semibold">{bill.billQty || 0} units</Text>
                </div>
              </div>

              {/* Size Breakdown */}
              {bill.matchingDetails.sizeBreakdown && Object.keys(bill.matchingDetails.sizeBreakdown).length > 0 && (
                <div className="mb-6">
                  <Text className="font-semibold mb-2">By Size:</Text>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Size</th>
                        <th className="px-3 py-2 text-right">Bill Qty</th>
                        <th className="px-3 py-2 text-right">PO Ordered</th>
                        <th className="px-3 py-2 text-right">PO Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(bill.matchingDetails.sizeBreakdown).map((size: any, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{size.sizeName}</td>
                          <td className="px-3 py-2 text-right">{size.billQty}</td>
                          <td className="px-3 py-2 text-right">{size.poOrderedQty}</td>
                          <td className="px-3 py-2 text-right">{size.poReceivedQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Item Comparisons */}
              {bill.matchingDetails.itemComparisons && bill.matchingDetails.itemComparisons.length > 0 && (
                <div>
                  <Text className="font-semibold mb-2">Item Details:</Text>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-left">Size</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2 text-right">Bill</th>
                          <th className="px-3 py-2 text-right">PO Ordered</th>
                          <th className="px-3 py-2 text-right">PO Received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.matchingDetails.itemComparisons.map((item: any, idx) => (
                          <tr key={idx} className={`border-t ${
                            item.status === 'matched' ? '' : 
                            item.status === 'extra_in_bill' ? 'bg-red-50' :
                            item.status === 'missing_in_bill' ? 'bg-amber-50' :
                            'bg-red-50'
                          }`}>
                            <td className="px-3 py-2">{item.subProductName}</td>
                            <td className="px-3 py-2">{item.sizeName || '-'}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant="flat" color={
                                item.status === 'matched' ? 'success' : 'danger'
                              }>
                                {item.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right">{item.billQty}</td>
                            <td className="px-3 py-2 text-right">{item.poOrderedQty}</td>
                            <td className="px-3 py-2 text-right">{item.poReceivedQty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Variance Notes */}
              {bill.matchingDetails.varianceReason && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <Text className="text-sm text-amber-800">
                    <strong>Note:</strong> {bill.matchingDetails.varianceReason}
                  </Text>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Bill Information */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <Text className="text-lg font-semibold mb-4">Bill Information</Text>
            
            <div className="space-y-4">
              <div>
                <Text className="text-sm text-gray-500">Vendor</Text>
                <Text className="font-medium">{bill.vendorName}</Text>
              </div>
              {bill.purchaseOrder && (
                <div>
                  <Text className="text-sm text-gray-500">Linked PO</Text>
                  <Link href={routes.eCommerce.purchaseDetails(bill.purchaseOrder)}>
                    <Text className="font-medium text-blue-600 hover:underline">{bill.purchaseOrder}</Text>
                  </Link>
                </div>
              )}
              <div>
                <Text className="text-sm text-gray-500">Vendor Reference</Text>
                <Text className="font-medium">{bill.vendorReference || '-'}</Text>
              </div>
              <div>
                <Text className="text-sm text-gray-500">Bill Date</Text>
                <Text className="font-medium">
                  {bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '-'}
                </Text>
              </div>
              <div>
                <Text className="text-sm text-gray-500">Due Date</Text>
                <Text className="font-medium">
                  {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '-'}
                </Text>
              </div>
              {bill.notes && (
                <div>
                  <Text className="text-sm text-gray-500">Notes</Text>
                  <Text className="font-medium">{bill.notes}</Text>
                </div>
              )}
            </div>
          </div>

          {/* Matching Status */}
          {bill.matchingStatus && bill.matchingStatus !== 'pending' && (
            <div className={`rounded-xl border p-6 ${
              bill.matchingStatus === 'matched' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <Flex align="center" gap="2" className="mb-2">
                {bill.matchingStatus === 'matched' ? (
                  <PiCheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <PiWarningCircle className="h-5 w-5 text-red-600" />
                )}
                <Text className={`font-semibold ${
                  bill.matchingStatus === 'matched' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {matchingLabels[bill.matchingStatus]}
                </Text>
              </Flex>
              {bill.matchingNotes && (
                <Text className="text-sm text-gray-600">{bill.matchingNotes}</Text>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)}>
        <div className="p-6">
          <Text className="text-xl font-semibold mb-4">Record Payment</Text>
          
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <Flex justify="between">
                <div>
                  <Text className="text-sm text-gray-500">Total Amount</Text>
                  <Text className="text-xl font-bold">{bill.currency} {bill.totalAmount.toLocaleString()}</Text>
                </div>
                <div className="text-right">
                  <Text className="text-sm text-gray-500">Remaining</Text>
                  <Text className="text-xl font-bold text-blue-600">{bill.currency} {stats.remainingAmount.toLocaleString()}</Text>
                </div>
              </Flex>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount
              </label>
              <Input
                type="number"
                min={0}
                max={stats.remainingAmount}
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date
              </label>
              <Input
                type="date"
                value={paymentData.date}
                onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentData.method}
                onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card Payment</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference
              </label>
              <Input
                placeholder="Payment reference"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <Textarea
                rows={2}
                placeholder="Payment notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              />
            </div>
          </div>

          <Flex gap="3" className="mt-6">
            <Button variant="outline" onClick={() => setShowPaymentModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} isLoading={isRecordingPayment} className="flex-1">
              Record Payment
            </Button>
          </Flex>
        </div>
      </Modal>
    </div>
  );
}
