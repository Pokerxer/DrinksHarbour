'use client';

import { useEffect } from 'react';
import type { FC } from 'react';
import {
  PiCaretRight,
  PiDownloadSimple,
  PiTable,
  PiCopy,
  PiTrash,
  PiCurrencyDollar,
  PiReceipt,
  PiProhibit,
  PiUsers,
  PiEnvelope,
  PiCheckCircle,
} from 'react-icons/pi';

interface ActionItem {
  icon: FC<{ className?: string }>;
  label: string;
  action: string;
}

const ITEMS: ActionItem[] = [
  { icon: PiDownloadSimple, label: 'Export', action: 'export' },
  { icon: PiTable, label: 'Insert in spreadsheet', action: 'spreadsheet' },
  { icon: PiCopy, label: 'Duplicate', action: 'duplicate' },
  { icon: PiTrash, label: 'Delete', action: 'delete' },
  { icon: PiCurrencyDollar, label: 'Accrued Revenue Entry', action: 'accrued-revenue' },
  { icon: PiReceipt, label: 'Create invoice(s)', action: 'create-invoice' },
  { icon: PiProhibit, label: 'Cancel', action: 'cancel' },
  { icon: PiUsers, label: 'Add/Remove Followers', action: 'followers' },
  { icon: PiEnvelope, label: 'Send an email', action: 'send-email' },
  { icon: PiCheckCircle, label: 'Mark Quotation as Sent', action: 'mark-sent' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

export default function SalesListActionDropdown({ open, onClose, onAction, triggerRef }: Props) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
      {ITEMS.map((item) => (
        <button
          key={item.action}
          type="button"
          onClick={() => { onAction(item.action); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
          aria-label={item.label}
        >
          <item.icon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 text-left">{item.label}</span>
          <PiCaretRight className="h-3.5 w-3.5 text-gray-400" />
        </button>
      ))}
    </div>
  );
}
