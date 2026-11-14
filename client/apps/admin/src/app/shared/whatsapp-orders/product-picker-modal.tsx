'use client';

import React, { useEffect, useState } from 'react';
import * as Icon from 'react-icons/pi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface PickedLine {
  productId: string; subProductId: string; sizeId: string;
  productName: string; sizeName: string; tenantId: string; tenantName: string;
  unitPrice: number; quantity: number;
}

/** REAL `GET /api/subproducts` row shape (tenantAdminOrSuperAdmin route →
 *  getMySubProducts). For a platform admin with no tenant scope the service
 *  returns every tenant's subproducts with `tenant` populated as {name, slug}
 *  and `product` as {name, …}. Search matches SKU and product name. */
interface CatalogSize {
  _id: string; displayName?: string; size?: string;
  sellingPrice?: number; availableStock?: number; stock?: number;
}
interface CatalogSubProduct {
  _id: string; sku?: string;
  product?: { _id?: string; name?: string } | null;
  tenant?: { _id?: string; name?: string } | null;
  sellWithoutSizeVariants?: boolean;
  sizes?: CatalogSize[];
}

/** The server is the pricing authority (manual orders are re-priced by the
 *  pricing pipeline at submit). This endpoint exposes no marketplace-customer
 *  price for platform admins without a tenant scope — the
 *  `view=catalogue&pricing=true` sales-catalogue view requires one — so the
 *  tenant's Size.sellingPrice (retail, never cost price) is shown as the
 *  advisory display price. */
const sizePrice = (s: CatalogSize): number => Number(s.sellingPrice ?? 0);
const sizeStock = (s: CatalogSize): number => Number(s.availableStock ?? s.stock ?? 0);

export default function ProductPickerModal({ open, onClose, token, onAdd }: {
  open: boolean; onClose: () => void; token: string; onAdd: (lines: PickedLine[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CatalogSubProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Record<string, PickedLine>>({});

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true); setError('');
    const t = setTimeout(async () => {
      try {
        // limit 60: the newest 20 subproducts are frequently all out of stock,
        // which would render the picker as empty — 60 reliably includes
        // sellable listings, and search narrows beyond that.
        const params = new URLSearchParams({ page: '1', limit: '60', status: 'active', search, sort: 'createdAt', order: 'desc' });
        const res = await fetch(`${API_URL}/api/subproducts?${params}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        const body = (await res.json()) as {
          success?: boolean; message?: string;
          data?: { subProducts?: CatalogSubProduct[] };
        };
        if (!res.ok || !body.success) throw new Error(body.message || 'Could not load the catalogue');
        setRows(body.data?.subProducts || []);
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the catalogue'); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [open, search, token]);

  if (!open) return null;

  const toggle = (sp: CatalogSubProduct, size: CatalogSize) => {
    const key = `${sp._id}:${size._id}`;
    setPicked(p => {
      const next = { ...p };
      if (next[key]) delete next[key];
      else {
        next[key] = {
          productId: sp.product?._id || '',
          subProductId: sp._id, sizeId: size._id,
          productName: sp.product?.name || sp.sku || 'Product',
          sizeName: size.displayName || size.size || '',
          tenantId: sp.tenant?._id || '',
          tenantName: sp.tenant?.name || 'Tenant',
          unitPrice: sizePrice(size), quantity: 1,
        };
      }
      return next;
    });
  };

  const chosen = Object.values(picked);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="font-bold text-stone-900 flex items-center gap-2"><Icon.PiMagnifyingGlassBold size={18} className="text-red-700" /> Pick products</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1"><Icon.PiXBold size={16} /></button>
        </div>
        <div className="px-5 pt-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search whisky, wine, brand…"
            className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:border-red-400 outline-none" />
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && <p className="text-center text-stone-400 text-sm py-8">Loading catalogue…</p>}
          {error && <p className="text-center text-red-600 text-sm py-8">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="text-center text-stone-400 text-sm py-8">Nothing matches that search.</p>
          )}
          {!loading && !error && rows.map(sp => {
            const tenantName = sp.tenant?.name || 'Tenant';
            const sizes = (sp.sizes || []).filter(s => sizePrice(s) > 0 && sizeStock(s) > 0);
            if (sizes.length === 0) return null;
            return (
              <div key={sp._id} className="border border-stone-100 rounded-xl p-3">
                <p className="text-sm font-bold text-stone-900">{sp.product?.name || sp.sku || 'Product'}</p>
                <p className="text-xs text-stone-400 mb-2">{tenantName}</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(s => {
                    const key = `${sp._id}:${s._id}`;
                    const active = Boolean(picked[key]);
                    return (
                      <button key={s._id} type="button" onClick={() => toggle(sp, s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${active ? 'border-red-700 bg-red-50 text-red-700' : 'border-stone-200 text-stone-700 hover:border-stone-300'}`}>
                        {s.displayName || s.size} · {`₦${sizePrice(s).toLocaleString()}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500">{chosen.length} line{chosen.length === 1 ? '' : 's'} selected</span>
          <button type="button" disabled={chosen.length === 0} onClick={() => onAdd(chosen)}
            className="px-4 py-2 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            Add to order
          </button>
        </div>
      </div>
    </div>
  );
}
