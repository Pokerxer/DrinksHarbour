'use client';
import React from 'react';
import * as Icon from 'react-icons/pi';

export default function BuilderHeader({ customerStatus, busy, onSubmit, canSubmit, onOpenCatalog, onOpenScan }: {
  /** 'Registered customer — attaches to their account' | 'Guest order' | 'Checking…' */
  customerStatus: string;
  busy: boolean; canSubmit: boolean; onSubmit: () => void;
  onOpenCatalog: () => void; onOpenScan: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon.PiWhatsappLogoBold size={22} className="text-green-600" />
        <div>
          <h1 className="font-lexend text-base font-bold text-gray-900">New WhatsApp order</h1>
          <p className="text-xs text-gray-500">{customerStatus}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onOpenCatalog}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          <Icon.PiSquaresFour size={14} /> Catalogue
        </button>
        <button type="button" onClick={onOpenScan}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          <Icon.PiCamera size={14} /> Scan &amp; Match
        </button>
        <button type="button" onClick={onSubmit} disabled={!canSubmit || busy}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50">
          <Icon.PiCheckBold size={14} /> {busy ? 'Creating…' : 'Create order'}
        </button>
      </div>
    </div>
  );
}
