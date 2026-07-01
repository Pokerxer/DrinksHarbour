// client/apps/admin/src/app/shared/sales/hooks/useSalesCreateForm.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SalesOrder, SalesOrderAddress } from '@/services/salesOrder.service';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';
import { posApi } from '@/app/shared/point-of-sale/api';
import { useSalesCustomerPricelist } from '../use-sales-customer-pricelist';
import { addressesDiffer } from '../sales-helpers';
import {
  blankLine,
  liveUnitPrice,
  resolveDiscount,
  lineTotalOf,
} from '../sales-create-pricing-helpers';
import type { DraftLine, PricedLine } from '../sales-line-table';
import type { ProductLineSelection } from '../product-line-search';
import type { CreateTab } from '../sales-stage-pill';
import { subproductService } from '@/services/subproduct.service';

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

export interface UseSalesCreateFormOptions {
  token: string;
  mode: 'create' | 'edit';
  initial?: SalesOrder;
}

export function useSalesCreateForm({
  token,
  mode,
  initial,
}: UseSalesCreateFormOptions) {
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
  const [loadingCustomerAddress, setLoadingCustomerAddress] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps — only `initial` should trigger; state setters are stable
  }, [initial]);

  useEffect(() => {
    if (!token) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/warehouses?active=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((r: Response) => r.json())
      .then((body: any) => {
        const list = body?.data?.warehouses ?? body?.data ?? [];
        setWarehouses(list);
        if (!warehouseId) {
          const def = list.find(
            (w: { isDefault?: boolean }) => w.isDefault
          );
          if (def) setWarehouseId(def._id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps — fetching warehouses; omit warehouseId to avoid re-fetching on selection
  }, [token]);

  useEffect(() => {
    if (!initial || !token) return;
    const ids = Array.from(
      new Set(
        initial.items
          .map((it) => it.subproduct)
          .filter((id): id is string => !!id)
      )
    );
    if (!ids.length) return;
    Promise.all(
      ids.map((id) =>
        subproductService.getSubProduct(id, token).catch(() => null)
      )
    )
      .then((results) => {
        const spMap = new Map<string, any>();
        results.forEach((res: any) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps — subproduct fetch on doc load; setters/subproductService are stable
  }, [initial, token]);

  const {
    pricelists,
    resolvedId,
  }: { pricelists: any[]; resolvedId: string | null } =
    useSalesCustomerPricelist(
      token as string,
      customer?._id ?? '',
      (warehouseId as string) || undefined
    );

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

  const reorderLines = useCallback(
    (activeKey: string, overKey: string) => {
      setLines((p) => {
        const oldIndex = p.findIndex((l) => l.key === activeKey);
        const newIndex = p.findIndex((l) => l.key === overKey);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return p;
        const next = [...p];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        return next;
      });
    },
    []
  );

  const catalogLineKey = (sub: string, size?: string) =>
    `${sub}|${size ?? ''}`;

  const catalogQtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of lines) {
      if (l.lineType !== 'product' || !l.subProductId) continue;
      m[catalogLineKey(l.subProductId, l.sizeId)] = l.quantity;
    }
    return m;
  }, [lines]);

  const addProductFromCatalog = useCallback(
    (info: ProductLineSelection) => {
      const key = catalogLineKey(info.subProductId, info.sizeId);
      setLines((p) => {
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
      void key;
    },
    []
  );

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
          taxAmount: Math.round(
            lineTotal * (Math.max(0, l.taxRate) / 100)
          ),
        };
      }),
    [lines, pricelist]
  );

  const untaxedAmount = priced
    .filter((l) => l.lineType === 'product')
    .reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountTotal = priced
    .filter((l) => l.lineType === 'product')
    .reduce((s, l) => s + resolveDiscount(l.unitPrice, l), 0);
  const taxTotal = priced
    .filter((l) => l.lineType === 'product')
    .reduce((s, l) => s + l.taxAmount, 0);
  const grandTotal = untaxedAmount - discountTotal + taxTotal;
  const hasLines = lines.some((l) => l.subProductId);

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
        // No toast
      } finally {
        setLoadingCustomerAddress(false);
      }
    },
    [token, deliverDifferent]
  );

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
      setDeliveryAddress((prev) =>
        v && !prev.name && !prev.street && !prev.city ? invoiceAddress : prev
      );
    },
    [invoiceAddress]
  );

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
        : { name: 'Walk-in Customer' },
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

  return {
    customer, setCustomer,
    lines, setLines,
    notes, setNotes,
    terms, setTerms,
    validUntil, setValidUntil,
    paymentTerms, setPaymentTerms,
    invoiceAddress, setInvoiceAddress,
    deliverDifferent, setDeliverDifferent,
    deliveryAddress, setDeliveryAddress,
    pricelistId, setPricelistId,
    pricelistOverridden, setPricelistOverridden,
    warehouseId, setWarehouseId,
    warehouses,
    loadingCustomerAddress,
    saving, setSaving,
    tab, setTab,
    catalogOpen, setCatalogOpen,
    scanOpen, setScanOpen,
    pricelist,
    pricelists,
    resolvedPricelistId: resolvedId,
    priced,
    untaxedAmount,
    discountTotal,
    taxTotal,
    grandTotal,
    hasLines,
    catalogQtyMap,
    updateLine,
    addLine,
    addSection,
    addNote,
    removeLine,
    reorderLines,
    addProductFromCatalog,
    setCatalogLineQty,
    removeCatalogLine,
    handleSelectCustomer,
    handleToggleDeliverDifferent,
    loadCustomerAddress,
    buildPayload,
  };
}
