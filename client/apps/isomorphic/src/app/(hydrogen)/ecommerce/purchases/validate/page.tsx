'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Button, Input, Textarea } from 'rizzui';
import {
  PiPackage,
  PiArrowLeft,
  PiCheck,
  PiCheckCircle,
  PiWarehouse,
  PiWarningCircle,
} from 'react-icons/pi';

import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';

interface ReceiveItem {
  id: string;
  subProductId: string;
  subProductName: string;
  sku: string;
  quantity: number;
  receivedQty: number;
  uom: string;
  packaging: string;
  unitCost: number;
  taxRate: number;
  totalCost: number;
  sizeId?: string; // Optional size ID
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

export default function ValidateReceiptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  
  const poNumber = searchParams.get('po') || '';
  const vendor = searchParams.get('vendor') || '';
  const vendorRef = searchParams.get('vendorRef') || '';
  const receiveNo = searchParams.get('receiveNo') || `WH/IN/${String(Date.now()).slice(-6)}`;
  const note = searchParams.get('note') || '';
  const poId = searchParams.get('poId') || ''; // Get PO ID
  
  const [items, setItems] = useState<ReceiveItem[]>([]);
  
  useEffect(() => {
    const itemsList: ReceiveItem[] = [];
    let idx = 0;
    while (searchParams.has(`item[${idx}][id]`)) {
      itemsList.push({
        id: searchParams.get(`item[${idx}][id]`) || '',
        subProductId: searchParams.get(`item[${idx}][subProductId]`) || '',
        subProductName: searchParams.get(`item[${idx}][subProductName]`) || '',
        sku: '',
        quantity: parseFloat(searchParams.get(`item[${idx}][quantity]`) || '0'),
        receivedQty: parseFloat(searchParams.get(`item[${idx}][receivedQty]`) || '0'),
        uom: searchParams.get(`item[${idx}][uom]`) || 'Units',
        packaging: '',
        unitCost: parseFloat(searchParams.get(`item[${idx}][unitCost]`) || '0'),
        taxRate: 0,
        totalCost: 0,
        sizeId: searchParams.get(`item[${idx}][sizeId]`) || undefined, // Get sizeId
      });
      idx++;
    }
    if (itemsList.length > 0) {
      setItems(itemsList);
    } else {
      setItems([
        {
          id: '1',
          subProductId: 'prod-1',
          subProductName: '[TIPS] Tips',
          sku: 'TIPS-001',
          quantity: 1,
          receivedQty: 1,
          uom: 'Units',
          packaging: '',
          unitCost: 100,
          taxRate: 0,
          totalCost: 100,
        },
      ]);
    }
  }, [searchParams]);

  const totalToValidate = useMemo(() => 
    items.reduce((sum, item) => sum + (item.receivedQty || 0), 0), 
  [items]);

  const handleValidate = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }

    if (totalToValidate === 0) {
      toast.error('No items to validate');
      return;
    }

    setIsLoading(true);

    try {
      // Prepare received items data for updating PO status to 'validated'
      // The backend will handle inventory updates automatically (Odoo-style)
      const receivedItems = items.map(item => ({
        itemId: item.id,
        receivedQty: item.receivedQty
      }));

      // Update PO status to 'validated' - backend will add inventory automatically
      await purchaseOrderService.updatePurchaseOrderStatus(
        poId, 
        'validated', 
        session.user.token, 
        receivedItems
      );
      
      setIsValidated(true);
      toast.success('Receipt validated successfully! Inventory updated.');
    } catch (error: any) {
      console.error('Failed to validate receipt:', error);
      toast.error(error.message || 'Failed to validate receipt');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <Button variant="text" onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 h-10 w-10 p-0 rounded-full">
                <PiArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-1.5 h-6 md:h-7 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></span>
                  Validate Receipt
                </h1>
                <p className="text-sm text-gray-500 hidden sm:block">Validate and update inventory</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isValidated ? (
                <span className="px-3 py-1.5 bg-green-50 text-green-700 font-semibold rounded-lg text-sm border border-green-200 flex items-center gap-2">
                  <PiCheckCircle className="h-4 w-4" />
                  Validated
                </span>
              ) : (
                <span className="px-3 py-1.5 bg-orange-50 text-orange-700 font-semibold rounded-lg text-sm border border-orange-200">
                  {receiveNo}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="p-4 md:p-6 w-full mx-auto">
        {!isValidated ? (
          <>
            {/* Receipt Info */}
            <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
              <div className="px-4 md:px-6 py-4 bg-gray-50/50 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <PiPackage className="h-5 w-5 text-gray-500" />
                  Receipt Information
                </h2>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Receipt Reference</label>
                    <div className="h-11 flex items-center px-3 bg-gray-50 border border-gray-200/50 rounded-lg font-mono text-gray-700">
                      {receiveNo}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Purchase Order</label>
                    <div className="h-11 flex items-center px-3 bg-gray-50 border border-gray-200/50 rounded-lg text-gray-700">
                      {poNumber || '-'}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Vendor</label>
                    <div className="h-11 flex items-center px-3 bg-gray-50 border border-gray-200/50 rounded-lg text-gray-700">
                      {vendor || '-'}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Vendor Reference</label>
                    <div className="h-11 flex items-center px-3 bg-gray-50 border border-gray-200/50 rounded-lg text-gray-700">
                      {vendorRef || '-'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Operations Table */}
            <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
              <div className="px-4 md:px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <PiWarehouse className="h-5 w-5 text-gray-500" />
                  Operations
                </h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    Total: <span className="font-semibold text-green-600">{totalToValidate}</span>
                  </span>
                </div>
              </div>
              
              {/* Table Header */}
              <div className="flex bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                <div className="flex-1 px-3 py-3">Product</div>
                <div className="w-32 px-3 py-3 text-right">Packaging</div>
                <div className="w-28 px-3 py-3 text-right">Quantity</div>
                <div className="w-24 px-3 py-3 text-right">UoM</div>
              </div>
              
              {/* Table Body */}
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center hover:bg-gray-50">
                    <div className="flex-1 px-3 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {item.subProductName || '-'}
                      </div>
                      {item.sku && (
                        <div className="text-xs text-gray-500">{item.sku}</div>
                      )}
                    </div>
                    <div className="w-32 px-3 py-3 text-right text-sm text-gray-600">
                      {item.packaging || '-'}
                    </div>
                    <div className="w-28 px-3 py-3 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 font-semibold rounded text-sm">
                        {item.receivedQty}
                      </span>
                    </div>
                    <div className="w-24 px-3 py-3 text-right text-sm text-gray-600">
                      {item.uom}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Summary */}
            <motion.div variants={itemVariants} className="bg-green-50 rounded-2xl border border-green-200 p-6 mb-6">
              <div className="flex items-center gap-3">
                <PiCheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Ready to Validate</h3>
                  <p className="text-sm text-green-700">
                    Click validate to update inventory with {totalToValidate} received items
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Footer */}
            <motion.div variants={itemVariants} className="flex justify-end gap-4">
              <Button 
                variant="outline" 
                onClick={() => router.back()}
                className="h-11 px-6"
              >
                Back
              </Button>
              <Button 
                onClick={handleValidate}
                isLoading={isLoading}
                className="h-11 px-8 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/25"
              >
                <PiCheck className="mr-2 h-5 w-5" />
                Validate Receipt
              </Button>
            </motion.div>
          </>
        ) : (
          <>
            {/* Success State */}
            <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-green-200 shadow-lg p-12 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <PiCheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Receipt Validated Successfully!</h2>
              <p className="text-gray-600 mb-8">
                {totalToValidate} items have been added to your inventory.
              </p>
              
              <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left max-w-md mx-auto">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Receipt No:</span>
                    <span className="font-mono font-medium">{receiveNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Purchase Order:</span>
                    <span className="font-medium">{poNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Vendor:</span>
                    <span className="font-medium">{vendor || '-'}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-gray-500">Items Validated:</span>
                    <span className="font-bold text-green-600">{totalToValidate}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => router.push(routes.eCommerce.subProducts)}
                  className="h-11 px-6"
                >
                  View Inventory
                </Button>
                <Button 
                  onClick={() => router.push(`/ecommerce/purchases/create?po=${encodeURIComponent(poNumber)}`)}
                  className="h-11 px-6 bg-purple-600 hover:bg-purple-700"
                >
                  Create Bill
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
