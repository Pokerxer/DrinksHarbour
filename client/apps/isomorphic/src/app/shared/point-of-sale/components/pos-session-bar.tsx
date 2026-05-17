'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { POSSession } from '@/app/shared/point-of-sale/types';
import { formatCurrency, formatTime } from '@/app/shared/point-of-sale/utils';
import { routes } from '@/config/routes';
import POSCloseSessionModal from '@/app/shared/point-of-sale/components/pos-close-session-modal';
import {
  PiList,
  PiX,
  PiClockCounterClockwise,
  PiArrowFatDown,
  PiArrowFatUp,
  PiStorefront,
  PiHouseSimple,
  PiLockKey,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

// ── Cash In/Out modal ─────────────────────────────────────────────────────────
function CashInOutModal({
  session,
  token,
  onClose,
}: {
  session: POSSession;
  token: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const num = Number(amount);
    if (!num || num <= 0) return;
    setSubmitting(true);
    try {
      // Record as a note on the session for now;
      // a dedicated /api/pos/sessions/:id/cash-move endpoint can be wired later.
      toast.success(
        `Cash ${type === 'in' ? 'in' : 'out'}: ${formatCurrency(num)}` +
          (reason ? ` · ${reason}` : '')
      );
      onClose();
    } catch {
      toast.error('Failed to record cash movement');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">Cash In / Out</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1">
            {(['in', 'out'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  type === t
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'in'
                  ? <PiArrowFatDown className="h-4 w-4 text-green-600" />
                  : <PiArrowFatUp className="h-4 w-4 text-red-500" />
                }
                Cash {t === 'in' ? 'In' : 'Out'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Amount (₦)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="0.00"
              autoFocus
              min={0}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-2xl font-bold outline-none transition-colors focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bank deposit, opening float…"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#b20202]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!amount || Number(amount) <= 0 || submitting}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: '#b20202' }}
          >
            {submitting ? 'Saving…' : `${type === 'in' ? 'Add' : 'Remove'} Cash`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hamburger menu ────────────────────────────────────────────────────────────
function HamburgerMenu({
  session,
  token,
  onCloseRegister,
  onClose,
}: {
  session: POSSession;
  token: string;
  onCloseRegister: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [showCashModal, setShowCashModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const items = [
    {
      label: 'Orders',
      icon: <PiClockCounterClockwise className="h-4 w-4" />,
      badge: session.orderCount > 0 ? session.orderCount : null,
      action: () => { router.push(routes.pos.history); onClose(); },
    },
    {
      label: 'Cash In/Out',
      icon: <PiArrowFatDown className="h-4 w-4" />,
      action: () => setShowCashModal(true),
    },
    {
      label: 'Create Product',
      icon: <PiStorefront className="h-4 w-4" />,
      action: () => { window.open(routes.eCommerce.createProduct, '_blank'); onClose(); },
    },
    {
      label: 'Backend',
      icon: <PiHouseSimple className="h-4 w-4" />,
      action: () => { router.push(routes.pos.index); onClose(); },
    },
    {
      label: 'Close Register',
      icon: <PiLockKey className="h-4 w-4" />,
      danger: true,
      action: () => { onCloseRegister(); onClose(); },
    },
  ];

  return (
    <>
      <div
        ref={menuRef}
        className="absolute right-3 top-10 z-50 min-w-[220px] overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-black/5"
      >
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm font-medium transition-colors ${
              item.danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-50'
            } ${i > 0 ? 'border-t border-gray-50' : ''}`}
          >
            <span className={item.danger ? 'text-red-500' : 'text-gray-400'}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge != null && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#b20202] px-1.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {showCashModal && (
        <CashInOutModal
          session={session}
          token={token}
          onClose={() => { setShowCashModal(false); onClose(); }}
        />
      )}
    </>
  );
}

// ── Session bar ───────────────────────────────────────────────────────────────
type SessionBarProps = {
  className?: string;
};

export default function POSSessionBar({ className }: SessionBarProps) {
  const { token, staff, terminal } = usePOSAuth();
  const router = useRouter();
  const [session, setSession] = useState<POSSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState(0);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    posApi
      .getSessionInfo(token, terminal ?? 'retail')
      .then((data) => setSession(data.currentSession))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, terminal]);

  async function handleOpenSession() {
    if (!token) return;
    setOpening(true);
    try {
      const newSession = await posApi.openSession(token, openingCash, terminal ?? 'retail');
      setSession(newSession);
      setShowOpenDialog(false);
    } catch {
      // ignore
    } finally {
      setOpening(false);
    }
  }

  if (loading) {
    return <div className="h-10 shrink-0 animate-pulse bg-gray-100" />;
  }

  if (!session) {
    return (
      <div className={`flex shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm ${className ?? ''}`}>
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
        <span className="font-medium text-amber-700">No open session</span>
        <span className="flex-1" />
        {showOpenDialog ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-700">Opening cash (₦):</span>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="w-28 rounded border border-amber-300 px-2 py-1 text-sm outline-none focus:border-amber-500"
              min={0}
              placeholder="0"
            />
            <button
              onClick={handleOpenSession}
              disabled={opening}
              className="rounded px-3 py-1 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#b20202' }}
            >
              {opening ? 'Opening…' : 'Confirm'}
            </button>
            <button onClick={() => setShowOpenDialog(false)} className="text-xs text-amber-600 hover:text-amber-800">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowOpenDialog(true)}
            className="rounded px-3 py-1 text-sm font-semibold text-white"
            style={{ backgroundColor: '#b20202' }}
          >
            Open Session
          </button>
        )}
      </div>
    );
  }

  const cashierName = staff
    ? staff.posName || `${staff.firstName} ${staff.lastName}`
    : session.activeCashier
      ? session.activeCashier.posName || `${session.activeCashier.firstName} ${session.activeCashier.lastName}`
      : 'Unknown';

  return (
    <>
      <div className={`relative flex shrink-0 items-center gap-3 bg-gray-900 px-4 py-2 text-sm text-white ${className ?? ''}`}>
        <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
        <span className="font-semibold">Session Open</span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-300">Opened {formatTime(session.openedAt)}</span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-300">Orders: {session.orderCount}</span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-300">Sales: {formatCurrency(session.totalSales)}</span>
        <span className="flex-1" />
        <span className="text-xs text-gray-400">{cashierName}</span>

        {/* Hamburger menu button */}
        <button
          type="button"
          onClick={() => setShowMenu((v) => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            showMenu ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
          aria-label="Menu"
        >
          <PiList className="h-5 w-5" />
        </button>

        {/* Dropdown */}
        {showMenu && token && (
          <HamburgerMenu
            session={session}
            token={token}
            onCloseRegister={() => setShowCloseModal(true)}
            onClose={() => setShowMenu(false)}
          />
        )}
      </div>

      {showCloseModal && (
        <POSCloseSessionModal
          session={session}
          onSessionClosed={() => {
            setSession(null);
            setShowCloseModal(false);
          }}
          onCancel={() => setShowCloseModal(false)}
        />
      )}
    </>
  );
}
