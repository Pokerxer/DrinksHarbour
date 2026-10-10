'use client';
import { useState, useRef, useEffect } from 'react';
import { posApi } from '../api';
import { usePOSShops, usePOSActiveShop } from '../store';
import type { POSShop } from '../types';
import NewShopModal from './pos-new-shop-modal';
import { PiCaretDown, PiPlus, PiCheck } from 'react-icons/pi';
const BUILT_IN: POSShop[] = [
  {
    _id: 'retail',
    name: 'RETAIL',
    mode: 'retail',
    color: '#f97316',
    description: 'Front-counter sales',
    active: true,
    createdAt: '',
  },
];

export default function ShopSelector({ token }: { token: string }) {
  const { shops, setShops } = usePOSShops();
  const { activeShopId, setActiveShopId } = usePOSActiveShop();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeId = activeShopId ?? 'retail';
  const allShops = [...BUILT_IN, ...shops];
  const active = allShops.find((s) => s._id === activeId) ?? BUILT_IN[0];

  useEffect(() => {
    posApi
      .listShops(token)
      .then(({ shops: loaded }) => setShops(loaded))
      .catch(() => {});
  }, [token, setShops]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <>
      <div ref={ref} className="ml-2 min-w-0 md:relative md:ml-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Select shop: ${active.name}`}
          aria-expanded={open}
          aria-controls="pos-shop-menu"
          className="flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-800 transition-colors hover:border-gray-300 hover:bg-white sm:px-3 sm:text-sm"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: active.color }}
          />
          <span className="max-w-[40px] truncate uppercase min-[380px]:max-w-[72px] sm:max-w-[120px]">
            {active.name}
          </span>
          <span className="hidden rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600 lg:inline">
            {active.mode === 'retail' ? 'CASHIER' : 'MANAGER'}
          </span>
          <PiCaretDown
            className={`h-3 w-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            id="pos-shop-menu"
            className="absolute inset-x-2 top-full z-50 mt-1 max-w-[calc(100vw-1rem)] rounded-xl border border-gray-100 bg-white shadow-xl md:inset-x-auto md:left-0 md:w-64"
          >
            <div className="px-3 pb-1 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Your Shops
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {allShops.map((shop) => (
                <button
                  key={shop._id}
                  type="button"
                  onClick={() => {
                    setActiveShopId(shop._id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    activeId === shop._id
                      ? 'bg-[#fef2f2] text-[#b20202]'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: shop.color }}
                  />
                  <span className="flex-1 truncate font-medium uppercase">
                    {shop.name}
                  </span>
                  <span className="text-[10px] capitalize text-gray-400">
                    {shop.mode}
                  </span>
                  {activeId === shop._id && (
                    <PiCheck className="h-3.5 w-3.5 shrink-0 text-[#b20202]" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowModal(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#b20202] transition-colors hover:bg-[#fef2f2]"
              >
                <PiPlus className="h-4 w-4" />
                New Shop
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewShopModal
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={(shop) => setShops((prev) => [...prev, shop])}
        />
      )}
    </>
  );
}
