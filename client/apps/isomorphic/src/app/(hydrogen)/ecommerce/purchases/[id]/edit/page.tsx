'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Button, Input, Tooltip, ActionIcon } from 'rizzui';
import {
  PiPackage,
  PiTrash,
  PiArrowLeft,
  PiCheck,
  PiFactory,
  PiTruck,
  PiWarehouse,
  PiReceipt,
  PiFileText,
  PiCurrencyNgn,
  PiEye,
  PiPencil,
  PiLock,
  PiPlusCircle,
  PiMagnifyingGlass,
  PiDotsSixVertical,
  PiWarningCircle,
} from 'react-icons/pi';

import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';

type POStatus = 'draft' | 'confirmed' | 'received' | 'validated' | 'cancelled';

const CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

export default function EditPurchasePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const { data: session } = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [poData, setPoData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'receipts' | 'bills'>('overview');

  const [vendor, setVendor] = useState('');
  const [vendorReference, setVendorReference] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [dateExpected, setDateExpected] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [purchaseOrderNo, setPurchaseOrderNo] = useState('');
  const [confirmationDate, setConfirmationDate] = useState('');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [poStatus, setPoStatus] = useState<POStatus>('draft');
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isLocked, setIsLocked] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const token = (session as any)?.accessToken;

  const loadPurchaseOrder = useCallback(async () => {
    try {
      setIsLoading(true);
      const response: any = await purchaseOrderService.getPurchaseOrder(id, token);
      if (response) {
        setPoData(response);
        setVendor(response.vendor?.name || '');
        setVendorReference(response.vendorReference || '');
        setCurrency(response.currency || 'NGN');
        setPurchaseOrderNo(response.purchaseOrderNo || '');
        setConfirmationDate(response.confirmationDate || '');
        setExpectedArrival(response.dateExpected || '');
        setDateExpected(response.dateExpected || '');
        setReceiptDate(response.receiptDate || '');
        setPoStatus(response.status || 'draft');
        setApprovalStatus(response.approvalStatus || 'pending');
        setIsLocked(response.isLocked || false);
        setItems(response.items || []);
      }
    } catch (error) {
      console.error('Error loading PO:', error);
      toast.error('Failed to load purchase order');
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadPurchaseOrder();
  }, [loadPurchaseOrder]);

  const handleLockPO = async () => {
    try {
      await purchaseOrderService.lockPO(id, undefined, token);
      setIsLocked(true);
      toast.success('Purchase order locked');
    } catch (error) {
      toast.error('Failed to lock PO');
    }
  };

  const handleUnlockPO = async () => {
    try {
      await purchaseOrderService.unlockPO(id, token);
      setIsLocked(false);
      toast.success('Purchase order unlocked');
    } catch (error) {
      toast.error('Failed to unlock PO');
    }
  };

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        subtotal: acc.subtotal + (item.totalCost || 0),
        tax: acc.tax + (item.totalCost * (item.taxRate || 0)) / 100,
      }),
      { subtotal: 0, tax: 0 }
    );
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8"
    >
      <motion.div variants={itemVariants} className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="text"
            onClick={() => router.push('/ecommerce/purchases')}
            className="gap-2 pl-0"
          >
            <PiArrowLeft className="h-5 w-5" />
            Back to Orders
          </Button>
          <div className="h-6 w-px bg-gray-200"></div>
          <h1 className="text-xl font-semibold text-gray-900">
            Purchase Order {purchaseOrderNo}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'edit' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setViewMode(viewMode === 'edit' ? 'view' : 'edit')}
          >
            {viewMode === 'edit' ? <PiPencil className="mr-1 h-4 w-4" /> : <PiEye className="mr-1 h-4 w-4" />}
            {viewMode === 'edit' ? 'Editing' : 'Edit'}
          </Button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PiFileText className="h-4 w-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'products'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PiPackage className="h-4 w-4" />
              Products
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'receipts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PiTruck className="h-4 w-4" />
              Receipts
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'bills'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PiReceipt className="h-4 w-4" />
              Bills
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Status:</span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                poStatus === 'draft'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : poStatus === 'confirmed'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : poStatus === 'received'
                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                      : poStatus === 'validated'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {poStatus.charAt(0).toUpperCase() + poStatus.slice(1)}
            </span>
            {isLocked && (
              <span className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                <PiLock className="mr-1 inline h-3 w-3" />
                Locked
              </span>
            )}
          </div>
        </div>

        <div className="p-4 md:p-6">
          {activeTab === 'overview' && (
            <motion.div variants={itemVariants} className="space-y-6">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <PiFileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Purchase Order</h2>
                      <p className="text-sm text-gray-500">{purchaseOrderNo}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                  <div className="p-6">
                    <label className="text-xs font-medium text-gray-500">Vendor</label>
                    <p className="mt-1 font-medium text-gray-900">{vendor || '-'}</p>
                  </div>
                  <div className="p-6">
                    <label className="text-xs font-medium text-gray-500">Confirmation Date</label>
                    <p className="mt-1 font-medium text-gray-900">{confirmationDate ? new Date(confirmationDate).toLocaleDateString() : '-'}</p>
                  </div>
                  <div className="p-6">
                    <label className="text-xs font-medium text-gray-500">Expected Arrival</label>
                    <p className="mt-1 font-medium text-gray-900">{expectedArrival || '-'}</p>
                  </div>
                  <div className="p-6">
                    <label className="text-xs font-medium text-gray-500">Currency</label>
                    <p className="mt-1 font-medium text-gray-900">{currency}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <PiPackage className="h-5 w-5" />
                    <span className="text-sm font-medium">Total Products</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{items.length}</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <PiCurrencyNgn className="h-5 w-5" />
                    <span className="text-sm font-medium">Total Amount</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {currency} {totals.subtotal.toLocaleString()}
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <PiTruck className="h-5 w-5" />
                    <span className="text-sm font-medium">Received</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {items.reduce((sum, item) => sum + (item.receivedQty || 0), 0)} / {items.reduce((sum, item) => sum + item.quantity, 0)}
                  </p>
                </div>
              </div>

              {poStatus !== 'validated' && poStatus !== 'cancelled' && (
                <div className="flex justify-end gap-2">
                  {!isLocked ? (
                    <Button variant="outline" onClick={handleLockPO}>
                      <PiLock className="mr-2 h-4 w-4" />
                      Lock Order
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleUnlockPO}>
                      Unlock Order
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'products' && (
            <motion.div variants={itemVariants} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">Product</th>
                      <th className="px-6 py-3 font-medium">Size</th>
                      <th className="px-6 py-3 font-medium text-right">Ordered</th>
                      <th className="px-6 py-3 font-medium text-right">Received</th>
                      <th className="px-6 py-3 font-medium text-right">Billed</th>
                      <th className="px-6 py-3 font-medium text-right">Unit Cost</th>
                      <th className="px-6 py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{item.subProductName}</div>
                          <div className="text-xs text-gray-500">{item.sku}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{item.sizeName}</td>
                        <td className="px-6 py-4 text-right text-gray-900">{item.quantity}</td>
                        <td className="px-6 py-4 text-right text-gray-900">{item.receivedQty || 0}</td>
                        <td className="px-6 py-4 text-right text-gray-900">{item.billed || 0}</td>
                        <td className="px-6 py-4 text-right text-gray-900">
                          {currency} {item.unitCost?.toLocaleString() || '0'}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          {currency} {item.totalCost?.toLocaleString() || '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {items.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <PiPackage className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2">No products in this order</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'receipts' && (
            <motion.div variants={itemVariants} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="p-6 text-center text-gray-500">
                <PiTruck className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">No receipts yet</p>
                {poStatus === 'confirmed' && (
                  <p className="mt-1 text-sm">Go to Receive step to record incoming shipments</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'bills' && (
            <motion.div variants={itemVariants} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="p-6 text-center text-gray-500">
                <PiReceipt className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">No vendor bills yet</p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
