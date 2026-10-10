'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import {
  inventoryAdjustmentService,
  AdjustmentError,
} from '@/services/inventoryAdjustment.service';
import { adjustmentTarget, type AdjustmentMode } from './inventory-adjustment-entry-data';
export function useAdjustmentEntry(token: string, done: () => void) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [warehouse, setWarehouse] = useState('');
  const [product, setProduct] = useState('');
  const [size, setSize] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<AdjustmentMode>('count');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const saving = useRef(false),
    generation = useRef(0);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const load = useCallback(async () => {
    if (saving.current) return;
    const id = ++generation.current;
    setLoading(true);
    setError('');
    setQuantity('');
    try {
      const [stock, places] = await Promise.all([
        warehouseStockService.getAllStock(token, { includeUnstocked: true }),
        warehouseService.getWarehouses(token, { isActive: true }),
      ]);
      if (id !== generation.current) return;
      const active = (places.data as Warehouse[]).filter((w) => w.isActive !== false);
      setRows(stock.data);
      setWarehouses(active);
      setNeedsRefresh(false);
      setLoadFailed(false);
      setWarehouse((prior) =>
        active.some((w) => w._id === prior)
          ? prior
          : (active.find((w) => w.isDefault) || active[0])?._id || '',
      );
    } catch (e) {
      if (id === generation.current) {
        setRows([]);
        setWarehouses([]);
        setLoadFailed(true);
        setError(e instanceof Error ? e.message : 'Could not load current stock');
      }
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void load();
    return () => {
      ++generation.current;
    };
  }, [load]);
  const products = Array.from(
    new Map(
      rows
        .filter((r) => r.subProductId && r.sizeId)
        .map((r) => [
          r.subProductId,
          { id: r.subProductId, label: [r.productName, r.sku].filter(Boolean).join(' · ') },
        ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const sizes = Array.from(
    new Map(
      rows
        .filter((r) => r.subProductId === product && r.sizeId)
        .map((r) => [r.sizeId, { id: r.sizeId, label: r.sizeName }]),
    ).values(),
  );
  const row = rows.find(
    (r) => r.warehouseId === warehouse && r.subProductId === product && r.sizeId === size,
  );
  const current = row?.currentQuantity ?? 0,
    reserved = row?.reservedQuantity ?? 0;
  const preview = adjustmentTarget(mode, quantity, current, reserved);
  const invalid =
    loading ||
    needsRefresh ||
    loadFailed ||
    !warehouses.some((w) => w._id === warehouse) ||
    !products.some((p) => p.id === product) ||
    !sizes.some((s) => s.id === size) ||
    !!preview.error ||
    !reason.trim() ||
    reason.trim().length > 200 ||
    notes.trim().length > 1000 ||
    reference.trim().length > 100;
  function changeSelection(set: (value: string) => void, value: string) {
    set(value);
    setQuantity('');
    if (!needsRefresh && !loadFailed) setError('');
  }
  function selectProduct(id: string) {
    setProduct(id);
    setSize(rows.find((r) => r.subProductId === id && r.sizeId)?.sizeId || '');
    setQuantity('');
    if (!needsRefresh && !loadFailed) setError('');
  }
  async function submit() {
    if (saving.current || invalid) return;
    const input = {
      warehouseId: warehouse,
      subProductId: product,
      sizeId: size,
      targetQuantity: preview.target,
      expectedQuantity: current,
      reason: reason.trim(),
      notes: notes.trim(),
      reference: reference.trim(),
    };
    const signature = JSON.stringify(input);
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      if (operation.current?.signature !== signature)
        operation.current = { signature, id: crypto.randomUUID() };
      await inventoryAdjustmentService.create(token, {
        ...input,
        requestId: operation.current!.id,
      });
      toast.success('Adjustment saved');
      done();
    } catch (e) {
      if (e instanceof AdjustmentError && e.status === 409) setNeedsRefresh(true);
      setError(e instanceof Error ? e.message : 'Could not save adjustment');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return {
    products,
    sizes,
    warehouses,
    loading,
    busy,
    error,
    needsRefresh,
    loadFailed,
    warehouse,
    setWarehouse: (id: string) => changeSelection(setWarehouse, id),
    product,
    selectProduct,
    size,
    setSize: (id: string) => changeSelection(setSize, id),
    search,
    setSearch,
    mode,
    setMode: (value: AdjustmentMode) =>
      changeSelection((id) => setMode(id as AdjustmentMode), value),
    quantity,
    setQuantity,
    reason,
    setReason,
    notes,
    setNotes,
    reference,
    setReference,
    current,
    reserved,
    preview,
    invalid,
    load,
    submit,
  };
}
