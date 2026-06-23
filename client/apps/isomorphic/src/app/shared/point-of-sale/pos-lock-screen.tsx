'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { routes } from '@/config/routes';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth, usePOSSettings } from '@/app/shared/point-of-sale/store';
import { useTenant } from '@/context/TenantContext';
import { POSStaff } from '@/app/shared/point-of-sale/types';
import {
  PiArrowLeft,
  PiGearSix,
  PiUserCircle,
  PiBackspace,
  PiEye,
  PiEyeSlash,
} from 'react-icons/pi';

// ── Clock ──────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <div className="text-5xl font-extralight tabular-nums tracking-widest text-white">
        {time.toLocaleTimeString('en-US', { hour12: false })}
      </div>
      <div className="mt-1 text-sm font-medium text-red-200">
        {time.toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </div>
    </div>
  );
}

// ── PIN dots ───────────────────────────────────────────────────────────────────
const PIN_MAX = 4;

function PinDisplay({ length, shake }: { length: number; shake: boolean }) {
  return (
    <div
      className={`flex justify-center gap-4 ${shake ? 'animate-shake' : ''}`}
    >
      {Array.from({ length: PIN_MAX }).map((_, i) => (
        <span
          key={i}
          className={`block h-4 w-4 rounded-full border-2 transition-all duration-150 ${
            i < length
              ? 'scale-110 border-white bg-white'
              : 'border-white/40 bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

// ── Numpad ─────────────────────────────────────────────────────────────────────
const NUMPAD_ROWS = [
  [
    { d: '1', sub: '' },
    { d: '2', sub: 'ABC' },
    { d: '3', sub: 'DEF' },
  ],
  [
    { d: '4', sub: 'GHI' },
    { d: '5', sub: 'JKL' },
    { d: '6', sub: 'MNO' },
  ],
  [
    { d: '7', sub: 'PQRS' },
    { d: '8', sub: 'TUV' },
    { d: '9', sub: 'WXYZ' },
  ],
];

function NumpadKey({
  label,
  sub,
  onClick,
  ghost,
}: {
  label: React.ReactNode;
  sub?: string;
  onClick: () => void;
  ghost?: boolean;
}) {
  if (ghost) return <div />;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-16 w-full select-none flex-col items-center justify-center rounded-2xl bg-white/15 text-white transition-all hover:bg-white/25 active:scale-95"
    >
      <span className="text-2xl font-light leading-none">{label}</span>
      {sub && (
        <span className="mt-0.5 text-[9px] font-semibold tracking-widest text-white/50">
          {sub}
        </span>
      )}
    </button>
  );
}

// ── Staff row ──────────────────────────────────────────────────────────────────
function StaffRow({
  staff,
  selected,
  onClick,
}: {
  staff: POSStaff;
  selected: boolean;
  onClick: () => void;
}) {
  const initials = `${staff.firstName[0]}${staff.lastName[0]}`.toUpperCase();
  const displayName = staff.posName || `${staff.firstName} ${staff.lastName}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
        selected
          ? 'bg-white shadow-lg ring-2 ring-white/80'
          : 'bg-white/10 hover:bg-white/20'
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${
          selected ? 'bg-[#b20202] text-white' : 'bg-white/20 text-white'
        }`}
      >
        {staff.avatar ? (
          <img
            src={staff.avatar}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold ${selected ? 'text-gray-900' : 'text-white'}`}
        >
          {displayName}
        </p>
        <p
          className={`text-xs capitalize ${selected ? 'text-gray-400' : 'text-red-200'}`}
        >
          {staff.hasPin ? staff.role : `${staff.role} · no PIN`}
        </p>
      </div>

      {selected && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b20202]">
          <svg
            className="h-3 w-3 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
    </button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function POSLockScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const terminal = searchParams.get('terminal') || 'retail';
  const terminalLabel = terminal === 'retail' ? 'Retail' : 'Wholesale';

  const { token, setAuth, setTerminal } = usePOSAuth();
  const settings = usePOSSettings();
  const canBypassPIN = !settings.requirePINOnUnlock && !!token;
  const { tenant, tenantSlug: contextSlug } = useTenant();
  const urlSlug = searchParams.get('_tenant') || '';

  const tenantSlug = contextSlug || urlSlug || '';

  const [allStaff, setAllStaff] = useState<POSStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  const [selectedStaff, setSelectedStaff] = useState<POSStaff | null>(null);
  const [pin, setPin] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [shake, setShake] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Note: we intentionally do NOT auto-redirect when a token already exists.
  // The lock screen is always shown so cashiers can switch, re-authenticate,
  // or log in on a different terminal. Redirect only happens after a successful login.

  // Load staff from tenant context slug
  useEffect(() => {
    if (!tenantSlug) return;
    setStaffLoading(true);
    setStaffError('');
    posApi
      .listStaff(tenantSlug)
      .then(({ staff: list }) => {
        setAllStaff(list);
        const eligible = list.filter((s) => {
          const tp = s.terminalPermissions;
          if (!tp) return true;
          return terminal === 'retail' ? tp.retail : tp.wholesale;
        });
        if (eligible.length === 1) setSelectedStaff(eligible[0]);
      })
      .catch((err: any) =>
        setStaffError(
          err?.message || 'Could not load staff. Please refresh and try again.'
        )
      )
      .finally(() => setStaffLoading(false));
  }, [tenantSlug, terminal]);

  const staff = useMemo(
    () =>
      allStaff.filter((s) => {
        const tp = s.terminalPermissions;
        if (!tp) return true;
        return terminal === 'retail' ? tp.retail : tp.wholesale;
      }),
    [allStaff, terminal]
  );

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = useCallback(
    async (pinValue: string, passwordValue?: string) => {
      if (!selectedStaff || !tenantSlug || loggingIn) return;
      if (!usePassword && pinValue.length < PIN_MAX) return;
      if (usePassword && !passwordValue?.trim()) return;

      setLoggingIn(true);
      setError('');
      try {
        const data = usePassword
          ? await posApi.staffLogin(
              tenantSlug,
              selectedStaff._id,
              undefined,
              passwordValue
            )
          : await posApi.staffLogin(tenantSlug, selectedStaff._id, pinValue);
        setAuth(data.token, data.staff, data.tenant);
        setTerminal(terminal === 'wholesale' ? 'wholesale' : 'retail');
        router.push(routes.pos.sell);
      } catch (err: any) {
        setError(err.message || 'Invalid credentials. Try again.');
        setPin('');
        setPassword('');
        setShake(true);
        setTimeout(() => setShake(false), 600);
      } finally {
        setLoggingIn(false);
      }
    },
    [selectedStaff, tenantSlug, loggingIn, usePassword, setAuth, router]
  );

  const handleLoginRef = useRef(handleLogin);
  handleLoginRef.current = handleLogin;

  // Auto-submit on 4th digit
  useEffect(() => {
    if (!usePassword && pin.length === PIN_MAX) {
      handleLoginRef.current(pin);
    }
  }, [pin, usePassword]);

  // ── Numpad helpers ─────────────────────────────────────────────────────────
  const pushDigit = useCallback(
    (d: string) => {
      if (loggingIn || !selectedStaff) return;
      setPin((p) => (p.length < PIN_MAX ? p + d : p));
      setError('');
    },
    [loggingIn, selectedStaff]
  );

  const deleteDigit = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setError('');
  }, []);

  // Physical keyboard input
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (usePassword || !selectedStaff) return;
      if (/^[0-9]$/.test(e.key)) pushDigit(e.key);
      else if (e.key === 'Backspace') deleteDigit();
      else if (e.key === 'Escape') {
        setPin('');
        setError('');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pushDigit, deleteDigit, selectedStaff, usePassword]);

  function selectStaff(s: POSStaff) {
    setSelectedStaff(s);
    setPin('');
    setPassword('');
    setError('');
    setUsePassword(!s.hasPin);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        background:
          'linear-gradient(145deg,#b20202 0%,#8f0101 45%,#6e0101 100%)',
      }}
    >
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-[500px] w-[500px] rounded-full bg-black/20 blur-3xl" />

      {/* ── Top bar ── */}
      <div className="relative z-10 flex items-start justify-between px-8 pt-8">
        <Clock />
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-2 ring-1 ring-white/20">
            <Image
              src="/logo-short.svg"
              alt="DH"
              width={22}
              height={22}
              className="rounded-full"
            />
            <span className="text-sm font-semibold text-white">
              {tenant?.name || 'DrinksHarbour'}
            </span>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-100">
            {terminalLabel} Terminal
          </span>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="relative z-10 flex flex-1 items-center justify-center gap-5 px-6 py-6 lg:gap-8">
        {/* Left: staff list */}
        <div className="flex w-full max-w-xs flex-col rounded-3xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-md lg:max-w-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">Select Cashier</h2>
            <p className="text-xs text-red-200">Choose your name to continue</p>
          </div>

          {staffLoading ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          ) : staffError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-red-200">{staffError}</p>
              <button
                type="button"
                onClick={() => router.push(routes.pos.index)}
                className="text-xs font-medium text-white underline underline-offset-2"
              >
                Back to dashboard
              </button>
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <PiUserCircle className="h-12 w-12 text-white/30" />
              <p className="text-sm text-red-200">
                No staff assigned to the {terminalLabel.toLowerCase()} terminal.
              </p>
              <button
                type="button"
                onClick={() => router.push(routes.pos.index)}
                className="mt-1 text-xs font-medium text-white underline underline-offset-2"
              >
                Switch terminal
              </button>
            </div>
          ) : (
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {staff.map((s) => (
                <StaffRow
                  key={s._id}
                  staff={s}
                  selected={selectedStaff?._id === s._id}
                  onClick={() => selectStaff(s)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: PIN / password */}
        <div className="flex w-full max-w-xs flex-col items-center rounded-3xl bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur-md lg:max-w-sm">
          {canBypassPIN && (
            <button
              type="button"
              onClick={() => router.push(routes.pos.sell)}
              className="mb-4 w-full rounded-xl bg-white/20 py-3 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/30"
            >
              Continue without PIN
            </button>
          )}
          <div className="mb-5 w-full text-center">
            <h2 className="text-base font-bold text-white">
              {usePassword ? 'Enter Password' : 'Enter PIN'}
            </h2>
            <p className="mt-0.5 text-xs text-red-200">
              {selectedStaff
                ? `${selectedStaff.posName || selectedStaff.firstName}`
                : 'Select a cashier first'}
            </p>
          </div>

          {usePassword ? (
            <div
              className={`w-full space-y-4 ${!selectedStaff ? 'pointer-events-none opacity-40' : ''}`}
            >
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && handleLogin('', password)
                  }
                  placeholder="Password"
                  autoFocus={!!selectedStaff}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 pr-11 text-sm text-white placeholder-red-300 outline-none focus:border-white/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300 hover:text-white"
                >
                  {showPassword ? (
                    <PiEyeSlash className="h-5 w-5" />
                  ) : (
                    <PiEye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {error && (
                <p className="text-center text-xs text-red-200">{error}</p>
              )}

              <button
                type="button"
                disabled={!password.trim() || loggingIn}
                onClick={() => handleLogin('', password)}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#b20202] transition-colors hover:bg-red-50 disabled:opacity-40"
              >
                {loggingIn ? 'Signing in…' : 'Sign In'}
              </button>

              {selectedStaff?.hasPin && (
                <button
                  type="button"
                  onClick={() => {
                    setUsePassword(false);
                    setPassword('');
                    setError('');
                  }}
                  className="w-full text-center text-xs text-red-200 hover:text-white"
                >
                  Use PIN instead
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`mb-2 ${!selectedStaff ? 'opacity-30' : ''}`}>
                <PinDisplay length={pin.length} shake={shake} />
              </div>

              <div className="mb-4 h-5">
                {error && (
                  <p className="text-center text-xs text-red-200">{error}</p>
                )}
              </div>

              <div
                className={`w-full ${!selectedStaff || loggingIn ? 'pointer-events-none opacity-40' : ''}`}
              >
                <div className="grid grid-cols-3 gap-2.5">
                  {NUMPAD_ROWS.map((row) =>
                    row.map(({ d, sub }) => (
                      <NumpadKey
                        key={d}
                        label={d}
                        sub={sub}
                        onClick={() => pushDigit(d)}
                      />
                    ))
                  )}
                  <NumpadKey label="" onClick={() => {}} ghost />
                  <NumpadKey label="0" onClick={() => pushDigit('0')} />
                  <NumpadKey
                    label={<PiBackspace className="h-6 w-6" />}
                    onClick={deleteDigit}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUsePassword(true);
                  setPin('');
                  setError('');
                }}
                className="mt-4 text-xs text-red-300 hover:text-white"
              >
                Use password instead
              </button>

              {loggingIn && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-200">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-200/40 border-t-red-200" />
                  Verifying…
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="relative z-10 flex items-center justify-between px-8 pb-8">
        <button
          type="button"
          onClick={() => router.push(routes.pos.index)}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
        >
          <PiArrowLeft className="h-4 w-4" />
          Dashboard
        </button>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
        >
          <PiGearSix className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

// ── Settings sheet ─────────────────────────────────────────────────────────────
function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [sound, setSound] = useState(true);

  return (
    <div className="absolute inset-0 z-20">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-6 pb-10 pt-5 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200" />
        <h3 className="mb-5 text-base font-bold text-gray-900">
          Terminal Settings
        </h3>
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Keypad Sound</p>
              <p className="text-xs text-gray-400">Play click on keypress</p>
            </div>
            <button
              type="button"
              onClick={() => setSound(!sound)}
              className={`relative h-6 w-11 rounded-full transition-colors ${sound ? 'bg-[#b20202]' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${sound ? 'translate-x-5' : ''}`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">
                Receipt Printer
              </p>
              <p className="text-xs text-gray-400">EPSON TM-T88VI</p>
            </div>
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              Connected
            </span>
          </div>
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Screen Saver</p>
              <p className="text-xs text-gray-400">Idle timeout: 5 min</p>
            </div>
            <span className="text-xs text-gray-400">Always on</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Done
        </button>
      </div>
    </div>
  );
}
