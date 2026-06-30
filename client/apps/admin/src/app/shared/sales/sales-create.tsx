// client/apps/admin/src/app/shared/sales/sales-create.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
  type SalesOrderAddress,
} from '@/services/salesOrder.service';
import type {
  POSCustomer,
  POSCartItem,
  POSBundleDeal,
} from '@/app/shared/point-of-sale/types';
import { posApi } from '@/app/shared/point-of-sale/api';
import { getEffectiveBundlePriceForItem } from '@/app/shared/point-of-sale/store';
import { useSalesCustomerPricelist } from './use-sales-customer-pricelist';
import { addressesDiffer } from './sales-helpers';
import SalesCreateHeader from './sales-create-header';
import SalesCustomerBar from './sales-customer-bar';
import SalesLineTable, {
  type DraftLine,
  type PricedLine,
} from './sales-line-table';
import SalesTotals from './sales-totals';
import SalesOtherInfoTab from './sales-other-info-tab';
import SalesCatalogModal from './sales-catalog-modal';
import SalesScanDrawer from './sales-scan-drawer';
import SalesPrintSheet, { type PrintSheetType } from './sales-print-sheet';
import type { ProductLineSelection } from './product-line-search';
import { subproductService } from '@/services/subproduct.service';
import type { CreateTab } from './sales-stage-pill';

function blankLine(lineType: DraftLine['lineType'] = 'product'): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    lineType,
    subProductId: '',
    name: '',
    sku: '',
    quantity: 1,
    baseUnitPrice: 0,
    discount: 0,
    discountType: 'fixed',
    taxRate: 0,
    costPrice: 0,
    priceOverridden: false,
    description: '',
  };
}

/** Live unit price after pricelist + bundle rules, unless the operator overrode it.
 *  Section/note lines carry no price. */
function liveUnitPrice(line: DraftLine, pricelist: unknown): number {
  if (line.lineType !== 'product') return 0;
  if (line.priceOverridden) return line.baseUnitPrice;
  if (!line.subProductId || !pricelist) return line.baseUnitPrice;
  const pricingItem: POSCartItem = {
    subProductId: line.subProductId,
    productId: line.product ?? line.subProductId,
    sizeId: line.sizeId,
    name: line.name,
    variant: line.sizeName ?? '',
    sku: line.sku,
    price: line.baseUnitPrice,
    quantity: line.quantity,
    discount: 0,
    stock: 0,
    costPrice: line.costPrice,
    activeBundles: line.activeBundles as POSBundleDeal[] | undefined,
    originalPrice: line.originalPrice,
  };
  return getEffectiveBundlePriceForItem(pricingItem, pricelist).price;
}

/** Resolve a line's discount to an absolute ₦ amount off the unit price, clamped
 *  so it can never exceed the unit price. Percentage discounts are converted
 *  here so the line total mirrors the backend's mapLine resolution. */
function resolveDiscount(unitPrice: number, line: DraftLine): number {
  const raw = Math.max(0, line.discount || 0);
  if (line.discountType === 'percentage') {
    return Math.round(((unitPrice * Math.min(100, raw)) / 100) * 100) / 100;
  }
  return Math.min(unitPrice, raw);
}

function lineTotalOf(unitPrice: number, line: DraftLine): number {
  const discount = resolveDiscount(unitPrice, line);
  return Math.max(0, unitPrice - discount) * line.quantity;
}

/** Map a priced draft line into the SalesOrderLineInput shape the API expects,
 *  preserving the lineType discriminator. Section/note lines carry no product
 *  reference and zero pricing so the server's totals skip them. */
function toLinePayload(l: PricedLine) {
  if (l.lineType !== 'product') {
    return {
      lineType: l.lineType,
      name: l.name || undefined,
      description: l.description || undefined,
      quantity: 0,
      unitPrice: 0,
      discount: 0,
      discountType: 'fixed' as const,
      taxRate: 0,
    };
  }
  return {
    lineType: l.lineType,
    product: l.product,
    subproduct: l.subProductId,
    size: l.sizeId,
    sku: l.sku,
    name: l.name,
    description: l.description || undefined,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: l.discount,
    discountType: l.discountType,
    taxRate: l.taxRate,
    priceOverridden: l.priceOverridden,
  };
}

export default function SalesCreate({
  mode = 'create',
  initial,
}: {
  mode?: 'create' | 'edit';
  initial?: SalesOrder;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('immediate');
  const [invoiceAddress, setInvoiceAddress] = useState<SalesOrderAddress>({});
  const [deliverDifferent, setDeliverDifferent] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<SalesOrderAddress>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<CreateTab>('lines');
  const [pricelistId, setPricelistId] = useState('');
  const [pricelistOverridden, setPricelistOverridden] = useState(false);
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? '');
  const [warehouses, setWarehouses] = useState<
    { _id: string; name: string; isDefault?: boolean }[]
  >([]);
  // D3: customer default-address fetch state.
  const [loadingCustomerAddress, setLoadingCustomerAddress] = useState(false);

  // Auto-save: tracks the ID of the draft created in create mode.
  // Uses a ref (atomic, no stale-closure issues) plus state for header display.
  const draftIdRef = useRef<string | null>(initial?._id ?? null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  // Don't start auto-saving until after the seeding effects have run (1 s grace).
  const autoSaveEnabledRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      autoSaveEnabledRef.current = true;
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  // Seed every field from the loaded document once, in edit mode.
  useEffect(() => {
    if (!initial) return;
    if (initial.customerSnapshot?.customerId) {
      const [firstName, ...rest] = (initial.customerSnapshot.name ?? '').split(
        ' '
      );
      setCustomer({
        _id: initial.customerSnapshot.customerId,
        firstName: firstName ?? '',
        lastName: rest.join(' '),
        email: initial.customerSnapshot.email,
        phone: initial.customerSnapshot.phone,
        loyaltyPoints: 0,
        walletBalance: 0,
      });
    }
    setLines(
      initial.items.map((it) => ({
        key: it._id,
        lineType: (it.lineType ?? 'product') as DraftLine['lineType'],
        subProductId: it.subproduct ?? '',
        product: it.product,
        name: it.name ?? '',
        sku: it.sku ?? '',
        sizeId: it.size,
        sizeName: undefined,
        quantity: it.quantity,
        baseUnitPrice: it.unitPrice,
        discount: it.discount,
        discountType: (it.discountType ?? 'fixed') as DraftLine['discountType'],
        taxRate: it.taxRate ?? 0,
        costPrice: 0,
        priceOverridden: !!it.priceOverridden,
        description: it.description ?? '',
      }))
    );
    setNotes(initial.notes ?? '');
    setTerms(initial.terms ?? '');
    setValidUntil(initial.validUntil ? initial.validUntil.slice(0, 10) : '');
    setPaymentTerms(initial.paymentTerms ?? 'immediate');
    setInvoiceAddress(initial.invoiceAddress ?? {});
    setDeliverDifferent(
      !!initial.deliveryAddress &&
        addressesDiffer(initial.deliveryAddress, initial.invoiceAddress)
    );
    setDeliveryAddress(initial.deliveryAddress ?? {});
    if (initial.pricelist) {
      setPricelistId(initial.pricelist);
      setPricelistOverridden(true);
    }
    if (initial.warehouseId) setWarehouseId(initial.warehouseId);
    // Seeds once when the document loads; `initial` is a stable fetch result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Fetch active warehouses once; auto-select the default if nothing is set.
  useEffect(() => {
    if (!token) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/warehouses?active=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((r) => r.json())
      .then((body) => {
        const list = body?.data?.warehouses ?? body?.data ?? [];
        setWarehouses(list);
        if (!warehouseId) {
          const def = list.find((w: { isDefault?: boolean }) => w.isDefault);
          if (def) setWarehouseId(def._id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Backfill availableStock for lines loaded from a saved order (edit mode).
  // Fetches each unique sub-product in parallel and patches the matching lines.
  useEffect(() => {
    if (!initial || !token) return;
    const ids = [
      ...new Set(
        initial.items
          .map((it) => it.subproduct)
          .filter((id): id is string => !!id)
      ),
    ];
    if (!ids.length) return;
    Promise.all(
      ids.map((id) =>
        subproductService.getSubProduct(id, token).catch(() => null)
      )
    )
      .then((results) => {
        const spMap = new Map<string, any>();
        results.forEach((res) => {
          const sp =
            res?.data?.subProduct ?? res?.subProduct ?? res?.data ?? res;
          if (sp?._id) spMap.set(sp._id, sp);
        });
        if (!spMap.size) return;
        setLines((prev) =>
          prev.map((line) => {
            if (line.lineType !== 'product' || !line.subProductId) return line;
            const sp = spMap.get(line.subProductId);
            if (!sp) return line;
            const matchedSize = sp.sizes?.find(
              (s: any) => (s._id ?? s.size) === line.sizeId
            );
            const stock =
              matchedSize?.availableStock ??
              matchedSize?.stock ??
              (sp.sizes?.length === 0
                ? (sp.availableStock ?? sp.totalStock)
                : undefined);
            if (stock == null) return line;
            return { ...line, availableStock: stock };
          })
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, token]);

  const { pricelists, resolvedId } = useSalesCustomerPricelist(
    token,
    customer?._id ?? ''
  );

  // Pricelist defaults to the customer's auto-resolved list, but the user can
  // override it; once they do, their pick sticks across customer changes.
  // In edit mode, the seeding effect above sets pricelistOverridden=true as
  // soon as the loaded document has one, so this auto-resolve effect backs off.
  useEffect(() => {
    if (!pricelistOverridden) setPricelistId(resolvedId ?? '');
  }, [resolvedId, pricelistOverridden]);

  const pricelist = useMemo(
    () => pricelists.find((p) => p._id === pricelistId) ?? null,
    [pricelists, pricelistId]
  );

  const updateLine = useCallback((key: string, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }, []);

  const addLine = useCallback(() => setLines((p) => [...p, blankLine()]), []);
  const addSection = useCallback(
    () => setLines((p) => [...p, blankLine('section')]),
    []
  );
  const addNote = useCallback(
    () => setLines((p) => [...p, blankLine('note')]),
    []
  );
  const removeLine = useCallback(
    (key: string) => setLines((p) => p.filter((l) => l.key !== key)),
    []
  );

  // Drag-and-drop reordering of lines (items, sections, notes all draggable).
  // `arrayMove` reorders by current index; we resolve the new order from the
  // dragged key + the target key so the caller passes the two keys.
  const reorderLines = useCallback((activeKey: string, overKey: string) => {
    setLines((p) => {
      const oldIndex = p.findIndex((l) => l.key === activeKey);
      const newIndex = p.findIndex((l) => l.key === overKey);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return p;
      // Inline arrayMove (avoids importing @dnd-kit/sortable here just for it).
      const next = [...p];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  }, []);

  // Catalogue modal: picking a product in the catalogue appends a new product
  // line with the same field mapping ProductLineSearch uses.
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [printState, setPrintState] = useState<{
    so: SalesOrder;
    type: PrintSheetType;
  } | null>(null);

  // Catalogue → order wiring. A line is uniquely keyed by `subProductId|sizeId`
  // (sizeId empty for sizeless). Adding is idempotent (no duplicate lines for
  // the same product+size); qty changes edit the existing line in place; remove
  // drops it. The live qty map is fed back to the modal so each card can render
  // its stepper + remove control once added.
  const catalogLineKey = (sub: string, size?: string) => `${sub}|${size ?? ''}`;

  const catalogQtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of lines) {
      if (l.lineType !== 'product' || !l.subProductId) continue;
      m[catalogLineKey(l.subProductId, l.sizeId)] = l.quantity;
    }
    return m;
  }, [lines]);

  const addProductFromCatalog = useCallback((info: ProductLineSelection) => {
    const key = catalogLineKey(info.subProductId, info.sizeId);
    setLines((p) => {
      // If a line for this product+size already exists, bump its qty instead
      // of creating a duplicate (the catalogue Add button adds 1, but the
      // operator may click it again before the card switches to a stepper).
      const idx = p.findIndex(
        (l) =>
          l.lineType === 'product' &&
          l.subProductId === info.subProductId &&
          (l.sizeId ?? '') === (info.sizeId ?? '')
      );
      if (idx >= 0) {
        const next = [...p];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...p,
        {
          ...blankLine('product'),
          subProductId: info.subProductId,
          product: info.productId,
          name: info.name,
          sku: info.sku,
          sizeId: info.sizeId,
          sizeName: info.sizeName,
          baseUnitPrice: info.sellingPrice,
          costPrice: info.costPrice,
          taxRate: info.taxRate,
          quantity: 1,
          priceOverridden: false,
          availableStock: info.availableStock,
          activeBundles: info.bundleDeals,
          originalPrice: info.originalPrice,
          description: '',
        },
      ];
    });
    // Mark just-added for the transient check (key used by the modal).
    void key;
  }, []);

  const setCatalogLineQty = useCallback(
    (info: ProductLineSelection, quantity: number) => {
      setLines((p) =>
        p.map((l) =>
          l.lineType === 'product' &&
          l.subProductId === info.subProductId &&
          (l.sizeId ?? '') === (info.sizeId ?? '')
            ? { ...l, quantity: Math.max(1, Math.round(quantity)) }
            : l
        )
      );
    },
    []
  );

  const removeCatalogLine = useCallback((info: ProductLineSelection) => {
    setLines((p) =>
      p.filter(
        (l) =>
          !(
            l.lineType === 'product' &&
            l.subProductId === info.subProductId &&
            (l.sizeId ?? '') === (info.sizeId ?? '')
          )
      )
    );
  }, []);

  const priced = useMemo<PricedLine[]>(
    () =>
      lines.map((l) => {
        const unitPrice = liveUnitPrice(l, pricelist);
        const lineTotal = lineTotalOf(unitPrice, l);
        return {
          ...l,
          unitPrice,
          lineTotal,
          taxAmount: Math.round(lineTotal * (Math.max(0, l.taxRate) / 100)),
        };
      }),
    [lines, pricelist]
  );

  // untaxedAmount = pre-discount subtotal (unitPrice × qty); discount shown separately.
  const untaxedAmount = priced
    .filter((l) => l.lineType === 'product')
    .reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountTotal = priced
    .filter((l) => l.lineType === 'product')
    .reduce((s, l) => s + resolveDiscount(l.unitPrice, l) * l.quantity, 0);
  const taxTotal = priced
    .filter((l) => l.lineType === 'product')
    .reduce((s, l) => s + l.taxAmount, 0);
  const grandTotal = untaxedAmount - discountTotal + taxTotal;
  const hasLines = lines.some((l) => l.subProductId);

  // D3: pull the customer's resolved default address (ecommerce Address, or
  // their most recent non-cancelled Order's shipping address) and merge it into
  // the invoice block (and the delivery block when they're not separate). The
  // name/phone always come from the customer; the server only fills the rest.
  const loadCustomerAddress = useCallback(
    async (c: POSCustomer) => {
      setLoadingCustomerAddress(true);
      try {
        const { address } = await posApi.getCustomerDefaultAddress(
          token,
          c._id
        );
        if (address) {
          setInvoiceAddress((prev) => ({
            ...prev,
            name:
              `${c.firstName} ${c.lastName}`.trim() ||
              address.name ||
              prev.name,
            phone: c.phone ?? address.phone ?? prev.phone,
            street: address.street ?? prev.street,
            city: address.city ?? prev.city,
            state: address.state ?? prev.state,
            country: address.country ?? prev.country,
          }));
          if (!deliverDifferent) {
            setDeliveryAddress((prev) => ({
              ...prev,
              name:
                `${c.firstName} ${c.lastName}`.trim() ||
                address.name ||
                prev.name,
              phone: c.phone ?? address.phone ?? prev.phone,
              street: address.street ?? prev.street,
              city: address.city ?? prev.city,
              state: address.state ?? prev.state,
              country: address.country ?? prev.country,
            }));
          }
        }
      } catch {
        // No toast — absence of a saved address is the common case for walk-ins.
      } finally {
        setLoadingCustomerAddress(false);
      }
    },
    [token, deliverDifferent]
  );

  // Prefill name/phone, then asynchronously pull the resolved default address.
  const handleSelectCustomer = useCallback(
    (c: POSCustomer) => {
      setCustomer(c);
      setInvoiceAddress((prev) => ({
        ...prev,
        name: `${c.firstName} ${c.lastName}`.trim(),
        phone: c.phone ?? '',
      }));
      void loadCustomerAddress(c);
    },
    [loadCustomerAddress]
  );

  const handleToggleDeliverDifferent = useCallback(
    (v: boolean) => {
      setDeliverDifferent(v);
      // When turning the separate delivery block on, seed it from the invoice
      // block if it's still empty so the operator isn't faced with a blank slate.
      setDeliveryAddress((prev) =>
        v && !prev.name && !prev.street && !prev.city ? invoiceAddress : prev
      );
    },
    [invoiceAddress]
  );

  // Shared payload builder used by both manual saves and auto-save.
  const buildPayload = useCallback(() => {
    const filled = priced.filter(
      (l) => l.lineType !== 'product' || l.subProductId
    );
    return {
      items: filled.map(toLinePayload),
      customer: customer ? customer._id : null,
      customerSnapshot: customer
        ? {
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            phone: customer.phone,
            email: customer.email,
            customerId: customer._id,
          }
        : null,
      pricelist: pricelistId || null,
      appliedPricelist: pricelist
        ? { pricelistId: pricelist._id, pricelistName: pricelist.name }
        : null,
      validUntil: validUntil || undefined,
      paymentTerms,
      invoiceAddress,
      deliveryAddress: deliverDifferent ? deliveryAddress : invoiceAddress,
      notes: notes || undefined,
      terms: terms || undefined,
      warehouseId: warehouseId || undefined,
    };
  }, [
    priced,
    customer,
    pricelistId,
    pricelist,
    validUntil,
    paymentTerms,
    invoiceAddress,
    deliveryAddress,
    deliverDifferent,
    notes,
    terms,
    warehouseId,
  ]);

  // Auto-save: debounce 3 s after any field change. In create mode, the first
  // save creates the quotation draft and patches the URL; subsequent saves use
  // update(). In edit mode, always updates initial._id.
  useEffect(() => {
    if (!token) return;
    const productLines = priced.filter(
      (l) => l.lineType === 'product' && l.subProductId
    );
    if (productLines.length === 0) return; // Nothing meaningful to save yet

    const timer = setTimeout(async () => {
      if (!autoSaveEnabledRef.current) return;
      setAutoSaveStatus('saving');
      try {
        const payload = buildPayload();
        const existingId = initial?._id ?? draftIdRef.current;
        if (existingId) {
          await salesOrderService.update(existingId, payload, token);
        } else {
          const res = await salesOrderService.create(
            { ...payload, docType: 'quotation' },
            token
          );
          const newId = res.data._id;
          draftIdRef.current = newId;
          // Update URL without triggering Next.js navigation so the form stays mounted
          window.history.replaceState(
            null,
            '',
            routes.eCommerce.salesEdit(newId)
          );
        }
        setAutoSaveStatus('saved');
      } catch {
        setAutoSaveStatus('error');
      }
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    priced,
    customer,
    notes,
    terms,
    validUntil,
    paymentTerms,
    pricelistId,
    token,
  ]);

  // Helper: ensure the draft is saved (waits for a pending auto-save or triggers
  // one immediately) and returns the document ID. Used before opening print.
  async function ensureSaved(): Promise<string | null> {
    const existingId = initial?._id ?? draftIdRef.current;
    if (existingId) return existingId;
    const productLines = priced.filter(
      (l) => l.lineType === 'product' && l.subProductId
    );
    if (productLines.length === 0) return null;
    try {
      setAutoSaveStatus('saving');
      const res = await salesOrderService.create(
        { ...buildPayload(), docType: 'quotation' },
        token
      );
      const newId = res.data._id;
      draftIdRef.current = newId;
      window.history.replaceState(null, '', routes.eCommerce.salesEdit(newId));
      setAutoSaveStatus('saved');
      return newId;
    } catch {
      setAutoSaveStatus('error');
      return null;
    }
  }

  async function handlePrint(type: 'quotation' | 'proforma') {
    const id = await ensureSaved();
    if (!id) {
      toast.error('Add at least one product before printing');
      return;
    }
    try {
      const res = await salesOrderService.get(id, token);
      setPrintState({ so: res.data, type });
      setTimeout(() => window.print(), 150);
    } catch {
      toast.error('Could not load document for printing');
    }
  }

  async function handleSaveEdit() {
    if (!initial) return;
    // Keep product lines that have a subproduct selected, plus any section/note
    // lines (which carry no subproduct but must persist).
    const filled = priced.filter(
      (l) => l.lineType !== 'product' || l.subProductId
    );
    if (filled.length === 0) {
      toast.error('Add at least one product line');
      return;
    }
    // Quantity validation only applies to product lines — section/note lines
    // intentionally carry no quantity.
    const badQty = filled.find(
      (l) => l.lineType === 'product' && !(l.quantity > 0)
    );
    if (badQty) {
      toast.error(`Quantity for "${badQty.name}" must be at least 1`);
      return;
    }
    setSaving(true);
    try {
      await salesOrderService.update(
        initial._id,
        {
          items: filled.map(toLinePayload),
          // `null` (not undefined) on clear so the server's `!== undefined` guard
          // fires and actually drops the stored customer/snapshot — undefined
          // would be JSON-omitted and silently leave the old customer in place.
          customer: customer ? customer._id : null,
          customerSnapshot: customer
            ? {
                name: `${customer.firstName} ${customer.lastName}`.trim(),
                phone: customer.phone,
                email: customer.email,
                customerId: customer._id,
              }
            : null,
          // An empty pricelist selection explicitly clears the stored pricelist.
          pricelist: pricelistId || null,
          appliedPricelist: pricelist
            ? { pricelistId: pricelist._id, pricelistName: pricelist.name }
            : null,
          validUntil: validUntil || undefined,
          paymentTerms,
          invoiceAddress,
          deliveryAddress: deliverDifferent ? deliveryAddress : invoiceAddress,
          notes: notes || undefined,
          terms: terms || undefined,
          warehouseId: warehouseId || undefined,
        },
        token
      );
      toast.success('Changes saved');
      router.push(routes.eCommerce.salesDetails(initial._id));
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save changes'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(asOrder: boolean) {
    // Keep product lines that have a subproduct selected, plus any section/note
    // lines (which carry no subproduct but must persist).
    const filled = priced.filter(
      (l) => l.lineType !== 'product' || l.subProductId
    );
    if (filled.length === 0) {
      toast.error('Add at least one product line');
      return;
    }
    // Quantity validation only applies to product lines — section/note lines
    // intentionally carry no quantity.
    const badQty = filled.find(
      (l) => l.lineType === 'product' && !(l.quantity > 0)
    );
    if (badQty) {
      toast.error(`Quantity for "${badQty.name}" must be at least 1`);
      return;
    }
    setSaving(true);
    try {
      const res = await salesOrderService.create(
        {
          docType: asOrder ? 'order' : 'quotation',
          customer: customer?._id,
          customerSnapshot: customer
            ? {
                name: `${customer.firstName} ${customer.lastName}`.trim(),
                phone: customer.phone,
                email: customer.email,
                customerId: customer._id,
              }
            : undefined,
          pricelist: pricelistId || undefined,
          appliedPricelist: pricelist
            ? { pricelistId: pricelist._id, pricelistName: pricelist.name }
            : undefined,
          items: filled.map(toLinePayload),
          validUntil: validUntil || undefined,
          paymentTerms,
          invoiceAddress,
          // Default: delivery mirrors invoice. Toggled: send the separate block.
          deliveryAddress: deliverDifferent ? deliveryAddress : invoiceAddress,
          notes: notes || undefined,
          terms: terms || undefined,
          warehouseId: warehouseId || undefined,
        },
        token
      );
      toast.success(asOrder ? 'Order created' : 'Quotation saved');
      router.push(routes.eCommerce.salesDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      <SalesCreateHeader
        mode={mode}
        initial={initial}
        saving={saving}
        hasLines={hasLines}
        autoSaveStatus={autoSaveStatus}
        onCreateOrder={() => handleSave(true)}
        onSaveQuotation={() => handleSave(false)}
        onSaveEdit={handleSaveEdit}
        onPrint={() => handlePrint('quotation')}
        onSendProForma={() => handlePrint('proforma')}
        onDuplicate={() => toast('Duplicate: coming soon')}
        onMarkAsSent={() => toast('Mark as sent: coming soon')}
        onGeneratePaymentLink={() => toast('Payment link: coming soon')}
        onAccruedRevenueEntry={() =>
          toast('Accrued revenue entry: coming soon')
        }
      />

      <SalesCustomerBar
        token={token}
        customer={customer}
        onSelectCustomer={handleSelectCustomer}
        onClearCustomer={() => setCustomer(null)}
        pricelists={pricelists as { _id: string; name: string }[]}
        pricelistId={pricelistId}
        onPricelistChange={(id) => {
          setPricelistId(id);
          setPricelistOverridden(true);
        }}
        resolvedPricelistId={resolvedId}
        validUntil={validUntil}
        onValidUntilChange={setValidUntil}
        warehouses={warehouses}
        warehouseId={warehouseId}
        onWarehouseChange={setWarehouseId}
      />

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
        <div className="flex border-b border-gray-100 px-4">
          <button
            type="button"
            onClick={() => setTab('lines')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              tab === 'lines'
                ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Order Lines
          </button>
          <button
            type="button"
            onClick={() => setTab('other')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              tab === 'other'
                ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Other Info
          </button>
        </div>

        <div className="p-5">
          {tab === 'lines' ? (
            <>
              <SalesLineTable
                token={token}
                lines={priced}
                onUpdate={updateLine}
                onAdd={addLine}
                onAddSection={addSection}
                onAddNote={addNote}
                onOpenCatalog={() => setCatalogOpen(true)}
                onOpenScan={() => setScanOpen(true)}
                onRemove={removeLine}
                onReorder={reorderLines}
                warehouseId={warehouseId || undefined}
              />
              <SalesTotals
                untaxedAmount={untaxedAmount}
                discountTotal={discountTotal}
                taxTotal={taxTotal}
                grandTotal={grandTotal}
              />
            </>
          ) : (
            <SalesOtherInfoTab
              paymentTerms={paymentTerms}
              onPaymentTermsChange={setPaymentTerms}
              invoiceAddress={invoiceAddress}
              deliveryAddress={deliveryAddress}
              deliverDifferent={deliverDifferent}
              onInvoiceChange={(patch) =>
                setInvoiceAddress((prev) => ({ ...prev, ...patch }))
              }
              onDeliveryChange={(patch) =>
                setDeliveryAddress((prev) => ({ ...prev, ...patch }))
              }
              onToggleDeliverDifferent={handleToggleDeliverDifferent}
              onLoadCustomerAddress={
                customer ? () => void loadCustomerAddress(customer) : undefined
              }
              loadingCustomerAddress={loadingCustomerAddress}
              notes={notes}
              onNotesChange={setNotes}
              terms={terms}
              onTermsChange={setTerms}
            />
          )}
        </div>
      </div>

      <SalesCatalogModal
        open={catalogOpen}
        token={token}
        pricelist={pricelist}
        qtyMap={catalogQtyMap}
        onClose={() => setCatalogOpen(false)}
        onAdd={addProductFromCatalog}
        onSetQty={setCatalogLineQty}
        onRemove={removeCatalogLine}
      />

      <SalesScanDrawer
        open={scanOpen}
        token={token}
        onClose={() => setScanOpen(false)}
        onAdd={addProductFromCatalog}
      />

      {printState && (
        <SalesPrintSheet so={printState.so} type={printState.type} />
      )}
    </div>
  );
}
