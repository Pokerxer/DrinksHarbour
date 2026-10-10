'use client';
import { useEffect, useState } from 'react';
import { pricelistService } from '@/services/pricelist.service';
import { subproductService } from '@/services/subproduct.service';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';
import type {
  CatalogProduct,
  PricelistLite,
} from './inventory-pricelist-print';
import {
  loadPricelistDetails,
  type PricelistDetailState,
} from './inventory-pricelist-data';

export function useInventoryPricelistData(
  token: string,
  selectedIds: string[],
  needsCatalog: boolean
) {
  const [pricelists, setPricelists] = useState<PricelistLite[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [details, setDetails] = useState<Record<string, PricelistDetailState>>(
    {}
  );
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [warehouseLoading, setWarehouseLoading] = useState(true);
  const [warehouseError, setWarehouseError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const idsKey = JSON.stringify(
    Array.from(new Set(selectedIds)).filter(Boolean).sort()
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setListLoading(true);
    setListError('');
    setWarehouseLoading(true);
    setWarehouseError('');
    async function lists() {
      try {
        const all: PricelistLite[] = [];
        for (let page = 1; ; page++) {
          const response = await pricelistService.list(token, {
            page,
            limit: 100,
          });
          const data = response.data;
          if (!Array.isArray(data?.pricelists))
            throw new Error('Pricelist directory was not returned');
          all.push(...(data.pricelists as PricelistLite[]));
          if (cancelled) return;
          if (all.length >= data.total || data.pricelists.length === 0) break;
        }
        if (!cancelled) setPricelists(all);
      } catch (error) {
        if (!cancelled)
          setListError(
            error instanceof Error ? error.message : 'Could not load pricelists'
          );
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }
    void lists();
    warehouseService
      .getWarehouses(token)
      .then((response) => {
        if (cancelled) return;
        const data = (response as { data?: Warehouse[] }).data;
        if (!Array.isArray(data))
          throw new Error('Warehouse directory was not returned');
        setWarehouses(data as Warehouse[]);
      })
      .catch(() => {
        if (!cancelled)
          setWarehouseError('Could not load warehouse contact details');
      })
      .finally(() => {
        if (!cancelled) setWarehouseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const ids = JSON.parse(idsKey) as string[];
    setDetails({});
    void loadPricelistDetails(ids, (id) =>
      pricelistService.get(id, token)
    ).then((result) => {
      if (!cancelled) setDetails(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token, idsKey, attempt]);

  useEffect(() => {
    if (!needsCatalog || !token) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogLoaded(false);
    setCatalogError('');
    async function load() {
      try {
        const all: CatalogProduct[] = [];
        for (let page = 1; ; page++) {
          const response = await subproductService.getSubProducts(token, {
            page,
            limit: 100,
          });
          const payload = response as {
            data?: {
              subProducts: CatalogProduct[];
              pagination?: { hasNext?: boolean };
            };
            subProducts?: CatalogProduct[];
            pagination?: { hasNext?: boolean };
          };
          const data = payload.data ?? payload;
          if (!Array.isArray(data.subProducts))
            throw new Error('Product catalogue was not returned');
          all.push(...(data.subProducts as CatalogProduct[]));
          if (cancelled) return;
          if (!data.pagination?.hasNext) break;
        }
        if (!cancelled) {
          setCatalog(all);
          setCatalogLoaded(true);
        }
      } catch (error) {
        if (!cancelled)
          setCatalogError(
            error instanceof Error ? error.message : 'Could not load catalogue'
          );
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [needsCatalog, token, attempt]);

  const detailErrors = selectedIds
    .filter(Boolean)
    .map((id) =>
      details[id]?.status === 'error'
        ? `${pricelists.find((p) => p._id === id)?.name ?? id}: ${details[id].error}`
        : ''
    )
    .filter(Boolean);
  const unavailable =
    !listLoading && !listError
      ? selectedIds.filter((id) => id && !pricelists.some((p) => p._id === id))
      : [];
  const ready =
    !!token &&
    !listLoading &&
    !listError &&
    !warehouseLoading &&
    !warehouseError &&
    !unavailable.length &&
    selectedIds
      .filter(Boolean)
      .every((id) => details[id]?.status === 'ready') &&
    (!needsCatalog || (catalogLoaded && !catalogLoading && !catalogError));
  return {
    pricelists,
    warehouses,
    catalog,
    details,
    listLoading,
    catalogLoading,
    ready,
    errors: [
      listError,
      warehouseError,
      ...(needsCatalog ? [catalogError] : []),
      ...detailErrors,
      ...unavailable.map(
        () =>
          'A selected pricelist is no longer available. Remove it or choose another.'
      ),
    ].filter(Boolean),
    retry: () => setAttempt((n) => n + 1),
  };
}
