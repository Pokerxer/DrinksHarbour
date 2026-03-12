'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { inventoryService, SubProduct } from '@/services/inventory.service';
import { vendorBillService, VendorBill, BillItem } from '@/services/vendorBill.service';
import { purchaseOrderService, PurchaseOrder } from '@/services/purchaseOrder.service';
import { Button, Input, Text, Textarea, Select, Flex, Badge } from 'rizzui';
import {
  PiPlusCircle,
  PiTrash,
  PiArrowLeft,
  PiCheckCircle,
  PiLink,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { routes } from '@/config/routes';

interface BillLineItem {
  id: string;
  subProductId: string;
  subProductName: string;
  sku: string;
  sizeId: string;
  sizeName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

const CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

export default function CreateVendorBillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<SubProduct[]>([]);
  const [searchResults, setSearchResults] = useState<SubProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [linkedPOs, setLinkedPOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<string>('');
  
  const searchRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    vendorName: '',
    vendorReference: '',
    billNumber: '',
    currency: 'NGN',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    terms: '',
  });

  const [items, setItems] = useState<BillLineItem[]>([
    { id: '1', subProductId: '', subProductName: '', sku: '', sizeId: '', sizeName: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 },
    { id: '2', subProductId: '', subProductName: '', sku: '', sizeId: '', sizeName: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 },
    { id: '3', subProductId: '', subProductName: '', sku: '', sizeId: '', sizeName: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 },
    { id: '4', subProductId: '', subProductName: '', sku: '', sizeId: '', sizeName: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 },
  ]);

  const addItem = () => {
    const newId = Date.now().toString();
    setItems([...items, { id: newId, subProductId: '', subProductName: '', sku: '', sizeId: '', sizeName: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof BillLineItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
          const qty = field === 'quantity' ? value : updated.quantity;
          const price = field === 'unitPrice' ? value : updated.unitPrice;
          const tax = field === 'taxRate' ? value : updated.taxRate;
          updated.amount = qty * price * (1 + tax / 100);
        }
        return updated;
      }
      return item;
    }));
  };

  const fetchProducts = useCallback(async (query: string) => {
    if (!session?.user?.token || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsFetchingProducts(true);
    try {
      const response = await inventoryService.searchSubProducts(session.user.token, query) as any;
      if (response.success) {
        setSearchResults(response.data || []);
      }
    } catch (err) {
      console.error('Failed to search products:', err);
    } finally {
      setIsFetchingProducts(false);
    }
  }, [session?.user?.token]);

  const fetchReceivedPOs = useCallback(async () => {
    if (!session?.user?.token) return;

    try {
      const response = await purchaseOrderService.getPurchaseOrders(session.user.token, {
        limit: 100,
        status: 'validated',
      }) as any;
      
      if (response.success) {
        setLinkedPOs(response.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch POs:', err);
    }
  }, [session?.user?.token]);

  useEffect(() => {
    if (session?.user?.token) {
      fetchReceivedPOs();
    }
  }, [session?.user?.token, fetchReceivedPOs]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        fetchProducts(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, fetchProducts]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setActiveRowId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductSelect = (product: SubProduct, rowId: string) => {
    updateItem(rowId, 'subProductId', product._id);
    updateItem(rowId, 'subProductName', product.productName);
    updateItem(rowId, 'sku', product.sku || '');
    
    const primarySize = product.sizeVariants?.[0];
    if (primarySize) {
      updateItem(rowId, 'sizeId', primarySize._id);
      updateItem(rowId, 'sizeName', primarySize.sizeName || '');
    }
    
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setActiveRowId(null);
  };

  const handleLinkPO = (poId: string) => {
    setSelectedPO(poId);
    const po = linkedPOs.find(p => p._id === poId);
    if (po && po.items) {
      const newItems: BillLineItem[] = po.items.map((item, index) => ({
        id: Date.now().toString() + index,
        subProductId: item.subProductId || '',
        subProductName: item.productName || '',
        sku: item.sku || '',
        sizeId: item.sizeId || '',
        sizeName: item.sizeName || '',
        quantity: item.quantity || 1,
        unitPrice: item.packPrice || 0,
        taxRate: item.taxRate || 0,
        amount: (item.quantity || 1) * (item.packPrice || 0) * (1 + (item.taxRate || 0) / 100),
      }));
      setItems(newItems);
    }
    toast.success('Purchase order items linked');
  };

  const handleSubmit = async (status: 'draft' | 'confirmed' = 'draft') => {
    if (!session?.user?.token) return;

    const validItems = items.filter(item => item.subProductId);
    if (validItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (!formData.vendorName) {
      toast.error('Please enter vendor name');
      return;
    }

    setIsSaving(true);
    try {
      const billItems: BillItem[] = validItems.map(item => ({
        subProductId: item.subProductId,
        subProductName: item.subProductName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        amount: item.amount,
      }));

      const billData = {
        vendorName: formData.vendorName,
        vendorReference: formData.vendorReference,
        billNumber: formData.billNumber,
        currency: formData.currency,
        billDate: formData.billDate,
        dueDate: formData.dueDate || undefined,
        purchaseOrder: selectedPO || undefined,
        status,
        notes: formData.notes || undefined,
        terms: formData.terms || undefined,
        items: billItems,
      };

      const response = await vendorBillService.createVendorBill(billData, session.user.token) as any;
      
      if (response.success) {
        toast.success(status === 'confirmed' ? 'Vendor bill confirmed' : 'Vendor bill saved as draft');
        router.push(routes.eCommerce.vendorBills);
      } else {
        toast.error(response.message || 'Failed to create vendor bill');
      }
    } catch (err: any) {
      console.error('Failed to create vendor bill:', err);
      toast.error(err.message || 'Failed to create vendor bill');
    } finally {
      setIsSaving(false);
    }
  };

  const totals = useMemo(() => {
    const validItems = items.filter(item => item.subProductId);
    const subtotal = validItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = validItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice * item.taxRate / 100), 0);
    const total = subtotal + taxAmount;
    
    return {
      totalItems: validItems.length,
      subtotal,
      taxAmount,
      total,
    };
  }, [items]);

  if (sessionStatus === 'loading') {
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
        <div className="flex items-center gap-4">
          <Link href={routes.eCommerce.vendorBills}>
            <Button variant="text" size="sm">
              <PiArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <Text className="text-2xl font-bold text-gray-900">Create Vendor Bill</Text>
            <Text className="text-gray-500">Record bills from vendors for received goods</Text>
          </div>
        </div>
        <Flex gap="3">
          <Button
            variant="outline"
            onClick={() => handleSubmit('draft')}
            isLoading={isSaving}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit('confirmed')}
            isLoading={isSaving}
          >
            <PiCheckCircle className="mr-2 h-4 w-4" />
            Confirm Bill
          </Button>
        </Flex>
      </div>

      {/* Link PO */}
      {linkedPOs.length > 0 && !selectedPO && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
          <Flex align="center" gap="2" className="mb-3">
            <PiLink className="h-5 w-5 text-blue-600" />
            <Text className="font-semibold text-blue-900">Link to Purchase Order</Text>
          </Flex>
          <p className="text-sm text-blue-800 mb-3">
            You can link this bill to a validated purchase order to auto-fill items.
          </p>
          <div className="flex flex-wrap gap-2">
            {linkedPOs.slice(0, 5).map(po => (
              <Button
                key={po._id}
                variant="outline"
                size="sm"
                onClick={() => handleLinkPO(po._id)}
              >
                {po.poNumber}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Items</Text>
          <Text className="text-2xl font-bold text-gray-900">{totals.totalItems}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Subtotal</Text>
          <Text className="text-2xl font-bold text-blue-600">{formData.currency} {totals.subtotal.toLocaleString()}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Tax</Text>
          <Text className="text-2xl font-bold text-purple-600">{formData.currency} {totals.taxAmount.toLocaleString()}</Text>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
        >
          <Text className="text-gray-500 text-sm">Total</Text>
          <Text className="text-2xl font-bold text-gray-900">{formData.currency} {totals.total.toLocaleString()}</Text>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <Text className="text-lg font-semibold mb-4">Bill Items</Text>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900 w-10">#</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900 w-20">Size</th>
                    <th className="px-3 py-3 text-center text-sm font-semibold text-gray-900 w-16">Qty</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-gray-900 w-24">Unit Price</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-gray-900 w-16">Tax %</th>
                    <th className="px-3 py-3 text-right text-sm font-semibold text-gray-900 w-24">Amount</th>
                    <th className="px-3 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-3 py-3 text-gray-500 text-sm">{index + 1}</td>
                      <td className="px-3 py-3">
                        <div className="relative" ref={activeRowId === item.id ? searchRef : null}>
                          <Input
                            placeholder="Search products..."
                            value={activeRowId === item.id ? searchQuery : (item.subProductName || '')}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setActiveRowId(item.id);
                              setShowDropdown(true);
                            }}
                            onFocus={() => {
                              setActiveRowId(item.id);
                              setShowDropdown(true);
                            }}
                            className="w-full"
                          />
                          {showDropdown && activeRowId === item.id && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {isFetchingProducts ? (
                                <div className="p-3 text-center text-gray-500">Searching...</div>
                              ) : searchResults.length > 0 ? (
                                searchResults.map((product) => (
                                  <button
                                    key={product._id}
                                    onClick={() => handleProductSelect(product, item.id)}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                  >
                                    <Text className="font-medium text-gray-900">{product.productName}</Text>
                                    <Text className="text-xs text-gray-500">{product.sku}</Text>
                                  </button>
                                ))
                              ) : searchQuery.length >= 2 ? (
                                <div className="p-3 text-center text-gray-500">No products found</div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          value={item.sizeName}
                          onChange={(e) => updateItem(item.id, 'sizeName', e.target.value)}
                          placeholder="Size"
                          className="w-full"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full text-center"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full text-right"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.taxRate}
                          onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                          className="w-full text-right"
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formData.currency} {item.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          variant="text"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          className="text-red-500 hover:text-red-700"
                        >
                          <PiTrash className="h-4 w-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add More Rows */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4">
              <Button variant="outline" onClick={addItem}>
                <PiPlusCircle className="mr-2 h-4 w-4" />
                Add Item
              </Button>
              {selectedPO && (
                <Badge variant="flat" color="success">
                  <PiLink className="mr-1 h-3 w-3" />
                  Linked to PO
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Bill Details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <Text className="text-lg font-semibold mb-4">Bill Details</Text>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name *
                </label>
                <Input
                  placeholder="Enter vendor name"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Reference
                </label>
                <Input
                  placeholder="Vendor's invoice number"
                  value={formData.vendorReference}
                  onChange={(e) => setFormData({ ...formData, vendorReference: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bill Number
                </label>
                <Input
                  placeholder="e.g., BILL-2024-001"
                  value={formData.billNumber}
                  onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {CURRENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bill Date
                </label>
                <Input
                  type="date"
                  value={formData.billDate}
                  onChange={(e) => setFormData({ ...formData, billDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <Textarea
                  rows={3}
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Help */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <Text className="font-semibold text-gray-900 mb-2">3-Way Matching</Text>
            <Text className="text-sm text-gray-600">
              This bill will be validated against the linked Purchase Order to ensure quantities and prices match before payment.
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
