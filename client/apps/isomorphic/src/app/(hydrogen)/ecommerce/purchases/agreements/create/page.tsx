// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { 
  PiPlusBold, 
  PiTrashBold,
  PiMagnifyingGlass,
  PiXBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button, Input, Textarea, Select } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import { purchaseAgreementService } from '@/services/purchaseAgreement.service';
import { subproductService } from '@/services/subproduct.service';

export default function CreatePurchaseAgreementPage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [subProducts, setSubProducts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    agreementType: 'blanket_order',
    selectionType: 'exclusive',
    vendorName: '',
    vendor: '',
    currency: 'NGN',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    termsConditions: '',
    notes: '',
  });

  const [items, setItems] = useState<any[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [vendorResults, setVendorResults] = useState<any[]>([]);

  const fetchSubProducts = useCallback(async () => {
    if (!session?.user?.token) return;
    setIsLoadingProducts(true);
    try {
      const response = await subproductService.getSubProducts(session.user.token, { limit: 1000 });
      if (response.success) {
        setSubProducts(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [session?.user?.token]);

  useEffect(() => {
    if (session?.user?.token) {
      fetchSubProducts();
    }
  }, [session?.user?.token, fetchSubProducts]);

  const handleVendorSearch = async (value: string) => {
    setVendorSearch(value);
    if (value.length >= 2) {
      setShowVendorDropdown(true);
    } else {
      setShowVendorDropdown(false);
    }
  };

  const selectVendor = (vendor: any) => {
    setFormData(prev => ({
      ...prev,
      vendor: vendor._id,
      vendorName: vendor.name,
    }));
    setVendorSearch(vendor.name);
    setShowVendorDropdown(false);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        subProductId: '',
        subProductName: '',
        sku: '',
        sizeId: '',
        sizeName: '',
        quantity: 1,
        unitPrice: 0,
        packagingQty: 1,
        packaging: 'unit',
        leadTimeDays: 7,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      
      if (field === 'subProductId') {
        const product = subProducts.find(p => p._id === value);
        if (product) {
          updated.subProductName = product.product?.name || '';
          updated.sku = product.sku || '';
          updated.sizeId = '';
          updated.sizeName = '';
          if (product.sizes?.length === 1) {
            updated.sizeId = product.sizes[0]._id;
            updated.sizeName = product.sizes[0].size;
            updated.packagingQty = product.sizes[0].unitsPerPack || 1;
            updated.unitPrice = product.sizes[0].costPrice || 0;
          }
        }
      }
      
      if (field === 'sizeId') {
        const product = subProducts.find(p => p._id === updated.subProductId);
        const size = product?.sizes?.find((s: any) => s._id === value);
        if (size) {
          updated.sizeName = size.size;
          updated.packagingQty = size.unitsPerPack || 1;
          updated.unitPrice = size.costPrice || 0;
        }
      }
      
      return updated;
    }));
  };

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0);
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const handleSubmit = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }

    if (!formData.name || !formData.vendorName) {
      toast.error('Name and vendor are required');
      return;
    }

    if (items.length === 0) {
      toast.error('At least one item is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await purchaseAgreementService.createAgreement({
        ...formData,
        items: items.map(item => ({
          subProductId: item.subProductId,
          subProductName: item.subProductName,
          sku: item.sku,
          sizeId: item.sizeId,
          sizeName: item.sizeName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          packagingQty: item.packagingQty,
          packaging: item.packaging,
          leadTimeDays: item.leadTimeDays,
        })),
        totalQuantity,
        totalAmount,
      }, session.user.token);

      if (response.success) {
        toast.success('Purchase agreement created successfully');
        router.push(routes.eCommerce.purchaseAgreements);
      } else {
        toast.error(response.message || 'Failed to create agreement');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create agreement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Create Purchase Agreement"
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
          { href: routes.eCommerce.purchases, name: 'Purchases' },
          { href: routes.eCommerce.purchaseAgreements, name: 'Agreements' },
          { name: 'Create' },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Agreement Details</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Agreement Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Annual Supply Agreement 2024"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Type <span className="text-red-500">*</span>
                </label>
                <Select
                  options={[
                    { value: 'blanket_order', label: 'Blanket Order' },
                    { value: 'call_for_tender', label: 'Call for Tender' },
                  ]}
                  value={formData.agreementType}
                  onChange={(e) => setFormData({ ...formData, agreementType: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Selection Type
                </label>
                <Select
                  options={[
                    { value: 'exclusive', label: 'Select Only One (Cancel Others)' },
                    { value: 'non_exclusive', label: 'Select Multiple (Keep Others)' },
                  ]}
                  value={formData.selectionType}
                  onChange={(e) => setFormData({ ...formData, selectionType: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Currency
                </label>
                <Select
                  options={[
                    { value: 'NGN', label: 'NGN - Nigerian Naira' },
                    { value: 'USD', label: 'USD - US Dollar' },
                    { value: 'EUR', label: 'EUR - Euro' },
                    { value: 'GBP', label: 'GBP - British Pound' },
                  ]}
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Agreement Items</h3>
              <Button onClick={addItem}>
                <PiPlusBold className="mr-1 h-4 w-4" />
                Add Item
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                <p className="text-gray-500">No items added yet</p>
                <Button className="mt-2" onClick={addItem}>
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Item {index + 1}</span>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <PiTrashBold className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs text-gray-500">Product</label>
                        <select
                          value={item.subProductId}
                          onChange={(e) => updateItem(item.id, 'subProductId', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select Product</option>
                          {subProducts.map((product) => (
                            <option key={product._id} value={product._id}>
                              {product.product?.name} {product.sku ? `(${product.sku})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Size</label>
                        <select
                          value={item.sizeId}
                          onChange={(e) => updateItem(item.id, 'sizeId', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          disabled={!item.subProductId}
                        >
                          <option value="">Select Size</option>
                          {subProducts.find(p => p._id === item.subProductId)?.sizes?.map((size: any) => (
                            <option key={size._id} value={size._id}>
                              {size.size}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Quantity</label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Unit Price</label>
                        <Input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Lead Time (Days)</label>
                        <Input
                          type="number"
                          min="0"
                          value={item.leadTimeDays}
                          onChange={(e) => updateItem(item.id, 'leadTimeDays', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Vendor</h3>
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Vendor <span className="text-red-500">*</span>
              </label>
              <Input
                value={vendorSearch}
                onChange={(e) => handleVendorSearch(e.target.value)}
                onFocus={() => vendorSearch.length >= 2 && setShowVendorDropdown(true)}
                placeholder="Search vendor..."
              />
              {showVendorDropdown && vendorResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {vendorResults.map((vendor) => (
                    <button
                      key={vendor._id}
                      type="button"
                      onClick={() => selectVendor(vendor)}
                      className="w-full px-4 py-2 text-left hover:bg-blue-50"
                    >
                      <p className="font-medium text-gray-900">{vendor.name}</p>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Type vendor name to search or create new
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Terms & Notes</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Terms & Conditions
                </label>
                <Textarea
                  value={formData.termsConditions}
                  onChange={(e) => setFormData({ ...formData, termsConditions: e.target.value })}
                  rows={3}
                  placeholder="Enter terms and conditions..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Internal Notes
                </label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Internal notes..."
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Quantity:</span>
                <span className="font-medium">{totalQuantity.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Total Amount:</span>
                <span className="font-semibold text-lg">
                  {formData.currency} {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            isLoading={isLoading}
          >
            Create Purchase Agreement
          </Button>
        </div>
      </div>
    </>
  );
}
