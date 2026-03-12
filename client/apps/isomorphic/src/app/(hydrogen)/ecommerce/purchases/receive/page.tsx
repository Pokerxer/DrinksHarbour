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
  PiTruck,
  PiWarehouse,
  PiPlusCircle,
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

export default function ReceivePurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const [isLoading, setIsLoading] = useState(false);
  const [poData, setPoData] = useState<any>(null);
  
  const poId = searchParams.get('id') || ''; // Get PO ID from URL
  
  useEffect(() => {
    const fetchPO = async () => {
      if (poId && session?.user?.token) {
        try {
          const response = await purchaseOrderService.getPurchaseOrder(poId, session.user.token);
          if (response.success && response.data) {
            setPoData(response.data);
          }
        } catch (error) {
          console.error('Failed to fetch PO:', error);
        }
      }
    };
    
    fetchPO();
  }, [poId, session?.user?.token]);

  const poNumber = poData?.poNumber || searchParams.get('po') || 'PO000001';
  const vendor = poData?.vendorName || searchParams.get('vendor') || '';
  const vendorRef = poData?.vendorReference || searchParams.get('vendorRef') || '';
  
  const receiveNo = searchParams.get('receiveNo') || `WH/IN/${String(Date.now()).slice(-6)}`;
  const [receiveFrom, setReceiveFrom] = useState('');
  const [operationType, setOperationType] = useState('receipt');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 16));
  const [deadline, setDeadline] = useState('');
  const [sourceDoc, setSourceDoc] = useState(poNumber);
  const [assignOwner, setAssignOwner] = useState('');
  const [note, setNote] = useState('');
  
  // Initialize items from PO data
  const initialItems: ReceiveItem[] = poData?.items?.map((item: any, idx: number) => ({
    id: item._id || item.id || `item-${idx}`,
    subProductId: item.subProductId?._id || item.subProductId || '',
    subProductName: item.subProductName || item.subProductId?.name || '',
    sku: item.sku || item.subProductId?.sku || '',
    quantity: item.quantity || 0,
    receivedQty: item.receivedQty || 0,
    uom: item.uom || 'Units',
    packaging: item.packaging || '',
    unitCost: item.unitCost || 0,
    taxRate: item.taxRate || 0,
    totalCost: item.totalCost || 0,
    sizeId: item.sizeId?._id || item.sizeId || '', // Add sizeId
  })) || [
    {
      id: '1',
      subProductId: 'prod-1',
      subProductName: '[TIPS] Tips',
      sku: 'TIPS-001',
      quantity: 1,
      receivedQty: 0,
      uom: 'Units',
      packaging: '',
      unitCost: 100,
      taxRate: 0,
      totalCost: 100,
    },
  ];
  
  const [items, setItems] = useState<ReceiveItem[]>(initialItems);
  
  // Update items when poData changes
  useEffect(() => {
    if (poData?.items) {
      setItems(poData.items.map((item: any, idx: number) => ({
        id: item._id || item.id || `item-${idx}`,
        subProductId: item.subProductId?._id || item.subProductId || '',
        subProductName: item.subProductName || item.subProductId?.name || '',
        sku: item.sku || item.subProductId?.sku || '',
        quantity: item.quantity || 0,
        receivedQty: item.receivedQty || 0,
        uom: item.uom || 'Units',
        packaging: item.packaging || '',
        unitCost: item.unitCost || 0,
        taxRate: item.taxRate || 0,
        totalCost: item.totalCost || 0,
        sizeId: item.sizeId?._id || item.sizeId || '',
      })));
    }
  }, [poData]);

  const updateItem = useCallback((id: string, field: keyof ReceiveItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      if (field === 'receivedQty') {
        const qty = parseFloat(String(value)) || 0;
        updated.receivedQty = Math.min(qty, updated.quantity);
      }
      
      if (field === 'quantity' || field === 'unitCost' || field === 'taxRate') {
        updated.totalCost = (updated.quantity || 0) * (updated.unitCost || 0) * (1 + (updated.taxRate || 0) / 100);
      }
      
      return updated;
    }));
  }, []);

  const totalToReceive = useMemo(() => 
    items.reduce((sum, item) => sum + (item.receivedQty || 0), 0), 
  [items]);
  
  const totalOrdered = useMemo(() => 
    items.reduce((sum, item) => sum + (item.quantity || 0), 0), 
  [items]);

  const handleReceive = async () => {
    if (totalToReceive === 0) {
      toast.error('Please enter quantities to receive');
      return;
    }

    // If we have a PO ID, update status to 'received' first
    if (poId && session?.user?.token) {
      setIsLoading(true);
      try {
        const receivedItems = items.map(item => ({
          itemId: item.id,
          receivedQty: item.receivedQty
        }));

        await purchaseOrderService.updatePurchaseOrderStatus(
          poId,
          'received',
          session.user.token,
          receivedItems
        );

        toast.success('Items received successfully');
      } catch (error: any) {
        console.error('Failed to update PO status:', error);
        toast.error(error.message || 'Failed to receive items');
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    // Build item params
    const itemParams = items.map((item, idx) => 
      `item[${idx}][id]=${encodeURIComponent(item.id)}&` +
      `item[${idx}][subProductId]=${encodeURIComponent(item.subProductId || '')}&` +
      `item[${idx}][subProductName]=${encodeURIComponent(item.subProductName || '')}&` +
      `item[${idx}][quantity]=${encodeURIComponent(item.quantity)}&` +
      `item[${idx}][receivedQty]=${encodeURIComponent(item.receivedQty)}&` +
      `item[${idx}][uom]=${encodeURIComponent(item.uom)}&` +
      `item[${idx}][unitCost]=${encodeURIComponent(item.unitCost)}&` +
      `item[${idx}][sizeId]=${encodeURIComponent(item.sizeId || '')}`
    ).join('&');
    
    const params = `po=${poNumber}&vendor=${encodeURIComponent(vendor)}&vendorRef=${encodeURIComponent(vendorRef)}&receiveNo=${receiveNo}&note=${encodeURIComponent(note)}&poId=${encodeURIComponent(poId)}&${itemParams}`;
    
    router.push(`${routes.eCommerce.validateReceipt}?${params}`);
  };

  const addLine = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        subProductId: '',
        subProductName: '',
        sku: '',
        quantity: 1,
        receivedQty: 0,
        uom: 'Units',
        packaging: '',
        unitCost: 0,
        taxRate: 0,
        totalCost: 0,
      },
    ]);
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
                  <span className="w-1.5 h-6 md:h-7 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full"></span>
                  Receive Products
                </h1>
                <p className="text-sm text-gray-500 hidden sm:block">Receive products for Purchase Order</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-orange-50 text-orange-700 font-semibold rounded-lg text-sm border border-orange-200">
                {receiveNo}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="p-4 md:p-6 w-full mx-auto">
        {/* PO Details */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-4 md:px-6 py-4 bg-gray-50/50 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <PiPackage className="h-5 w-5 text-gray-500" />
              Purchase Order {poNumber}
            </h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Scheduled Date</label>
                <Input 
                  type="datetime-local" 
                  value={scheduledDate} 
                  onChange={(e: any) => setScheduledDate(e.target.value)}
                  className="[&>label>div]:h-11 [&>label>div]:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Deadline</label>
                <Input 
                  type="date" 
                  value={deadline} 
                  onChange={(e: any) => setDeadline(e.target.value)}
                  className="[&>label>div]:h-11 [&>label>div]:bg-white"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Operations Table */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-4 md:px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <PiTruck className="h-5 w-5 text-gray-500" />
              Operations
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">
                To Receive: <span className="font-semibold text-orange-600">{totalToReceive}</span> / {totalOrdered}
              </span>
            </div>
          </div>
          
          {/* Table Header */}
          <div className="flex bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
            <div className="w-16 px-3 py-3">Product</div>
            <div className="w-28 px-3 py-3">Packaging</div>
            <div className="w-24 px-3 py-3 text-right">Demand</div>
            <div className="w-24 px-3 py-3 text-right">Quantity</div>
            <div className="w-24 px-3 py-3 text-right">UoM</div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.id} className="flex items-center hover:bg-gray-50">
                <div className="w-16 px-3 py-3">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {item.subProductName || '-'}
                  </div>
                  {item.sku && (
                    <div className="text-xs text-gray-500">{item.sku}</div>
                  )}
                </div>
                <div className="w-28 px-3 py-3">
                  <input
                    type="text"
                    value={item.packaging}
                    onChange={(e: any) => updateItem(item.id, 'packaging', e.target.value)}
                    className="w-full h-9 text-sm bg-transparent border border-gray-200 rounded-lg px-2 focus:outline-none focus:border-orange-400"
                    placeholder="Pack..."
                  />
                </div>
                <div className="w-24 px-3 py-3 text-right text-sm text-gray-600">
                  {item.quantity}
                </div>
                <div className="w-24 px-3 py-3">
                  <input
                    type="number"
                    min={0}
                    max={item.quantity}
                    value={item.receivedQty}
                    onChange={(e: any) => updateItem(item.id, 'receivedQty', parseFloat(e.target.value) || 0)}
                    className="w-full h-9 text-sm bg-transparent border border-gray-200 rounded-lg px-2 text-right font-medium focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div className="w-24 px-3 py-3 text-sm text-gray-600">
                  {item.uom}
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-gray-100">
            <Button variant="text" onClick={addLine} className="gap-2 h-9 text-orange-600 hover:bg-orange-50">
              <PiPlusCircle className="h-4 w-4" />
              Add a line
            </Button>
          </div>
        </motion.div>

        {/* Additional Info */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-4 md:px-6 py-4 bg-gray-50/50 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Additional Information</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Receive From</label>
                <Input 
                  value={receiveFrom} 
                  onChange={(e: any) => setReceiveFrom(e.target.value)}
                  placeholder="Source location..."
                  className="[&>label>div]:h-11 [&>label>div]:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Operation Type</label>
                <select 
                  value={operationType}
                  onChange={(e: any) => setOperationType(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                >
                  <option value="receipt">Receipt</option>
                  <option value="return">Return</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Source Document</label>
                <Input 
                  value={sourceDoc} 
                  onChange={(e: any) => setSourceDoc(e.target.value)}
                  placeholder={poNumber}
                  className="[&>label>div]:h-11 [&>label>div]:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Assign Owner</label>
                <Input 
                  value={assignOwner} 
                  onChange={(e: any) => setAssignOwner(e.target.value)}
                  placeholder="Assign to..."
                  className="[&>label>div]:h-11 [&>label>div]:bg-white"
                />
              </div>
            </div>
            <div className="mt-6">
              <label className="text-xs font-medium text-gray-500 mb-2 block">Note</label>
              <Textarea 
                value={note} 
                onChange={(e: any) => setNote(e.target.value)}
                placeholder="Add notes..."
                rows={3}
                className="resize-none"
              />
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
            Cancel
          </Button>
          <Button 
            onClick={handleReceive}
            isLoading={isLoading}
            className="h-11 px-6 bg-orange-500 hover:bg-orange-600 text-white"
          >
            <PiCheck className="mr-2 h-5 w-5" />
            Validate
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
