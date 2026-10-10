'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { planningRequest } from '@/services/notificationInsights.service';
export interface PreparedWarehouseTransfer {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  subProductId: string;
  sizeId: string;
  productName: string;
  sizeName: string;
  sku: string;
  quantity: number;
  sourceStock: number;
  unitCost: number;
  wholesalePrice: number;
  packSize: number;
  reference: { key: string; coverDays: number };
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const refId = (v: unknown) => (typeof v === 'string' ? v : record(v)._id);
export function useWarehouseTransferPrefill(
  token: string,
  scope: string,
  disabled: boolean,
  onLoad: (data: PreparedWarehouseTransfer) => void,
  onReset: () => void
) {
  const params = useSearchParams(),
    query = params.toString(),
    requested = params.get('warehouseRecommendation') === '1',
    identity = `${scope}:${query}`;
  const [state, setState] = useState({
    identity,
    loading: requested,
    error: '',
    reference: null as PreparedWarehouseTransfer['reference'] | null,
  });
  useEffect(() => {
    if (!requested || disabled || !token) return;
    const abort = new AbortController();
    onReset();
    setState({ identity, loading: true, error: '', reference: null });
    const load = async () => {
      const p = new URLSearchParams(query),
        ids = [
          'sourceWarehouseId',
          'destinationWarehouseId',
          'subProductId',
          'sizeId',
        ];
      if (ids.some((k) => !/^[a-f\d]{24}$/i.test(p.get(k) || '')))
        throw new Error(
          'Invalid warehouse transfer preparation. Return to warehouse alerts.'
        );
      const sourceId = p.get('sourceWarehouseId')!,
        destinationId = p.get('destinationWarehouseId')!,
        productId = p.get('subProductId')!,
        sizeId = p.get('sizeId')!,
        quantity = Number(p.get('quantity')),
        coverDays = Number(p.get('coverDays'));
      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        ![7, 14, 30].includes(coverDays) ||
        sourceId === destinationId
      )
        throw new Error('Invalid warehouse transfer quantity or destination.');
      const plan = await planningRequest(
        token,
        'warehouse-risk',
        `coverDays=${coverDays}`,
        abort.signal,
        true
      );
      const line = plan.lines.find(
          (l) =>
            l.subProductId === productId &&
            l.sizeId === sizeId &&
            l.warehouseId === destinationId
        ),
        source = line?.transferPlan?.sources.find(
          (s) => s.sourceWarehouseId === sourceId
        );
      if (!line || !source || quantity > source.recommendedUnits)
        throw new Error(
          'Transfer allocation changed. Return to warehouse alerts and review it again.'
        );
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/warehouses/${sourceId}/stock`,
        {
          signal: abort.signal,
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = record(await response.json()).data;
      if (!response.ok || !Array.isArray(data))
        throw new Error('Unable to verify current source stock and prices.');
      const stock = data
        .map(record)
        .find(
          (r) => refId(r.subProduct) === productId && refId(r.size) === sizeId
        );
      if (!stock)
        throw new Error(
          'Source stock changed. Review the transfer recommendation again.'
        );
      const size = record(stock.size),
        product = record(stock.subProduct),
        price = size.costPrice ?? product.costPrice;
      const available =
        Number(stock.currentQuantity) - Number(stock.reservedQuantity ?? 0);
      if (
        !Number.isFinite(available) ||
        available < quantity ||
        typeof price !== 'number' ||
        !Number.isFinite(price) ||
        price < 0
      )
        throw new Error(
          'Current source stock or cost is unavailable. Review the transfer first.'
        );
      if (abort.signal.aborted) return;
      const reference = { key: line.key, coverDays };
      onLoad({
        sourceWarehouseId: sourceId,
        destinationWarehouseId: destinationId,
        subProductId: productId,
        sizeId,
        productName: line.productName,
        sizeName: line.sizeName,
        sku: line.sku,
        quantity,
        sourceStock: available,
        unitCost: price,
        wholesalePrice:
          typeof size.wholesalePrice === 'number' ? size.wholesalePrice : 0,
        packSize:
          Number.isInteger(size.unitsPerPack) && Number(size.unitsPerPack) > 0
            ? Number(size.unitsPerPack)
            : 1,
        reference,
      });
      setState({ identity, loading: false, error: '', reference });
    };
    void load().catch((e) => {
      if (!abort.signal.aborted)
        setState({
          identity,
          loading: false,
          error: e instanceof Error ? e.message : 'Unable to prepare transfer.',
          reference: null,
        });
    });
    return () => abort.abort();
  }, [requested, query, identity, token, disabled, onLoad, onReset]);
  return !requested
    ? { loading: false, error: '', reference: null }
    : state.identity === identity
      ? state
      : { loading: true, error: '', reference: null };
}
