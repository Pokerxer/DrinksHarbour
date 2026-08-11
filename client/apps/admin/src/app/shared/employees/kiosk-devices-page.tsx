'use client';

// Pairing screens to the clock — `/employees/attendance/devices`.
//
// This is the admin side of the public kiosk. A "device" is one screen left
// somewhere in the shop that clocks staff in WITHOUT anybody logging in: the
// tablet on the counter, the panel by the warehouse door.
//
// TWO THINGS THIS PAGE IS CAREFUL ABOUT
// -------------------------------------
// 1. The token is shown ONCE. Nothing stores the plaintext — only its hash goes
//    to the database — so the panel below is the only chance to copy it. That
//    is deliberate rather than awkward: a token a manager can re-read from a
//    settings page is a token anybody with a manager's screen-share can read.
//    Losing it costs one re-pairing, which is the same work as replacing the
//    tablet it was on.
// 2. Revoking is per device. That is the whole reason screens are named: a
//    tablet left in a taxi is cut off on its own and every other screen in the
//    shop keeps working.

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  PiArrowUUpLeft,
  PiCopySimpleBold,
  PiDeviceTabletDuotone,
  PiPlus,
  PiProhibitBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import { fraunces } from './employees-fonts';
import { kioskDeviceStatus } from './kiosk-device-utils';
import {
  attendanceService,
  type KioskDevice,
} from '@/services/attendance.service';
import { routes } from '@/config/routes';

const TONE_CLASS: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  muted: 'bg-gray-100 text-gray-500',
  danger: 'bg-rose-50 text-rose-600',
};

export default function KioskDevicesPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [pairing, setPairing] = useState(false);

  // The one plaintext copy of a freshly issued token. Held in state and nowhere
  // else — it is gone the moment this page is left.
  const [issued, setIssued] = useState<{ name: string; url: string } | null>(
    null
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setDevices(await attendanceService.kioskDevices(token));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load screens');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const pair = async () => {
    setPairing(true);
    try {
      const res = await attendanceService.pairKioskDevice(name.trim(), token);
      // An absolute URL, because the point of this string is to be typed or
      // pasted into a DIFFERENT device's browser, where a path means nothing.
      setIssued({
        name: res.device.name,
        url: `${window.location.origin}${routes.publicKiosk(res.token)}`,
      });
      setName('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not pair this screen');
    } finally {
      setPairing(false);
    }
  };

  const revoke = async (device: KioskDevice) => {
    try {
      await attendanceService.revokeKioskDevice(device._id, token);
      toast.success(`${device.name} can no longer clock anybody in`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not revoke it');
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Kiosk link copied');
    } catch {
      // Clipboard access is refused outside a secure context, and the whole
      // point of this panel is that the token cannot be recovered later — so
      // say so rather than failing quietly on the one copy that exists.
      toast.error('Could not copy — select the link and copy it by hand');
    }
  };

  return (
    <div className="@container">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202] text-white [&>svg]:h-5 [&>svg]:w-5">
            <PiDeviceTabletDuotone />
          </span>
          <div>
            <h1
              className={`${fraunces.className} text-2xl font-black text-gray-900`}
            >
              Kiosk screens
            </h1>
            <p className="mt-0.5 max-w-xl text-sm text-gray-500">
              Screens that clock staff in without anybody signing in. Each one
              gets its own link, and each can be cut off on its own.
            </p>
          </div>
        </div>

        <Link
          href={routes.employees.attendance}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
        >
          <PiArrowUUpLeft className="h-4 w-4" />
          Back to attendance
        </Link>
      </div>

      {/* The one and only sight of a new token. */}
      {issued && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-900">
            {issued.name} is paired
          </p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
            Open this link on that screen and leave it there. It is shown{' '}
            <strong>once</strong> — nothing stores it, so copy it now. Anybody
            with the link can clock staff in, so treat it like a key to the
            shop.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-gray-700">
              {issued.url}
            </code>
            <button
              type="button"
              onClick={() => copy(issued.url)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <PiCopySimpleBold className="h-3.5 w-3.5" />
              Copy
            </button>
            <button
              type="button"
              onClick={() => setIssued(null)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Pair a new screen. */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Pair a screen</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Name it after where it lives, so you know which one you are revoking.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Front counter"
            maxLength={60}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#b20202]"
          />
          <button
            type="button"
            onClick={pair}
            disabled={pairing || !token}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f0202] disabled:opacity-60"
          >
            <PiPlus className="h-4 w-4" />
            {pairing ? 'Pairing…' : 'Pair'}
          </button>
        </div>
      </div>

      {/* Paired screens. */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : devices.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-gray-700">
              No screens paired yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">
              Staff can still clock in from the kiosk on a signed-in tablet.
              Pair a screen to leave one on the counter instead.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {devices.map((d) => {
              const status = kioskDeviceStatus(d);
              return (
                <li
                  key={d._id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {d.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      ends &hellip;{d.tokenHint}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        TONE_CLASS[status.tone]
                      }`}
                    >
                      {status.label}
                    </span>
                    {d.active && (
                      <button
                        type="button"
                        onClick={() => revoke(d)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-rose-200 hover:text-rose-600"
                      >
                        <PiProhibitBold className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 px-4 py-3">
        <PiWarningCircleBold className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <p className="text-xs leading-relaxed text-gray-500">
          A paired screen takes <strong>badge scans only</strong> — never a
          typed PIN. A PIN is a short secret, and this link is reachable from
          anywhere; a badge is a card somebody has to be holding.
        </p>
      </div>
    </div>
  );
}
