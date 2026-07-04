'use client';
import React from 'react';
import * as Icon from 'react-icons/pi';
import type { Address } from '../_types';

interface Props {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  deleting?: boolean;
}

const LABEL_ICONS: Record<string, React.ElementType> = {
  Home: Icon.PiHouseBold,
  Work: Icon.PiBriefcaseBold,
  Other: Icon.PiMapPinBold,
};

export default function AddressCard({ address, onEdit, onDelete, onSetDefault, deleting }: Props) {
  const LabelIcon = LABEL_ICONS[address.label] ?? Icon.PiMapPinBold;

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 transition-all duration-200 hover:shadow-md ${
        address.isDefaultShipping ? 'border-red-200' : 'border-stone-200 hover:border-red-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-50 text-red-700 flex items-center justify-center flex-shrink-0">
            <LabelIcon size={15} />
          </div>
          <span className="font-black text-sm text-stone-900">{address.label}</span>
          {address.isDefaultShipping && (
            <span className="text-[10px] font-bold bg-red-700 text-white px-2 py-0.5 rounded-full">
              Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:border-red-200 hover:text-red-700 transition-all"
          >
            <Icon.PiPencilSimple size={13} />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:border-red-200 hover:text-red-700 transition-all disabled:opacity-40"
          >
            {deleting ? (
              <div className="w-3 h-3 border border-red-300 border-t-red-600 rounded-full animate-spin" />
            ) : (
              <Icon.PiTrashBold size={13} />
            )}
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold text-stone-900">{address.fullName}</p>
      <p className="text-xs text-stone-500 mt-0.5">{address.addressLine1}</p>
      {address.addressLine2 && <p className="text-xs text-stone-500">{address.addressLine2}</p>}
      {address.landmark && <p className="text-xs text-stone-400 italic">{address.landmark}</p>}
      <p className="text-xs text-stone-500">
        {[address.city, address.state].filter(Boolean).join(', ')}
      </p>
      {address.phone && <p className="text-xs text-stone-400 mt-1">{address.phone}</p>}

      {!address.isDefaultShipping && (
        <button
          onClick={onSetDefault}
          className="mt-3 text-xs font-semibold text-red-700 hover:underline"
        >
          Set as default
        </button>
      )}
    </div>
  );
}
