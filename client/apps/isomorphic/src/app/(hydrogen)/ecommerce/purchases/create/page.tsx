'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { inventoryService } from '@/services/inventory.service';
import { purchaseOrderService, PurchaseOrder, POItem } from '@/services/purchaseOrder.service';
import { Badge, Button, Input, Text, Textarea, Tooltip, ActionIcon, Flex } from 'rizzui';
import {
  PiPackage,
  PiPlusCircle,
  PiTrash,
  PiCheck,
  PiArrowsClockwiseBold,
  PiDotsSixVertical,
  PiListDashes,
  PiFileText,
  PiSliders,
  PiArrowUpRight,
  PiTruck,
  PiCheckCircle,
  PiWarningCircle,
  PiFactory,
  PiEnvelope,
  PiPrinter,
  PiArrowLeft,
} from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Reorder } from 'framer-motion';
import Link from 'next/link';
import { routes } from '@/config/routes';

interface PurchaseItem {
  id: string;
  type: 'product' | 'section' | 'note';
  subProductId: string;
  subProductName: string;
  sku: string;
  sizeId: string;
  sizeName: string;
  quantity: number;
  receivedQty: number;
  billed: number;
  uom: string;
  packagingQty: number;
  packaging: string;
  packPrice: number;
  unitCost: number;
  taxRate: number;
  totalCost: number;
  title?: string;
}

type POStatus = 'draft' | 'confirmed' | 'received' | 'validated';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width: number;
  minWidth?: number;
  align: 'left' | 'center' | 'right';
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'dragHandle', label: '', visible: true, width: 40, minWidth: 40, align: 'center' },
  { id: 'product', label: 'Product', visible: true, width: 280, minWidth: 200, align: 'left' },
  { id: 'size', label: 'Size', visible: true, width: 100, minWidth: 80, align: 'left' },
  { id: 'packaging', label: 'Packaging', visible: true, width: 120, minWidth: 100, align: 'left' },
  { id: 'quantity', label: 'Qty', visible: true, width: 80, minWidth: 60, align: 'center' },
  { id: 'packPrice', label: 'Pack Price', visible: true, width: 120, minWidth: 100, align: 'right' },
  { id: 'unitPrice', label: 'Unit Price', visible: true, width: 110, minWidth: 90, align: 'right' },
  { id: 'tax', label: 'Tax %', visible: true, width: 70, minWidth: 60, align: 'right' },
  { id: 'amount', label: 'Amount', visible: true, width: 120, minWidth: 100, align: 'right' },
  { id: 'received', label: 'Rcvd', visible: false, width: 80, minWidth: 60, align: 'center' },
  { id: 'actions', label: '', visible: true, width: 50, minWidth: 50, align: 'center' },
];

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

export default function CreatePurchasePage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [subProducts, setSubProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [showProductDropdown, setShowProductDropdown] = useState<Record<string, boolean>>({});
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [showSettings, setShowSettings] = useState(false);
  
  // Receive table column widths state
  const [receiveColumnWidths, setReceiveColumnWidths] = useState<Record<string, number>>({
    'product-receive': 400,
    'size-receive': 100,
    'ordered-receive': 120,
    'received-receive': 120,
    'uom-receive': 100,
  });

  // Backorder state
  const [createBackorder, setCreateBackorder] = useState(false);

  const [purchaseOrderNo, setPurchaseOrderNo] = useState('Loading...');
  const [receiptNo] = useState(() => {
    const saved = localStorage.getItem('currentPOReceiptNo');
    if (saved) return saved;
    return `WH/IN/${Date.now().toString().slice(-6)}`;
  });
  
  useEffect(() => {
    if (receiptNo) {
      localStorage.setItem('currentPOReceiptNo', receiptNo);
    }
  }, [receiptNo]);

  const [poStatus, setPoStatus] = useState<POStatus>('draft');
  const [activeStep, setActiveStep] = useState<'details' | 'receive' | 'validate'>('details');
  const [vendor, setVendor] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [vendorDropdown, setVendorDropdown] = useState<any[]>([]);
  const [vendorReference, setVendorReference] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [confirmationDate, setConfirmationDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [expectedArrival, setExpectedArrival] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  
  // RFQ-specific fields
  const [validUntil, setValidUntil] = useState('');
  const [termsConditions, setTermsConditions] = useState('');

  // Approval workflow state
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [approvalThreshold] = useState(100000); // Default threshold for auto-approval

  // Column resizing state
  const resizingRef = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Fetch subproducts and vendors on mount
  useEffect(() => {
    if (!session?.user?.token) return;
    
    const fetchData = async () => {
      setIsLoadingProducts(true);
      try {
        // Fetch subproducts - add tenant slug header
        console.log('Fetching subproducts with token...');
        const productsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/subproducts?limit=1000`,
          { 
            headers: { 
              Authorization: `Bearer ${session.user.token}`,
              'Content-Type': 'application/json'
            } 
          }
        );
        console.log('Products response status:', productsRes.status, productsRes.statusText);
        
        if (productsRes.ok) {
          const productsData: any = await productsRes.json();
          console.log('Products API response:', JSON.stringify(productsData).substring(0, 500));
          // API returns { success, data: { subProducts: [...], stats: {...}, pagination: {...} } }
          const subProductList = productsData.data?.subProducts || [];
          console.log('Set subProducts:', subProductList.length);
          setSubProducts(Array.isArray(subProductList) ? subProductList : []);
        } else {
          const errorText = await productsRes.text();
          console.error('Products fetch failed:', productsRes.status, errorText);
        }
        
        // Fetch vendors
        const vendorsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/vendors?limit=100`,
          { 
            headers: { 
              Authorization: `Bearer ${session.user.token}`,
              'Content-Type': 'application/json'
            } 
          }
        );
        console.log('Vendors request token:', session.user.token?.substring(0, 50) + '...');
        console.log('Vendors response status:', vendorsRes.status, vendorsRes.statusText);
        if (vendorsRes.ok) {
          const vendorsData: any = await vendorsRes.json();
          console.log('Vendors API response:', JSON.stringify(vendorsData).substring(0, 300));
          if (vendorsData.success) {
            setVendorDropdown(vendorsData.data || []);
          }
        } else {
          const errorText = await vendorsRes.text();
          console.error('Vendors fetch failed:', vendorsRes.status, errorText);
          // Don't block - use empty array
          setVendorDropdown([]);
        }
        
        // Fetch next PO number
        const poRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/inventory/next-po`,
          { 
            headers: { 
              Authorization: `Bearer ${session.user.token}`,
              'Content-Type': 'application/json'
            } 
          }
        );
        if (poRes.ok) {
          const poData: any = await poRes.json();
          if (poData.success) {
            setPurchaseOrderNo(poData.data?.poNumber || `PO-${Date.now().toString().slice(-6)}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        // Set fallback values on error
        setPurchaseOrderNo(`PO-${Date.now().toString().slice(-6)}`);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    
    fetchData();
  }, [session?.user?.token]);

  // Clear old receipt number when starting a new session
  useEffect(() => {
    const lastActivity = localStorage.getItem('lastPOActivity');
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    
    // Clear if more than 1 hour has passed since last activity
    if (!lastActivity || now - parseInt(lastActivity) > hour) {
      localStorage.removeItem('currentPOReceiptNo');
    }
    localStorage.setItem('lastPOActivity', now.toString());
  }, []);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.product-dropdown') &&
        !target.closest('.settings-dropdown') &&
        !target.closest('.vendor-dropdown')
      ) {
        setShowProductDropdown({});
        setDropdownPosition({});
        setShowSettings(false);
        setShowVendorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mouse move handler for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { columnId, startX, startWidth } = resizingRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + delta);
      
      if (!columnId.includes('-receive')) {
        const column = columnConfigs.find((c) => c.id === columnId);
        if (!column) return;
        const minWidth = column.minWidth || 50;
        const adjustedWidth = Math.max(minWidth, newWidth);
        setColumnConfigs((prev) =>
          prev.map((col) =>
            col.id === columnId ? { ...col, width: adjustedWidth } : col
          )
        );
      } else {
        setReceiveColumnWidths(prev => ({
          ...prev,
          [columnId]: newWidth
        }));
      }
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [columnConfigs]);

  const handleVendorSearch = async (query: string) => {
    setVendorSearch(query);
    if (query.length < 2) {
      setShowVendorDropdown(false);
      return;
    }
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/vendors/search?q=${query}`,
        {
          headers: { Authorization: `Bearer ${session?.user?.token}` },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: any = await response.json();
      if (data.success) {
        // API returns 'vendors' not 'data'
        setVendorDropdown(data.vendors || data.data || []);
        setShowVendorDropdown(true);
      }
    } catch (error) {
      console.error('Failed to search vendors:', error);
    }
  };

  const selectVendor = (vendor: any) => {
    setVendor(vendor.name);
    setVendorId(vendor._id || null);
    setVendorSearch(vendor.name);
    setShowVendorDropdown(false);
  };

  const createVendor = async (name: string) => {
    if (!session?.user?.token) return;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/vendors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.user.token}`,
          },
          body: JSON.stringify({ name, email: '' }),
        }
      );
      const data = await response.json();
      if (data.success) {
        setVendor(name);
        setVendorId(data.data?._id || null);
        setVendorSearch(name);
        setShowVendorDropdown(false);
        toast.success(`Vendor "${name}" created!`);
      }
    } catch (error) {
      console.error('Failed to create vendor:', error);
      toast.error('Failed to create vendor');
    }
  };

  const startResize = useCallback(
    (columnId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!columnId.includes('-receive')) {
        const column = columnConfigs.find((c) => c.id === columnId);
        if (!column) return;
        resizingRef.current = {
          columnId,
          startX: e.clientX,
          startWidth: column.width,
        };
      } else {
        const currentWidth = receiveColumnWidths[columnId] || 100;
        resizingRef.current = {
          columnId,
          startX: e.clientX,
          startWidth: currentWidth,
        };
      }
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [columnConfigs, receiveColumnWidths]
  );

  const updateItem = useCallback((id: string, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        
        if (field === 'subProductId') {
          const product = subProducts.find((p) => p._id === value);
          updated.subProductName = product?.product?.name || '';
          updated.sku = product?.sku || '';
          updated.uom = product?.defaultUom || 'Units';
          updated.packaging = '';
          updated.packagingQty = 1;
          updated.packPrice = 0;
          updated.unitCost = 0;
          updated.taxRate = 0;
          updated.totalCost = 0;
          updated.quantity = 1;
          updated.receivedQty = 0;
          updated.billed = 0;
          
          if (product?.sizes?.length === 1) {
            const size = product.sizes[0];
            updated.sizeId = size._id;
            updated.sizeName = size.size;
            updated.packagingQty = size.unitsPerPack || 1;
            updated.packaging = size.unitsPerPack <= 1 ? 'unit' : `pack-${size.unitsPerPack}`;
            updated.sku = size.sku || product.sku;
          } else {
            updated.sizeId = '';
            updated.sizeName = '';
          }
        }
        
        if (field === 'sizeId') {
          const product = subProducts.find((p) => p._id === updated.subProductId);
          const size = product?.sizes?.find((s: any) => s._id === value);
          if (size) {
            updated.sizeName = size.size;
            updated.packagingQty = size.unitsPerPack || 1;
            updated.packaging = size.unitsPerPack <= 1 ? 'unit' : `pack-${size.unitsPerPack}`;
            updated.sku = size.sku || product?.sku || '';
            updated.packPrice = size.costPrice || 0;
            const unitsPerPack = updated.packagingQty || 1;
            updated.unitCost = unitsPerPack > 0 ? updated.packPrice / unitsPerPack : updated.packPrice;
            const subtotal = (updated.quantity || 0) * updated.unitCost;
            const tax = subtotal * ((updated.taxRate || 0) / 100);
            updated.totalCost = subtotal + tax;
          }
        }
        
        if (field === 'packaging') {
          const match = value.match(/pack-(\d+)/);
          if (match) {
            const qty = parseInt(match[1], 10);
            updated.packagingQty = qty;
            if (updated.packPrice > 0) {
              updated.unitCost = qty > 0 ? updated.packPrice / qty : updated.packPrice;
              const subtotal = (updated.quantity || 0) * updated.unitCost;
              const tax = subtotal * ((updated.taxRate || 0) / 100);
              updated.totalCost = subtotal + tax;
            }
          } else if (value === 'unit') {
            updated.packagingQty = 1;
            updated.unitCost = updated.packPrice;
            const subtotal = (updated.quantity || 0) * updated.unitCost;
            const tax = subtotal * ((updated.taxRate || 0) / 100);
            updated.totalCost = subtotal + tax;
          }
        }
        
        if (field === 'packPrice') {
          const packPrice = parseFloat(value) || 0;
          const unitsPerPack = updated.packagingQty || 1;
          updated.unitCost = unitsPerPack > 0 ? packPrice / unitsPerPack : packPrice;
          const subtotal = (updated.quantity || 0) * updated.unitCost;
          const tax = subtotal * ((updated.taxRate || 0) / 100);
          updated.totalCost = subtotal + tax;
        }
        
        if (field === 'quantity' || field === 'unitCost' || field === 'taxRate') {
          const subtotal = (updated.quantity || 0) * (updated.unitCost || 0);
          const tax = subtotal * ((updated.taxRate || 0) / 100);
          updated.totalCost = subtotal + tax;
        }
        
        return updated;
      })
    );
  }, [subProducts]);

  const addItem = (type: 'product' | 'section' | 'note' = 'product') => {
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      type,
      subProductId: '',
      subProductName: '',
      sku: '',
      sizeId: '',
      sizeName: '',
      quantity: type === 'product' ? 1 : 0,
      receivedQty: 0,
      billed: 0,
      uom: 'Units',
      packagingQty: 1,
      packaging: '',
      packPrice: 0,
      unitCost: 0,
      taxRate: 0,
      totalCost: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleReorder = (newOrder: PurchaseItem[]) => {
    setItems(newOrder);
  };

  const updateSearch = useCallback((id: string, value: string) => {
    setProductSearch((prev) => ({ ...prev, [id]: value }));
    setShowProductDropdown((prev) => ({ ...prev, [id]: value.length > 0 }));
  }, []);

  const [dropdownPosition, setDropdownPosition] = useState<Record<string, 'down' | 'up'>>({});

  const selectProduct = useCallback(
    (itemId: string, product: any) => {
      updateItem(itemId, 'subProductId', product._id);
      setProductSearch((prev) => ({ ...prev, [itemId]: '' }));
      setShowProductDropdown({});
      setDropdownPosition({});
    },
    [updateItem]
  );

  const subtotalAmount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.unitCost || 0),
        0
      ),
    [items]
  );
  const totalTax = useMemo(
    () =>
      items.reduce((sum, item) => {
        const subtotal = (item.quantity || 0) * (item.unitCost || 0);
        return sum + subtotal * ((item.taxRate || 0) / 100);
      }, 0),
    [items]
  );
  const totalAmount = subtotalAmount + totalTax;

  // Check if PO needs approval based on amount
  useEffect(() => {
    // All POs require manual approval - always set to pending for draft status
    if (poStatus === 'draft') {
      setApprovalStatus('pending');
    }
  }, [poStatus]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!vendor) errors.push('Vendor is required');
    if (!items.some((item) => item.subProductId && item.quantity > 0)) {
      errors.push('At least one product is required');
    }
    // Validate size selection for products with multiple sizes
    items.forEach((item) => {
      if (item.type === 'product' && item.subProductId) {
        const product = subProducts.find((p) => p._id === item.subProductId);
        if (product?.sizes?.length > 1 && !item.sizeId) {
          errors.push(`Size is required for "${item.subProductName || 'product'}"`);
        }
      }
    });
    return errors;
  }, [vendor, items, subProducts]);

  const saveAsDraft = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }
    if (!vendor) {
      toast.error('Please select a vendor');
      return;
    }
    if (items.filter((i) => i.type === 'product' && i.subProductId).length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    setIsLoading(true);
    try {
      const poItems = items
        .filter((item) => item.type === 'product' && item.subProductId)
        .map((item) => ({
          subProductId: item.subProductId,
          subProductName: item.subProductName,
          sku: item.sku,
          sizeId: item.sizeId,
          sizeName: item.sizeName,
          quantity: item.quantity,
          receivedQty: 0,
          uom: item.uom,
          packagingQty: item.packagingQty,
          packaging: item.packaging,
          packPrice: item.packPrice,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
          totalCost: item.totalCost,
        }));
      const poData = {
        poNumber: purchaseOrderNo,
        vendor: vendorId,
        vendorName: vendor,
        vendorReference,
        currency,
        confirmationDate,
        expectedArrival,
        arrivalDate,
        items: poItems,
        notes,
        project: '',
        approvalStatus: 'pending',
        status: 'draft',
        validUntil,
        termsConditions,
      };
      const response = await purchaseOrderService.createPurchaseOrder(
        poData,
        session.user.token
      );
      if (response.success) {
        localStorage.setItem('currentPOId', response.data._id);
        toast.success('Purchase Order saved as draft!');
        router.push(routes.eCommerce.purchases);
      }
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      toast.error(error.message || 'Failed to save draft');
    } finally {
      setIsLoading(false);
    }
  };

  const sendToVendor = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }
    if (!vendor) {
      toast.error('Please select a vendor');
      return;
    }
    if (items.filter((i) => i.type === 'product' && i.subProductId).length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    setIsLoading(true);
    try {
      // First create the PO as draft
      const poItems = items
        .filter((item) => item.type === 'product' && item.subProductId)
        .map((item) => ({
          subProductId: item.subProductId,
          subProductName: item.subProductName,
          sku: item.sku,
          sizeId: item.sizeId,
          sizeName: item.sizeName,
          quantity: item.quantity,
          receivedQty: 0,
          uom: item.uom,
          packagingQty: item.packagingQty,
          packaging: item.packaging,
          packPrice: item.packPrice,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
          totalCost: item.totalCost,
        }));
      const poData = {
        poNumber: purchaseOrderNo,
        vendor: vendorId,
        vendorName: vendor,
        vendorReference,
        currency,
        confirmationDate,
        expectedArrival,
        arrivalDate,
        items: poItems,
        notes,
        project: '',
        approvalStatus: 'pending',
        status: 'draft',
        validUntil,
        termsConditions,
      };
      const response = await purchaseOrderService.createPurchaseOrder(
        poData,
        session.user.token
      );
      if (response.success) {
        // Then send to vendor
        await purchaseOrderService.sendPOToVendor(response.data._id, session.user.token);
        toast.success('Purchase Order sent to vendor!');
        router.push(routes.eCommerce.purchases);
      }
    } catch (error: any) {
      console.error('Failed to send to vendor:', error);
      toast.error(error.message || 'Failed to send to vendor');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPO = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }
    if (validationErrors.length > 0) {
      validationErrors.forEach((err) => toast.error(err));
      return;
    }
    setIsLoading(true);
    try {
      const poItems = items
        .filter((item) => item.type === 'product' && item.subProductId)
        .map((item) => ({
          subProductId: item.subProductId,
          subProductName: item.subProductName,
          sku: item.sku,
          sizeId: item.sizeId,
          sizeName: item.sizeName,
          quantity: item.quantity,
          receivedQty: 0,
          uom: item.uom,
          packagingQty: item.packagingQty,
          packaging: item.packaging,
          packPrice: item.packPrice,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
          totalCost: item.totalCost,
        }));
      const poData = {
        poNumber: purchaseOrderNo,
        vendor: vendorId,
        vendorName: vendor,
        vendorReference,
        currency,
        confirmationDate,
        expectedArrival,
        arrivalDate,
        items: poItems,
        notes,
        project: '',
        approvalStatus,
        // RFQ fields
        validUntil,
        termsConditions,
      };
      const response = await purchaseOrderService.createPurchaseOrder(
        poData,
        session.user.token
      );
      if (response.success) {
        localStorage.setItem('currentPOId', response.data._id);
        setPoStatus('confirmed');
        toast.success('Purchase Order confirmed and saved!');
      }
    } catch (error: any) {
      console.error('Failed to confirm PO:', error);
      toast.error(error.message || 'Failed to confirm PO');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiveProducts = async () => {
    if (!session?.user?.token || !localStorage.getItem('currentPOId')) {
      toast.error('Please confirm PO first or sign in');
      return;
    }

    // Check for backorder items
    const partialItems = items.filter(
      item => item.type === 'product' && 
              item.subProductId && 
              item.receivedQty > 0 && 
              item.receivedQty < item.quantity
    );

    try {
      // Update PO status to received
      await purchaseOrderService.updatePurchaseOrderStatus(
        localStorage.getItem('currentPOId')!,
        'received',
        session.user.token,
        // Pass partial receiving info
        partialItems.map(item => ({
          itemId: item.subProductId,
          receivedQty: item.receivedQty,
          remainingQty: item.quantity - item.receivedQty
        }))
      );
      
      // Create backorder if checkbox is checked and there are partial items
      if (createBackorder && partialItems.length > 0) {
        await createBackorderPO(partialItems);
      }
      
      setPoStatus('received');
      setActiveStep('validate');
      toast.success('Products received! Ready to validate.');
    } catch (error: any) {
      console.error('Failed to update PO status:', error);
      toast.error('Failed to update status');
    }
  };

  const createBackorderPO = async (partialItems: PurchaseItem[]) => {
    if (!session?.user?.token) return;
    
    try {
      const backorderItems = partialItems.map(item => ({
        subProductId: item.subProductId,
        subProductName: item.subProductName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: item.quantity - item.receivedQty,
        receivedQty: 0,
        uom: item.uom,
        packagingQty: item.packagingQty,
        packaging: item.packaging,
        packPrice: item.packPrice,
        unitCost: item.unitCost,
        taxRate: item.taxRate,
        totalCost: (item.quantity - item.receivedQty) * item.unitCost,
      }));

      const poData = {
        poNumber: `BO-${purchaseOrderNo}`,
        vendor: vendorId,
        vendorName: vendor,
        vendorReference: `Backorder of ${purchaseOrderNo}`,
        currency,
        confirmationDate: new Date().toISOString().slice(0, 16),
        expectedArrival: '',
        arrivalDate: '',
        items: backorderItems,
        notes: `Backorder for partially received items from PO: ${purchaseOrderNo}`,
        project: '',
        isBackorder: true,
        originalPO: localStorage.getItem('currentPOId'),
      };

      const response = await purchaseOrderService.createPurchaseOrder(
        poData,
        session.user.token
      );
      
      if (response.success) {
        toast.success(`Backorder created: ${poData.poNumber}`);
      }
    } catch (error: any) {
      console.error('Failed to create backorder:', error);
      toast.error('Failed to create backorder');
    }
  };

  const handleValidateReceipt = async () => {
    if (poStatus === 'validated') {
      toast.error('Receipt already validated. This purchase order is locked.');
      return;
    }

    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }
    setIsLoading(true);
    try {
      let allSuccess = true;
      const productItems = items.filter(
        (item) =>
          item.type === 'product' && item.subProductId && item.receivedQty > 0
      );
      for (const item of productItems) {
        try {
          await inventoryService.recordReceived(
            item.subProductId,
            item.receivedQty,
            session.user.token,
            {
              reason: `Purchase from ${vendor}`,
              notes: notes || `PO: ${purchaseOrderNo}`,
              supplierName: vendor,
              unitCost: item.unitCost,
              reference: purchaseOrderNo,
              sizeId: item.sizeId || undefined,
              sizeName: item.sizeName || '',
            }
          );
        } catch (error) {
          console.error(`Failed to validate ${item.subProductName}:`, error);
          allSuccess = false;
        }
      }
      if (allSuccess) {
        if (localStorage.getItem('currentPOId')) {
          await purchaseOrderService.updatePurchaseOrderStatus(
            localStorage.getItem('currentPOId')!,
            'validated',
            session.user.token
          );
        }
        setPoStatus('validated');
        toast.success('Receipt validated! Inventory updated.');
      } else {
        toast.error('Some items failed to validate.');
      }
    } catch (error: any) {
      console.error('Failed to validate receipt:', error);
      toast.error(error.message || 'Failed to validate receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const visibleColumns = useMemo(
    () =>
      columnConfigs.filter(
        (col) =>
          col.visible && (col.id !== 'received' || activeStep === 'receive')
      ),
    [columnConfigs, activeStep]
  );

  const getColumnWidth = useCallback(
    (columnId: string) => columnConfigs.find((c) => c.id === columnId)?.width || 100,
    [columnConfigs]
  );

  const getAlignClass = useCallback((align: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'justify-center';
      case 'right':
        return 'justify-end';
      default:
        return 'justify-start';
    }
  }, []);

  const getFilteredProducts = useCallback(
    (search: string) => {
      const products = Array.isArray(subProducts) ? subProducts : [];
      if (!search) return products.slice(0, 20);
      const lower = search.toLowerCase();
      return products
        .filter(
          (p) =>
            // Search by product name (populated object)
            p.product?.name?.toLowerCase().includes(lower) ||
            // Search by subproduct name directly
            p.name?.toLowerCase().includes(lower) ||
            // Search by SKU
            p.sku?.toLowerCase().includes(lower)
        )
        .slice(0, 20);
    },
    [subProducts]
  );

  const getSizeOptions = useCallback(
    (subProductId: string) => {
      const products = Array.isArray(subProducts) ? subProducts : [];
      const product = products.find((p) => p._id === subProductId);
      if (!product?.sizes || !Array.isArray(product.sizes)) return [];
      return product.sizes.map((size: any) => ({
        value: size._id,
        label: size.size || `${size.volumeMl}ml`,
        sizeData: size,
      }));
    },
    [subProducts]
  );

  const getSizeDetails = useCallback(
    (subProductId: string, sizeId: string) => {
      const products = Array.isArray(subProducts) ? subProducts : [];
      const product = products.find((p) => p._id === subProductId);
      if (!product?.sizes || !Array.isArray(product.sizes)) return null;
      return product.sizes.find((s: any) => s._id === sizeId);
    },
    [subProducts]
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100"
    >
      <motion.div
        variants={itemVariants}
        className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-sm"
      >
        <div className="px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <Button
                variant="text"
                onClick={() => router.back()}
                className="h-10 w-10 rounded-full p-0 text-gray-500 hover:text-gray-900"
              >
                <PiArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900 md:text-xl">
                  <span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-blue-500 to-blue-600 md:h-7"></span>
                  Purchase Order
                </h1>
                <p className="hidden text-sm text-gray-500 sm:block">
                  Create new purchase order
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto md:gap-2">
              <Button variant="outline" className="h-9 gap-1 bg-white text-xs shadow-sm md:gap-2 md:text-sm">
                <PiFileText className="h-4 w-4 text-blue-600" />
                <span className="hidden md:inline">Create Bill</span>
              </Button>
              <Button variant="outline" className="h-9 gap-1 bg-white text-xs shadow-sm md:gap-2 md:text-sm">
                <PiEnvelope className="h-4 w-4 text-purple-600" />
                <span className="hidden md:inline">Send PO</span>
              </Button>
              <Button variant="outline" className="h-9 gap-1 bg-white text-xs shadow-sm md:gap-2 md:text-sm">
                <PiPrinter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="border-b border-gray-200 bg-white px-4 py-4 md:px-6">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-0.5 md:gap-2">
            {/* Step 1: Create Order */}
            <button
              onClick={() => setActiveStep('details')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeStep === 'details'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  activeStep === 'details'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}>1</div>
              <span className="hidden sm:inline">Create Order</span>
            </button>
            <div className="mx-1 h-0.5 w-8 bg-gray-200"></div>
            
            {/* Step 2: Receive - available when PO is confirmed */}
            <button
              onClick={() => poStatus !== 'draft' && setActiveStep('receive')}
              disabled={poStatus === 'draft'}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                poStatus === 'draft'
                  ? 'cursor-not-allowed text-gray-300'
                  : activeStep === 'receive'
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  poStatus === 'draft'
                    ? 'bg-gray-100 text-gray-300'
                    : activeStep === 'receive'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 text-gray-500'
              }`}>2</div>
              <span className="hidden sm:inline">Receive</span>
            </button>
            <div className="mx-1 h-0.5 w-8 bg-gray-200"></div>
            
            {/* Step 3: Validate - available when PO is received */}
            <button
              onClick={() =>
                (poStatus === 'received' || poStatus === 'confirmed') && setActiveStep('validate')
              }
              disabled={poStatus === 'draft' || poStatus === 'confirmed'}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                poStatus === 'draft' || poStatus === 'confirmed'
                  ? 'cursor-not-allowed text-gray-300'
                  : activeStep === 'validate'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  poStatus === 'draft' || poStatus === 'confirmed'
                    ? 'bg-gray-100 text-gray-300'
                    : activeStep === 'validate'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
              }`}>3</div>
              <span className="hidden sm:inline">Validate</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full p-4 md:p-6">
        {activeStep === 'details' && (
          <motion.div variants={itemVariants}>
            <div className="mb-6 overflow-hidden rounded-2xl bg-white">
              <div className="flex items-center justify-between px-4 py-4 md:px-6" style={{ backgroundColor: '#F3F2F2' }}>
                <h2 className="flex items-center gap-2 font-semibold" style={{ color: '#1F2937' }}>
                  <PiFactory className="h-5 w-5" style={{ color: '#5f636f' }} />
                  Order Details
                  {approvalStatus === 'pending' && (
                    <span className="ml-2 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">
                      Pending Approval
                    </span>
                  )}
                  {approvalStatus === 'approved' && (
                    <span className="ml-2 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                      Approved
                    </span>
                  )}
                  {approvalStatus === 'rejected' && (
                    <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                      Rejected
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="hidden text-gray-500 sm:inline-block">Status:</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      poStatus === 'draft'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : poStatus === 'confirmed'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-green-200 bg-green-50 text-green-700'
                    }`}>
                    {poStatus.charAt(0).toUpperCase() + poStatus.slice(1)}
                  </span>
                </div>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                  <div className="space-y-6 lg:col-span-8">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">
                          Vendor <span className="text-red-500">*</span>
                        </label>
                        <div className="vendor-dropdown relative">
                          <Input
                            value={vendorSearch}
                            onChange={(e: any) => handleVendorSearch(e.target.value)}
                            onFocus={() => vendorSearch.length >= 2 && setShowVendorDropdown(true)}
                            placeholder="Search or type vendor name..."
                            className="[&>label>div]:h-11 [&>label>div]:bg-white"
                          />
                          {showVendorDropdown && vendorDropdown.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                              {vendorDropdown.map((v) => (
                                <button
                                  key={v._id}
                                  type="button"
                                  onClick={() => selectVendor(v)}
                                  className="w-full border-b border-gray-50 px-4 py-3 text-left last:border-0 hover:bg-blue-50"
                                >
                                  <div className="font-medium text-gray-900">{v.name}</div>
                                  {v.email && <div className="mt-0.5 text-xs text-gray-500">{v.email}</div>}
                                </button>
                              ))}
                            </div>
                          )}
                          {showVendorDropdown && vendorSearch.trim() && vendorDropdown.length === 0 && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-xl">
                              <button type="button" onClick={() => createVendor(vendorSearch.trim())} className="flex w-full items-center gap-2 px-4 py-3 text-left text-green-700 hover:bg-green-50">
                                <PiPlusCircle className="h-4 w-4" />
                                <span>Create: <strong>{vendorSearch}</strong></span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Vendor Reference</label>
                        <Input
                          value={vendorReference}
                          onChange={(e: any) => setVendorReference(e.target.value)}
                          placeholder="e.g. INV-2023-001"
                          className="[&>label>div]:h-11 [&>label>div]:bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Confirmation Date</label>
                        <Input
                          type="datetime-local"
                          value={confirmationDate}
                          onChange={(e: any) => setConfirmationDate(e.target.value)}
                          className="text-gray-700 [&>label>div]:h-11 [&>label>div]:bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Expected Arrival</label>
                        <Input
                          type="date"
                          value={expectedArrival}
                          onChange={(e: any) => setExpectedArrival(e.target.value)}
                          className="text-gray-700 [&>label>div]:h-11 [&>label>div]:bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Currency</label>
                        <select
                          value={currency}
                          onChange={(e: any) => setCurrency(e.target.value)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                        >
                          {CURRENCY_OPTIONS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                        </select>
                      </div>
                    </div>
                    {/* RFQ-specific fields */}
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Valid Until (Quote Validity)</label>
                        <Input
                          type="date"
                          value={validUntil}
                          onChange={(e: any) => setValidUntil(e.target.value)}
                          className="text-gray-700 [&>label>div]:h-11 [&>label>div]:bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Payment Terms</label>
                        <Input
                          value={termsConditions}
                          onChange={(e: any) => setTermsConditions(e.target.value)}
                          placeholder="e.g. Net 30, Net 60"
                          className="text-gray-700 [&>label>div]:h-11 [&>label>div]:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-6 lg:col-span-4 lg:border-l lg:border-gray-100 lg:pl-8">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">PO Number</label>
                      <div className="flex h-11 items-center rounded-lg border border-gray-200/50 bg-gray-50 px-3">
                        <span className="font-mono font-medium text-gray-700">{purchaseOrderNo}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6 overflow-hidden rounded-2xl bg-white">
              <div className="flex items-center justify-between px-4 py-4 md:px-6" style={{ backgroundColor: '#F3F2F2' }}>
                <h2 className="flex items-center gap-2 font-semibold" style={{ color: '#1F2937' }}>
                  <PiPackage className="h-5 w-5" style={{ color: '#5f636f' }} />
                  Products <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: '#e3dbe1', color: '#714B67' }}>
                    {items.filter((i) => i.subProductId).length}
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                <div className="min-w-[800px]">
                  <div className="flex text-xs font-semibold uppercase" style={{ backgroundColor: '#F3F2F2', color: '#5f636f' }}>
                    {visibleColumns.map((col) => (
                      <div key={col.id} className={`flex-shrink-0 px-3 py-3 relative group ${getAlignClass(col.align)} ${col.id !== 'dragHandle' && col.id !== 'actions' ? 'cursor-col-resize' : ''}`}
                        style={{ width: col.width }} onMouseDown={(e) => col.id !== 'dragHandle' && col.id !== 'actions' && startResize(col.id, e)}>
                        {col.label}
                        {col.id !== 'dragHandle' && col.id !== 'actions' && (
                          <div className="absolute right-0 top-0 h-full w-1 bg-transparent group-hover:bg-[#007bff]"></div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="divide-y divide-gray-200">
                    {items.map((item) => (
                      <Reorder.Item key={item.id} value={item} className="flex transition-all duration-200"
                        style={{ backgroundColor: item.type === 'section' ? '#F3F2F2' : item.type === 'note' ? '#F9FAFB' : '#FFFFFF',
                          borderLeft: item.type === 'section' ? '3px solid #714B67' : item.type === 'note' ? '3px solid #17a2b8' : '3px solid transparent' }}>
                        {visibleColumns.map((col) => (
                          <div key={col.id} className={`flex-shrink-0 px-3 py-3 ${getAlignClass(col.align)}`} style={{ width: col.width }}>
                            {col.id === 'dragHandle' && (
                              <div className="flex h-11 cursor-grab items-center justify-center text-gray-400 hover:text-[#714B67] active:cursor-grabbing transition-colors">
                                <PiDotsSixVertical className="h-5 w-5" />
                              </div>
                            )}
                            {col.id === 'product' && item.type === 'product' && (
                              <div className="product-dropdown relative flex h-full items-center gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={item.subProductId ? (Array.isArray(subProducts) ? subProducts.find((p) => p._id === item.subProductId)?.product?.name : '') || '' : productSearch[item.id] || ''}
                                    onChange={(e: any) => {
                                      if (item.subProductId) updateItem(item.id, 'subProductId', '');
                                      updateSearch(item.id, e.target.value);
                                    }}
                                    onFocus={(e) => {
                                      setShowProductDropdown((prev) => ({ ...prev, [item.id]: true }));
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const spaceBelow = window.innerHeight - rect.bottom;
                                      if (spaceBelow < 300) setDropdownPosition((prev) => ({ ...prev, [item.id]: 'up' }));
                                      else setDropdownPosition((prev) => ({ ...prev, [item.id]: 'down' }));
                                    }}
                                    className={`w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0 ${item.subProductId ? 'font-medium' : 'text-gray-600'}`}
                                    style={{ color: item.subProductId ? '#714B67' : '#374151' }}
                                  />
                                  {showProductDropdown[item.id] && !item.subProductId && (
                                    <div className="absolute left-0 right-0 z-[999999] max-h-72 overflow-y-auto rounded-xl border shadow-xl"
                                      style={{ backgroundColor: '#FFFFFF', borderColor: '#d8dadd',
                                        top: dropdownPosition[item.id] === 'up' ? 'auto' : '100%', bottom: dropdownPosition[item.id] === 'up' ? '100%' : 'auto',
                                        marginTop: dropdownPosition[item.id] === 'up' ? '0' : '4px', marginBottom: dropdownPosition[item.id] === 'up' ? '4px' : '0' }}>
                                      {getFilteredProducts(productSearch[item.id] || '').map((product) => (
                                        <button key={product._id} type="button" onClick={() => selectProduct(item.id, product)}
                                          className="group w-full px-4 py-3 text-left transition-colors" style={{ borderBottom: '1px solid #e7e9ed', backgroundColor: 'transparent' }}
                                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F2F2'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                          <div className="font-medium" style={{ color: '#111827' }}>{product.product?.name || product.sku}</div>
                                          <div className="flex items-center justify-between mt-1">
                                            <div className="text-xs" style={{ color: '#7c7f89' }}>{product.sku}</div>
                                            {product.sizes?.length > 0 && (
                                              <div className="rounded-full px-2 py-1 text-xs" style={{ backgroundColor: '#e3dbe1', color: '#714B67' }}>
                                                {product.sizes.length} size{product.sizes.length > 1 ? 's' : ''} available
                                              </div>
                                            )}
                                          </div>
                                        </button>
                                      ))}
                                      {productSearch[item.id] && (
                                        <button type="button" onClick={async () => {
                                          if (!session?.user?.token) { toast.error('Please sign in to create a product'); return; }
                                          try {
                                            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subproducts`, {
                                              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.user.token}` },
                                              body: JSON.stringify({ product: { name: productSearch[item.id], description: '', category: '', alcoholic: false, origin: '', flavorNotes: [], barcode: '' },
                                                sku: `SKU-${Date.now().toString().slice(-6)}`, sizes: [] })
                                            });
                                            if (response.ok) {
                                              const data = await response.json();
                                              toast.success(`Product "${productSearch[item.id]}" created!`);
                                              updateItem(item.id, 'subProductId', data._id || data.data?._id);
                                              setShowProductDropdown({});
                                              setDropdownPosition({});
                                              fetchSubProducts();
                                            }
                                          } catch (error) { console.error('Failed:', error); toast.error('Failed to create product'); }
                                        }} className="group w-full px-4 py-3 text-left transition-colors flex items-center gap-2" style={{ color: '#28a745' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d4edda'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                          <PiPlusCircle className="h-4 w-4" /><span className="font-medium">Create "{productSearch[item.id]}"</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {item.subProductId && (
                                  <Tooltip content="Edit subproduct">
                                    <ActionIcon as="span" variant="text" size="sm" className="flex-shrink-0 transition-colors" style={{ color: '#9a9ca5' }}>
                                      <Link href={`${routes.eCommerce.editSubProduct(item.subProductId)}`}><PiArrowUpRight className="h-4 w-4" /></Link>
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </div>
                            )}
                            {col.id === 'product' && (item.type === 'section' || item.type === 'note') && (
                              <div className="flex items-center gap-2 w-full">
                                {item.type === 'section' && <span className="flex-shrink-0" style={{ color: '#714B67' }}><PiSliders className="h-4 w-4" /></span>}
                                {item.type === 'note' && <span className="flex-shrink-0" style={{ color: '#17a2b8' }}><PiFileText className="h-4 w-4" /></span>}
                                <input type="text" value={item.title || ''} onChange={(e: any) => updateItem(item.id, 'title', e.target.value)}
                                  className={`w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0 ${item.type === 'section' ? 'font-semibold' : 'italic'}`}
                                  style={{ color: item.type === 'section' ? '#1F2937' : '#5f636f', backgroundColor: 'transparent' }}
                                  placeholder={item.type === 'section' ? 'Section Title' : 'Add a note...'} />
                              </div>
                            )}
                            {col.id === 'size' && item.type === 'product' && (item.subProductId ? (
                              getSizeOptions(item.subProductId).length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <select value={item.sizeId} onChange={(e: any) => updateItem(item.id, 'sizeId', e.target.value)}
                                    className="h-8 w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0" style={{ color: '#374151' }}>
                                    <option value="">Select size</option>
                                    {getSizeOptions(item.subProductId).map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label} ({opt.sizeData?.unitsPerPack || 1}/pk)
                                      </option>
                                    ))}
                                  </select>
                                  {item.sizeId && getSizeDetails(item.subProductId, item.sizeId) && (
                                    <div className="text-xs" style={{ color: '#714B67' }}>
                                      {getSizeDetails(item.subProductId, item.sizeId)?.volumeMl}ml • 
                                      {getSizeDetails(item.subProductId, item.sizeId)?.unitsPerPack} units/pack
                                    </div>
                                  )}
                                </div>
                              ) : (<span className="text-sm" style={{ color: '#7c7f89' }}>{item.sizeName || '-'}</span>)
                            ) : (<span className="text-sm" style={{ color: '#d8dadd' }}>-</span>))}
                            {col.id === 'packaging' && item.type === 'product' && (
                              <select value={item.packaging} onChange={(e: any) => updateItem(item.id, 'packaging', e.target.value)}
                                disabled={poStatus !== 'draft'} className="h-11 w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0" style={{ color: '#374151' }}>
                                <option value="">Select packaging</option>
                                <option value="unit">Unit</option>
                                <option value="pack-6">Pack of 6</option>
                                <option value="pack-12">Pack of 12</option>
                                <option value="pack-24">Pack of 24</option>
                              </select>
                            )}
                            {col.id === 'quantity' && item.type === 'product' && (
                              <input type="number" min={0} value={item.quantity} onChange={(e: any) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                disabled={poStatus !== 'draft'} className="h-11 w-full border-0 bg-transparent text-center text-sm font-medium focus:outline-none focus:ring-0 disabled:opacity-50" style={{ color: '#374151' }} />
                            )}
                            {col.id === 'packPrice' && item.type === 'product' && (
                              <input type="number" min={0} value={item.packPrice} onChange={(e: any) => updateItem(item.id, 'packPrice', parseFloat(e.target.value) || 0)}
                                disabled={poStatus !== 'draft'} className="h-11 w-full border-0 bg-transparent text-right text-sm focus:outline-none focus:ring-0 disabled:opacity-50" style={{ color: '#374151' }} />
                            )}
                            {col.id === 'unitPrice' && item.type === 'product' && (
                              <div className="flex h-11 w-full items-center justify-end pr-2 text-sm font-medium" style={{ color: '#5f636f' }}>
                                {currency} {formatCurrency(item.unitCost)}
                              </div>
                            )}
                            {col.id === 'tax' && item.type === 'product' && (
                              <input type="number" min={0} max={100} value={item.taxRate} onChange={(e: any) => updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                                disabled={poStatus !== 'draft'} className="h-11 w-full border-0 bg-transparent pr-6 text-right text-sm focus:outline-none focus:ring-0 disabled:opacity-50" style={{ color: '#374151' }} />
                            )}
                            {col.id === 'amount' && item.type === 'product' && (
                              <div className="font-semibold" style={{ color: '#111827' }}>{currency} {formatCurrency(item.totalCost)}</div>
                            )}
                            {col.id === 'received' && item.type === 'product' && (
                              <div style={{ color: '#7c7f89' }}>{item.receivedQty}</div>
                            )}
                            {col.id === 'actions' && (
                              <button type="button" onClick={() => removeItem(item.id)}
                                className="flex h-11 w-10 items-center justify-center rounded-lg transition-colors" style={{ color: '#9a9ca5' }}>
                                <PiTrash className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </Reorder.Item>
                    ))}
                    {[...Array(4)].map((_, index) => (
                      <Reorder.Item key={`empty-${index}`} value={null} className="flex"
                        style={{ backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', height: '52px', borderLeft: '3px solid transparent' }}>
                        {visibleColumns.map((col) => (
                          <div key={col.id} className="flex-shrink-0 px-3 py-3" style={{ width: col.width, height: '52px' }}>
                            {col.id === 'dragHandle' && <div className="flex h-11 cursor-grab items-center justify-center text-transparent"><PiDotsSixVertical className="h-5 w-5" /></div>}
                          </div>
                        ))}
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
              </div>
              <div className="flex" style={{ backgroundColor: '#F3F2F2', borderTop: '1px solid #e7e9ed' }}>
                {visibleColumns.map((col) => (
                  <div key={col.id} className="flex-shrink-0 px-3 py-3" style={{ width: col.width }}>
                    {col.id === 'product' && (
                      <div className="flex gap-3">
                        <Button variant="text" onClick={() => addItem('product')} disabled={poStatus !== 'draft'}
                          className={`h-8 gap-2 px-3 justify-start text-left ${poStatus !== 'draft' ? 'opacity-40' : ''}`}
                          style={{ color: poStatus !== 'draft' ? undefined : '#714B67', backgroundColor: '#FFFFFF', border: '1px solid #d8dadd', borderRadius: '6px' }}>
                          <PiPlusCircle className="h-4 w-4" /> Add Line
                        </Button>
                        <Button variant="text" onClick={() => addItem('section')} disabled={poStatus !== 'draft'}
                          className={`h-8 gap-2 px-3 justify-start text-left ${poStatus !== 'draft' ? 'opacity-40' : ''}`}
                          style={{ color: poStatus !== 'draft' ? undefined : '#5f636f', backgroundColor: '#F3F2F2', border: '1px solid #d8dadd', borderRadius: '6px' }}>
                          <PiListDashes className="h-4 w-4" /> Add Section
                        </Button>
                        <Button variant="text" onClick={() => addItem('note')} disabled={poStatus !== 'draft'}
                          className={`h-8 gap-2 px-3 justify-start text-left ${poStatus !== 'draft' ? 'opacity-40' : ''}`}
                          style={{ color: poStatus !== 'draft' ? undefined : '#17a2b8', backgroundColor: '#F9FAFB', border: '1px solid #d8dadd', borderRadius: '6px' }}>
                          Add Note
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-4 py-4 md:px-6">
                    <h2 className="font-semibold text-gray-800">Notes</h2>
                  </div>
                  <div className="p-4 md:p-6">
                    <Textarea value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder="Additional notes..." rows={4} className="resize-none" />
                  </div>
                </div>
              </div>
              <div className="col-span-1">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
                    <h2 className="font-semibold text-gray-800">Summary</h2>
                  </div>
                  <div className="space-y-4 p-6">
                    <div className="flex justify-between border-b border-gray-100 py-2">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">{currency} {formatCurrency(subtotalAmount)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 py-2">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-semibold">{currency} {formatCurrency(totalTax)}</span>
                    </div>
                    <div className="flex justify-between rounded-xl bg-gradient-to-r from-blue-50 to-green-50 px-4 py-4">
                      <span className="font-bold text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-green-600">{currency} {formatCurrency(totalAmount)}</span>
                    </div>
                    {validationErrors.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
                        <PiWarningCircle className="h-5 w-5 flex-shrink-0" />
                        <div><p className="font-medium">Please fix:</p><ul className="mt-1 list-inside list-disc">{validationErrors.map((err, idx) => (<li key={idx}>{err}</li>))}</ul></div>
                      </div>
                    )}
                    {poStatus === 'draft' && approvalStatus === 'pending' && (
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                        <p className="text-sm text-yellow-800">This PO exceeds the approval threshold ({currency} {formatCurrency(approvalThreshold)}). It requires approval before confirmation.</p>
                      </div>
                    )}
                    {poStatus === 'draft' && (
                      <div className="flex gap-3">
                        <Button 
                          variant="outline"
                          onClick={saveAsDraft} 
                          isLoading={isLoading} 
                          className="h-12 flex-1 border-gray-300"
                        >
                          <PiFileText className="mr-2 h-5 w-5" /> Save as Draft
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={sendToVendor} 
                          isLoading={isLoading}
                          className="h-12 flex-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          <PiEnvelope className="mr-2 h-5 w-5" /> Send to Vendor
                        </Button>
                        <Button 
                          onClick={confirmPO} 
                          isLoading={isLoading} 
                          className="h-12 flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-base font-semibold shadow-lg hover:from-blue-700 hover:to-blue-800"
                        >
                          <PiCheck className="mr-2 h-5 w-5" /> Create Order
                        </Button>
                      </div>
                    )}
                    {poStatus === 'confirmed' && (
                      <Button onClick={() => setActiveStep('receive')} className="h-12 w-full bg-gradient-to-r from-orange-600 to-orange-700 text-base font-semibold shadow-lg hover:from-orange-700 hover:to-orange-800">
                        <PiTruck className="mr-2 h-5 w-5" /> Continue to Receive
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeStep === 'receive' && (
          <motion.div variants={itemVariants} className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-orange-200 bg-orange-50 px-4 py-4 md:px-6">
              <h2 className="flex items-center gap-2 font-semibold text-orange-800">
                <PiTruck className="h-5 w-5" /> Receive Products
              </h2>
              <span className="rounded-full border border-orange-200 bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">Receiving</span>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Purchase Order Details</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div><label className="text-xs text-gray-500">PO Number</label><div className="font-medium">{purchaseOrderNo}</div></div>
                  <div><label className="text-xs text-gray-500">Vendor</label><div className="font-medium">{vendor}</div></div>
                  <div><label className="text-xs text-gray-500">Date</label><div className="font-medium">{new Date(confirmationDate).toLocaleDateString()}</div></div>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border" style={{ borderColor: '#d8dadd' }}>
                <div className="grid grid-cols-12 text-xs font-semibold uppercase" style={{ backgroundColor: '#F3F2F2', color: '#5f636f' }}>
                  <div className="col-span-3 px-4 py-3">Product</div>
                  <div className="col-span-1 px-4 py-3">Size</div>
                  <div className="col-span-2 px-4 py-3 text-right">Ordered</div>
                  <div className="col-span-2 px-4 py-3 text-right">Received</div>
                  <div className="col-span-1 px-4 py-3 text-right">Remaining</div>
                  <div className="col-span-2 px-4 py-3">UoM</div>
                  <div className="col-span-1 px-4 py-3">Actions</div>
                </div>
                {items.filter((item) => item.type === 'product' && item.subProductId).map((item) => (
                  <div key={item.id} className="grid grid-cols-12 items-center border-t border-gray-100 hover:bg-gray-50">
                    <div className="col-span-3 px-4 py-3"><div className="font-medium text-gray-900">{item.subProductName}</div>{item.sku && <div className="text-xs text-gray-500">{item.sku}</div>}</div>
                    <div className="col-span-1 px-4 py-3 text-sm text-gray-600">{item.sizeName || '-'}</div>
                    <div className="col-span-2 px-4 py-3 text-right font-medium">{item.quantity}</div>
                    <div className="col-span-2 px-4 py-3">
                      <input type="number" min={0} max={item.quantity} value={item.receivedQty}
                        onChange={(e) => updateItem(item.id, 'receivedQty', parseInt(e.target.value) || 0)}
                        className="h-9 w-full rounded-lg border border-gray-300 px-2 text-right text-sm" />
                    </div>
                    <div className="col-span-1 px-4 py-3 text-right font-medium" style={{ color: item.quantity - item.receivedQty > 0 ? '#e99d00' : '#28a745' }}>
                      {item.quantity - item.receivedQty}
                    </div>
                    <div className="col-span-2 px-4 py-3 text-sm text-gray-600">{item.uom}</div>
                    <div className="col-span-1 px-4 py-3">
                      <Button variant="text" onClick={() => updateItem(item.id, 'receivedQty', item.quantity)}
                        className="text-xs text-blue-600 hover:bg-blue-50">Fill</Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Backorder checkbox */}
              <div className="mt-4 flex items-center gap-2">
                <input type="checkbox" id="createBackorder" checked={createBackorder} onChange={(e) => setCreateBackorder(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="createBackorder" className="text-sm text-gray-700">
                  Create backorder for remaining items
                </label>
              </div>
              
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Total: <span className="font-semibold">
                    {items.filter((i) => i.type === 'product' && i.subProductId).reduce((sum, item) => sum + item.receivedQty, 0)}
                  </span> items received
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setActiveStep('details')} className="h-10">Back</Button>
                  <Button onClick={handleReceiveProducts} isLoading={isLoading} className="h-10 bg-orange-500 text-white hover:bg-orange-600">
                    <PiTruck className="mr-2 h-4 w-4" /> Receive & Continue to Validate
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeStep === 'validate' && (
          <motion.div variants={itemVariants} className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-green-200 bg-green-50 px-4 py-4 md:px-6">
              <h2 className="flex items-center gap-2 font-semibold text-green-800">
                <PiCheckCircle className="h-5 w-5" /> Validate Receipt
              </h2>
              <span className="rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">Ready</span>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Receipt Summary</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div><label className="text-xs text-gray-500">Receipt No</label><div className="font-medium">{purchaseOrderNo}</div></div>
                  <div><label className="text-xs text-gray-500">PO Number</label><div className="font-medium">{purchaseOrderNo}</div></div>
                  <div><label className="text-xs text-gray-500">Vendor</label><div className="font-medium">{vendor}</div></div>
                  <div><label className="text-xs text-gray-500">Total Items</label><div className="font-semibold">{items.filter((i) => i.type === 'product' && i.subProductId && i.receivedQty > 0).reduce((sum, item) => sum + item.receivedQty, 0)}</div></div>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border" style={{ borderColor: '#d8dadd' }}>
                <div className="grid grid-cols-12 text-xs font-semibold uppercase" style={{ backgroundColor: '#F3F2F2', color: '#5f636f' }}>
                  <div className="col-span-4 px-4 py-3">Product</div>
                  <div className="col-span-2 px-4 py-3">Size</div>
                  <div className="col-span-2 px-4 py-3 text-right">Ordered</div>
                  <div className="col-span-2 px-4 py-3 text-right">Received</div>
                  <div className="col-span-2 px-4 py-3">UoM</div>
                </div>
                {items.filter((item) => item.type === 'product' && item.subProductId && item.receivedQty > 0).map((item) => (
                  <div key={item.id} className="grid grid-cols-12 items-center border-t border-gray-100">
                    <div className="col-span-4 px-4 py-3"><div className="font-medium text-gray-900">{item.subProductName}</div>{item.sku && <div className="text-xs text-gray-500">{item.sku}</div>}</div>
                    <div className="col-span-2 px-4 py-3 text-sm text-gray-600">{item.sizeName || '-'}</div>
                    <div className="col-span-2 px-4 py-3 text-right text-gray-600">{item.quantity}</div>
                    <div className="col-span-2 px-4 py-3 text-right font-semibold text-green-600">{item.receivedQty}</div>
                    <div className="col-span-2 px-4 py-3 text-sm text-gray-600">{item.uom}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <PiCheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-900">Ready to Validate</h4>
                    <p className="mt-1 text-sm text-green-700">
                      Click validate to update inventory with {items.filter((i) => i.type === 'product' && i.subProductId && i.receivedQty > 0).reduce((sum, item) => sum + item.receivedQty, 0)} items.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setActiveStep('receive')} className="h-10">Back</Button>
                  <Button onClick={handleValidateReceipt} isLoading={isLoading} className="h-10 bg-green-600 text-white hover:bg-green-700">
                    <PiCheck className="mr-2 h-4 w-4" /> Validate Receipt
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
