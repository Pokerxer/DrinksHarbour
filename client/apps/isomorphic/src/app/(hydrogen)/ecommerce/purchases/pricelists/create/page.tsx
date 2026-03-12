// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { 
  PiPlusBold, 
  PiTrashBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button, Input, Textarea, Select } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import { vendorPricelistService } from '@/services/vendorPricelist.service';
import { subproductService } from '@/services/subproduct.service';

export default function CreateVendorPricelistPage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [subProducts, setSubProducts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    vendorName: '',
    vendor: '',
    currency: 'NGN',
    isActive: true,
    discountPercent: 0,
    notes: '',
  });

  const [items, setItems] = useState<any[]>([]);

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
        vendorProductCode: '',
        unitPrice: 0,
        discountPercent: 0,
        minQuantity: 1,
        leadTimeDays: 7,
        packagingQty: 1,
        isPreferred: false,
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
            updated.unitPrice = product.sizes[0].costPrice || 0;
          }
        }
      }
      
      if (field === 'sizeId') {
        const product = subProducts.find(p => p._id === updated.subProductId);
        const size = product?.sizes?.find((s: any) => s._id === value);
        if (size) {
          updated.sizeName = size.size;
          updated.unitPrice = size.costPrice || 0;
        }
      }
      
      return updated;
    }));
  };

  const handleSubmit = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }

    if (!formData.name || !formData.vendorName) {
      toast.error('Name and vendor are required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await vendorPricelistService.createPricelist({
        ...formData,
        items: items.map(item => ({
          subProductId: item.subProductId,
          subProductName: item.subProductName,
          sku: item.sku,
          sizeId: item.sizeId,
          sizeName: item.sizeName,
          vendorProductCode: item.vendorProductCode,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          minQuantity: item.minQuantity,
          leadTimeDays: item.leadTimeDays,
          packagingQty: item.packagingQty,
          isPreferred: item.isPreferred,
        })),
      }, session.user.token);

      if (response.success) {
        toast.success('Vendor pricelist created successfully');
        router.push(routes.eCommerce.vendorPricelists);
      } else {
        toast.error(response.message || 'Failed to create pricelist');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create pricelist');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Create Vendor Pricelist"
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
          { href: routes.eCommerce.purchases, name: 'Purchases' },
          { href: routes.eCommerce.vendorPricelists, name: 'Vendor Pricelists' },
          { name: 'Create' },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Pricelist Items</h3>
            <div className="mb-4">
              <Button onClick={addItem}>
                <PiPlusBold className="mr-1 h-4 w-4" />
                Add Product
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                <p className="text-gray-500">No products added yet</p>
                <Button className="mt-2" onClick={addItem}>
                  Add First Product
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Product {index + 1}</span>
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
                          <option value="">Any Size</option>
                          {subProducts.find(p => p._id === item.subProductId)?.sizes?.map((size: any) => (
                            <option key={size._id} value={size._id}>
                              {size.size}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Vendor SKU</label>
                        <Input
                          value={item.vendorProductCode}
                          onChange={(e) => updateItem(item.id, 'vendorProductCode', e.target.value)}
                          placeholder="Vendor SKU"
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
                        <label className="mb-1 block text-xs text-gray-500">Min Qty</label>
                        <Input
                          type="number"
                          min="1"
                          value={item.minQuantity}
                          onChange={(e) => updateItem(item.id, 'minQuantity', parseInt(e.target.value) || 1)}
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
            <h3 className="mb-4 text-lg font-semibold">Pricelist Details</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., ABC Corp Price List 2024"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value, vendor: '' })}
                  placeholder="Vendor name"
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
                  Default Discount %
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            isLoading={isLoading}
          >
            Create Vendor Pricelist
          </Button>
        </div>
      </div>
    </>
  );
}
