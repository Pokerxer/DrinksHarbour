'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { posApi } from '@/app/shared/point-of-sale/api';
import {
  usePOSAuth,
  usePOSSaleSignal,
  usePOSPricelist,
  usePOSAvailablePricelists,
} from '@/app/shared/point-of-sale/store';
import { POSSession, POSCashMovement } from '@/app/shared/point-of-sale/types';
import { formatCurrency } from '@/app/shared/point-of-sale/utils';
import { routes } from '@/config/routes';
import POSCloseSessionModal from '@/app/shared/point-of-sale/components/pos-close-session-modal';
import {
  PiList,
  PiX,
  PiClockCounterClockwise,
  PiArrowFatDown,
  PiArrowFatUp,
  PiArrowDown,
  PiArrowUp,
  PiStorefront,
  PiHouseSimple,
  PiLockKey,
  PiTimer,
  PiShoppingCart,
  PiCurrencyNgn,
  PiUserCircle,
  PiWarningCircle,
  PiCaretDown,
  PiTag,
  PiCheckCircle,
  PiDeviceMobileSpeaker,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useOnlineStatus } from '../offline/use-online-status';
import { getPendingCount, runSyncEngine } from '../offline/sync';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface OfflineChipProps {
  isOnline: boolean;
  syncing: boolean;
  syncDone: boolean;
  pendingCount: number;
}

function OfflineChip({
  isOnline,
  syncing,
  syncDone,
  pendingCount,
}: OfflineChipProps) {
  if (syncDone) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Synced ✓
      </span>
    );
  }
  if (syncing) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
        <span className="h-2 w-2 animate-ping rounded-full bg-blue-500" />
        Syncing…
      </span>
    );
  }
  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        Offline
        {pendingCount > 0 && (
          <span className="ml-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] text-white">
            {pendingCount}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80">
      <span className="h-2 w-2 rounded-full bg-green-400" />
      Online
    </span>
  );
}

// ── Elapsed time ──────────────────────────────────────────────────────────────
function useElapsedTime(openedAt?: string) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!openedAt) return;
    function update() {
      const diff = Date.now() - new Date(openedAt!).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [openedAt]);

  return elapsed;
}

// ── Cash In/Out modal ─────────────────────────────────────────────────────────
function CashInOutModal({
  session,
  token,
  onClose,
  onMovementRecorded,
}: {
  session: POSSession;
  token: string;
  onClose: () => void;
  onMovementRecorded?: () => void;
}) {
  const [type, setType] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<POSCashMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    posApi
      .getCashMoves(token, session._id)
      .then((d) => setHistory(d.cashMovements || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [token, session._id]);

  async function handleSubmit() {
    const num = parseFloat(Number(amount).toFixed(2));
    if (!num || num <= 0) return;
    setSubmitting(true);
    try {
      const result = await posApi.recordCashMove(
        token,
        session._id,
        type,
        num,
        reason.trim() || undefined
      );
      setHistory(result.cashMovements || []);
      toast.success(
        `Cash ${type === 'in' ? 'In' : 'Out'}: ${formatCurrency(num)}${reason.trim() ? ` · ${reason.trim()}` : ''}`
      );
      setAmount('');
      setReason('');
      onMovementRecorded?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record cash movement');
    } finally {
      setSubmitting(false);
    }
  }

  const totalIn = history
    .filter((m) => m.type === 'in')
    .reduce((s, m) => s + m.amount, 0);
  const totalOut = history
    .filter((m) => m.type === 'out')
    .reduce((s, m) => s + m.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Cash In / Out</h2>
            <p className="text-xs text-gray-400">
              {session.terminalType || 'retail'} terminal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-64 shrink-0 flex-col space-y-4 border-r border-gray-100 px-5 py-5">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1">
              {(['in', 'out'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                    type === t
                      ? t === 'in'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'bg-white text-red-600 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t === 'in' ? (
                    <PiArrowFatDown className="h-4 w-4" />
                  ) : (
                    <PiArrowFatUp className="h-4 w-4" />
                  )}
                  Cash {t === 'in' ? 'In' : 'Out'}
                </button>
              ))}
            </div>
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
                step="0.01"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-2xl font-bold outline-none transition-colors focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Reason{' '}
                <span className="font-normal text-gray-300">(optional)</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. Bank deposit…"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-[#b20202]"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                  Total In
                </p>
                <p className="text-sm font-bold text-emerald-700">
                  {formatCurrency(totalIn)}
                </p>
              </div>
              <div className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                  Total Out
                </p>
                <p className="text-sm font-bold text-red-600">
                  {formatCurrency(totalOut)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!amount || Number(amount) <= 0 || submitting}
              className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: type === 'in' ? '#16a34a' : '#b20202' }}
            >
              {submitting
                ? 'Saving…'
                : `${type === 'in' ? 'Add Cash In' : 'Remove Cash Out'}`}
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Movement History
              </p>
            </div>
            {loadingHistory ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <p className="text-sm text-gray-400">No movements yet</p>
              </div>
            ) : (
              <div className="flex-1 divide-y divide-gray-50 overflow-y-auto">
                {[...history].reverse().map((m) => {
                  const cashier = m.performedBy
                    ? m.performedBy.posName ||
                      `${m.performedBy.firstName} ${m.performedBy.lastName}`
                    : '—';
                  const time = new Date(m.performedAt).toLocaleTimeString(
                    'en-GB',
                    { hour: '2-digit', minute: '2-digit' }
                  );
                  return (
                    <div
                      key={m._id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
                      >
                        {m.type === 'in' ? (
                          <PiArrowDown className="h-4 w-4" />
                        ) : (
                          <PiArrowUp className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800">
                          {m.reason ||
                            (m.type === 'in' ? 'Cash In' : 'Cash Out')}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {time} · {cashier}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-bold tabular-nums ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {m.type === 'in' ? '+' : '−'}
                        {formatCurrency(m.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Close
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
  installPrompt,
  onInstallAccepted,
}: {
  session: POSSession;
  token: string;
  onCloseRegister: () => void;
  onClose: () => void;
  installPrompt: BeforeInstallPromptEvent | null;
  onInstallAccepted: () => void;
}) {
  const router = useRouter();
  const [showCashModal, setShowCashModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const items = [
    {
      label: 'Orders',
      icon: <PiClockCounterClockwise className="h-4 w-4" />,
      badge: session.orderCount > 0 ? session.orderCount : null,
      action: () => {
        router.push(routes.pos.cashierSellOrders);
        onClose();
      },
    },
    {
      label: 'Cash In/Out',
      icon: <PiArrowFatDown className="h-4 w-4" />,
      action: () => setShowCashModal(true),
    },
    {
      label: 'Create Product',
      icon: <PiStorefront className="h-4 w-4" />,
      action: () => {
        window.open(routes.eCommerce.createProduct, '_blank');
        onClose();
      },
    },
    {
      label: 'Backend',
      icon: <PiHouseSimple className="h-4 w-4" />,
      action: () => {
        router.push(routes.pos.index);
        onClose();
      },
    },
    {
      label: 'Close Register',
      icon: <PiLockKey className="h-4 w-4" />,
      danger: true,
      action: () => {
        onCloseRegister();
        onClose();
      },
    },
    ...(installPrompt
      ? [
          {
            label: 'Install App',
            icon: <PiDeviceMobileSpeaker className="h-4 w-4" />,
            action: async () => {
              await installPrompt.prompt();
              const { outcome } = await installPrompt.userChoice;
              if (outcome === 'accepted') onInstallAccepted();
              onClose();
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <div
        ref={menuRef}
        className="ring-black/8 absolute right-3 top-full z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1"
      >
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm font-medium transition-colors ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'} ${i > 0 ? 'border-t border-gray-50' : ''}`}
          >
            <span className={item.danger ? 'text-red-500' : 'text-gray-400'}>
              {item.icon}
            </span>
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
          onClose={() => {
            setShowCashModal(false);
            onClose();
          }}
          onMovementRecorded={() => {}}
        />
      )}
    </>
  );
}

// ── Pricelist picker ──────────────────────────────────────────────────────────
function PricelistPicker({ token }: { token: string }) {
  const { selectedPricelist, setSelectedPricelist } = usePOSPricelist();
  const { pricelists, loaded, load } = usePOSAvailablePricelists();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load once — cached across session
  useEffect(() => {
    if (token) load(token);
  }, [token, load]);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  if (!loaded || pricelists.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all ${
          open
            ? 'bg-white text-[#b20202]'
            : selectedPricelist
              ? 'bg-white/20 text-white'
              : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
        }`}
      >
        <PiTag className="h-3.5 w-3.5" />
        <span className="hidden max-w-[120px] truncate sm:inline">
          {selectedPricelist?.name || 'Pricelist'}
        </span>
        <PiCaretDown
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="ring-black/8 absolute left-0 top-full z-50 mt-1.5 min-w-[200px] overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1">
          <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Select Pricelist
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedPricelist(null);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${!selectedPricelist ? 'bg-[#b20202]/5 font-semibold text-[#b20202]' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {!selectedPricelist ? (
              <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />
            ) : (
              <span className="h-4 w-4 shrink-0" />
            )}
            Standard Price
          </button>
          <div className="mx-3 my-1 border-t border-gray-100" />
          {pricelists.map((pl) => (
            <button
              key={pl._id}
              type="button"
              onClick={() => {
                setSelectedPricelist(pl);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${selectedPricelist?._id === pl._id ? 'bg-[#b20202]/5 font-semibold text-[#b20202]' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {selectedPricelist?._id === pl._id ? (
                <PiCheckCircle className="h-4 w-4 shrink-0 text-[#b20202]" />
              ) : (
                <PiTag className="h-4 w-4 shrink-0 text-gray-300" />
              )}
              <span className="flex-1 truncate text-left">{pl.name}</span>
              {pl.currency && pl.currency !== 'NGN' && (
                <span className="shrink-0 text-[10px] font-medium text-gray-400">
                  {pl.currency}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Brand block (logo + terminal badge) ──────────────────────────────────────
function BrandBlock({
  tenantLogo,
  storeName,
  termLabel,
}: {
  tenantLogo: string | null;
  storeName: string;
  termLabel: string;
}) {
  return (
    <div className="mr-3 flex shrink-0 items-center gap-2.5">
      {/* Logo in a white pill so it reads clearly on the red header */}
      <div className="flex h-9 items-center rounded-lg bg-white px-2.5">
        {tenantLogo ? (
          <div className="relative h-6 w-24 shrink-0 overflow-hidden">
            <Image
              src={tenantLogo}
              alt={storeName}
              fill
              style={{ objectFit: 'contain', objectPosition: 'left center' }}
            />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logo.png"
            alt="Drinks Harbour"
            style={{
              height: 24,
              width: 'auto',
              maxWidth: 150,
              objectFit: 'contain',
            }}
          />
        )}
      </div>

      {/* Terminal type badge */}
      <span className="hidden shrink-0 rounded border border-white/30 bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/80 sm:inline">
        {termLabel}
      </span>
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${highlight ? 'bg-white/20' : 'bg-white/10'}`}
    >
      <span className="text-white/60">{icon}</span>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-widest text-white/60">
          {label}
        </p>
        <p
          className={`text-sm font-bold tabular-nums leading-tight ${highlight ? 'text-white' : 'text-white/90'}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Session bar ───────────────────────────────────────────────────────────────
export default function POSSessionBar({ className }: { className?: string }) {
  const { token, staff, tenant, terminal } = usePOSAuth();
  const { saleCounter } = usePOSSaleSignal();
  const router = useRouter();
  const [session, setSession] = useState<POSSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState(0);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const elapsed = useElapsedTime(session?.openedAt);

  // Capture PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () =>
      window.removeEventListener(
        'beforeinstallprompt',
        handler as EventListener
      );
  }, []);

  // Poll pending queue count every 10s
  useEffect(() => {
    const refresh = () => getPendingCount().then(setPendingCount);
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, []);

  // Trigger sync on reconnect
  useEffect(() => {
    if (!isOnline || !token) return;
    setSyncing(true);
    runSyncEngine(token).then((result) => {
      setSyncing(false);
      if (result.ok && result.synced > 0) {
        setSyncDone(true);
        getPendingCount().then(setPendingCount);
        setTimeout(() => setSyncDone(false), 4000);
      }
    });
  }, [isOnline, token]);

  useEffect(() => {
    if (!token) return;
    // Re-fetch on mount and after every completed sale
    if (saleCounter === 0) setLoading(true);
    posApi
      .getSessionInfo(token, terminal ?? 'retail')
      .then((data) => setSession(data.currentSession))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, terminal, saleCounter]);

  async function handleOpenSession() {
    if (!token) return;
    setOpening(true);
    try {
      const newSession = await posApi.openSession(
        token,
        openingCash,
        terminal ?? 'retail'
      );
      setSession(newSession);
      setShowOpenDialog(false);
    } catch {
      /* ignore */
    } finally {
      setOpening(false);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return <div className="h-14 shrink-0 animate-pulse bg-[#b20202]" />;
  }

  const cashierName = staff
    ? staff.posName || `${staff.firstName} ${staff.lastName}`
    : session?.activeCashier
      ? session.activeCashier.posName ||
        `${session.activeCashier.firstName} ${session.activeCashier.lastName}`
      : 'Cashier';

  const storeName = tenant?.name || 'Drinks Harbour';
  // Safely extract logo URL — logo may be a string or { url, alt } object
  const tenantLogo = (() => {
    const raw = tenant?.logo;
    if (!raw) return null;
    const url = typeof raw === 'string' ? raw : (raw as any)?.url;
    return url?.trim() || null;
  })();
  const termLabel = (
    terminal === 'wholesale' ? 'Wholesale' : 'Retail'
  ).toUpperCase();

  // ── No session ──────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div
        className={`relative flex h-14 shrink-0 items-center bg-[#b20202] px-4 ${className ?? ''}`}
      >
        {/* Left: brand */}
        <BrandBlock
          tenantLogo={tenantLogo}
          storeName={storeName}
          termLabel={termLabel}
        />

        {/* Divider */}
        <div className="mx-3 h-6 w-px shrink-0 bg-white/10" />

        {/* Warning */}
        <div className="flex items-center gap-2">
          <PiWarningCircle className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold text-white">
            No open session
          </span>
        </div>

        <div className="flex-1" />

        {/* Open session action */}
        {showOpenDialog ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70">Opening cash (₦):</span>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenSession()}
              autoFocus
              min={0}
              placeholder="0"
              className="w-28 rounded-lg border border-white/30 bg-white/15 px-3 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-white focus:bg-white/25"
            />
            <button
              onClick={handleOpenSession}
              disabled={opening}
              className="rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-[#b20202] hover:bg-white/90 disabled:opacity-60"
            >
              {opening ? 'Opening…' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowOpenDialog(false)}
              className="text-xs text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowOpenDialog(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-[#b20202] hover:bg-white/90"
          >
            Open Session
          </button>
        )}
      </div>
    );
  }

  // ── Active session ──────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`relative flex h-14 shrink-0 items-center bg-[#b20202] px-4 ${className ?? ''}`}
      >
        {/* ── Left: brand + terminal ── */}
        <BrandBlock
          tenantLogo={tenantLogo}
          storeName={storeName}
          termLabel={termLabel}
        />

        {/* ── Divider ── */}
        <div className="mx-2 h-6 w-px shrink-0 bg-white/20" />

        {/* ── Session live indicator ── */}
        <div className="mr-2 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-white/80">
            Open
          </span>
        </div>

        {/* ── Divider ── */}
        <div className="mx-2 h-6 w-px shrink-0 bg-white/20" />

        {/* ── Stats ── */}
        <div className="flex items-center gap-1">
          <StatChip
            icon={<PiTimer className="h-3.5 w-3.5" />}
            label="Open"
            value={elapsed || '—'}
          />
          <StatChip
            icon={<PiShoppingCart className="h-3.5 w-3.5" />}
            label="Orders"
            value={String(session.orderCount)}
          />
          <StatChip
            icon={<PiCurrencyNgn className="h-3.5 w-3.5" />}
            label="Sales"
            value={formatCurrency(session.totalSales)}
            highlight
          />
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Offline / sync chip ── */}
        <OfflineChip
          isOnline={isOnline}
          syncing={syncing}
          syncDone={syncDone}
          pendingCount={pendingCount}
        />

        {/* ── Pricelist selector ── */}
        {token && <PricelistPicker token={token} />}

        {/* ── Divider ── */}
        <div className="mx-2 h-6 w-px shrink-0 bg-white/20" />

        {/* ── Cashier ── */}
        <div className="mr-1 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
            <PiUserCircle className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold leading-none text-white">
              {cashierName}
            </p>
            <p className="mt-0.5 text-[9px] text-white/60">Cashier</p>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-3 h-6 w-px shrink-0 bg-white/20" />

        {/* ── Menu button ── */}
        <button
          type="button"
          onClick={() => setShowMenu((v) => !v)}
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all ${
            showMenu
              ? 'bg-white text-[#b20202]'
              : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          aria-label="Menu"
        >
          <PiList className="h-4 w-4" />
          <span className="hidden sm:inline">Menu</span>
          <PiCaretDown
            className={`h-3 w-3 transition-transform ${showMenu ? 'rotate-180' : ''}`}
          />
        </button>

        {/* ── Dropdown ── */}
        {showMenu && token && (
          <HamburgerMenu
            session={session}
            token={token}
            onCloseRegister={() => setShowCloseModal(true)}
            onClose={() => setShowMenu(false)}
            installPrompt={installPrompt}
            onInstallAccepted={() => setInstallPrompt(null)}
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
