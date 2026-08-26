'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  usePOSAuth,
  usePOSSettings,
} from '@/app/shared/point-of-sale/store';
import { useKdsFeed } from '@/app/shared/point-of-sale/hooks/useKdsFeed';
import {
  groupRoundsByColumn,
  roundElapsedLabel,
  isRoundLate,
  type BoardCard,
} from '@/app/shared/point-of-sale/components/pos-kitchen-helpers';
import type {
  KitchenOrder,
  KitchenRoundStatus,
} from '@/app/shared/point-of-sale/types';
import { routes } from '@/config/routes';

const NEXT_STATUS: Record<KitchenRoundStatus, KitchenRoundStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served',
  served: null,
};

const COLUMN_ACCENT: Record<keyof ReturnType<typeof groupRoundsByColumn>, string> = {
  pending: 'border-red-500',
  preparing: 'border-amber-500',
  ready: 'border-green-500',
};

function cardKey(card: BoardCard): string {
  return `${card.order.orderId}:${card.round.roundNo}`;
}

function accentFor(status: KitchenRoundStatus): string {
  return status in COLUMN_ACCENT
    ? COLUMN_ACCENT[status as keyof typeof COLUMN_ACCENT]
    : 'border-gray-500';
}

/**
 * Short two-tone beep via WebAudio — no audio asset to ship or cache on a
 * device that may be an old tablet in a hot kitchen. Never throws.
 */
function playKdsChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.7, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    // Sound is a nicety — a headless/locked-audio device still needs the board.
  }
}

function KitchenCard({
  card,
  nowMs,
  alertMins,
  fresh,
  bumping,
  onBump,
}: {
  card: BoardCard;
  nowMs: number;
  alertMins: number;
  fresh: boolean;
  bumping: boolean;
  onBump: (card: BoardCard) => void;
}) {
  const { order, round } = card;
  const late = isRoundLate(round.firedAt, alertMins, nowMs);
  return (
    <button
      type="button"
      onClick={() => onBump(card)}
      disabled={bumping}
      className={`w-full shrink-0 cursor-pointer rounded-xl border-l-4 bg-[#1f2937] p-3 text-left transition-opacity disabled:cursor-wait disabled:opacity-50 ${accentFor(
        round.status
      )} ${fresh ? 'animate-pulse ring-2 ring-white/40' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-base font-bold">
          {order.tableName || '—'}
        </span>
        <span className="shrink-0 text-xs font-semibold text-gray-400">
          R{round.roundNo}
          {order.guests > 0 ? ` · ${order.guests} guests` : ''}
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-gray-200">
        {round.items.map((item) => (
          <li key={item.key}>
            <span className="font-bold text-white">{item.quantity}</span> ×{' '}
            {item.name}
            {item.variant ? (
              <span className="text-gray-400">({item.variant})</span>
            ) : null}
          </li>
        ))}
      </ul>
      <div
        className={`mt-2 text-xs font-semibold ${late ? 'text-red-400' : 'text-gray-500'}`}
      >
        {roundElapsedLabel(round.firedAt, nowMs)}
      </div>
    </button>
  );
}

const COLUMNS: ReadonlyArray<{
  key: keyof ReturnType<typeof groupRoundsByColumn>;
  label: string;
}> = [
  { key: 'pending', label: 'PENDING' },
  { key: 'preparing', label: 'PREPARING' },
  { key: 'ready', label: 'READY' },
];

export default function POSKitchenBoard() {
  const router = useRouter();
  const { token } = usePOSAuth();
  // Kitchen staff log in with the same PIN flow, so the same tenant settings
  // store carries their kitchenAlertMins from the staff-login response.
  const settings = usePOSSettings();
  const alertMins = settings.kitchenAlertMins ?? 10;

  // Mirror pos-sell's guard: wait one tick for Jotai to hydrate from
  // localStorage, then bounce a tokenless screen to the POS PIN login.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    if (!token) router.replace(routes.pos.cashierLogin);
  }, [hydrated, token, router]);

  const feed = useKdsFeed();

  // One shared clock drives every elapsed timer + the header clock.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const columns = useMemo(
    () => groupRoundsByColumn(feed.orders as KitchenOrder[] | undefined),
    [feed.orders]
  );

  // New-round detection: first population after mount is adopted silently
  // (no chime storm for rounds already on the board), anything appearing
  // afterwards chimes once and pulses for ~4s. Expiry rides the clock tick,
  // so highlights can't get stuck by overlapping refetches.
  const seenKeysRef = useRef<Set<string> | null>(null);
  const [freshUntil, setFreshUntil] = useState<Record<string, number>>({});
  useEffect(() => {
    const seen = seenKeysRef.current;
    const current = new Set<string>();
    for (const order of feed.orders) {
      for (const round of order.rounds) {
        current.add(`${order.orderId}:${round.roundNo}`);
      }
    }
    if (seen === null) {
      seenKeysRef.current = current;
      return;
    }
    const added = Array.from(current).filter((k) => !seen.has(k));
    seenKeysRef.current = current;
    if (added.length === 0) return;
    playKdsChime();
    const expiry = Date.now() + 4000;
    setFreshUntil((prev) => {
      const next = { ...prev };
      for (const k of added) next[k] = expiry;
      return next;
    });
  }, [feed.orders]);
  useEffect(() => {
    setFreshUntil((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [k, until] of Object.entries(prev)) {
        if (until > nowMs) next[k] = until;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [nowMs]);

  const [bumpingKeys, setBumpingKeys] = useState<Set<string>>(new Set());
  const handleBump = async (card: BoardCard) => {
    const key = cardKey(card);
    const next = NEXT_STATUS[card.round.status];
    if (!next || bumpingKeys.has(key)) return;
    setBumpingKeys((prev) => new Set(prev).add(key));
    try {
      await feed.bumpRound(card.order.orderId, card.round.roundNo, next);
    } finally {
      setBumpingKeys((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(key);
        return nextSet;
      });
    }
  };

  if (!hydrated || !token) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#111827]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const clockLabel = new Date(nowMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const lastRefreshLabel = feed.lastRefreshedAt
    ? new Date(feed.lastRefreshedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div className="flex h-dvh flex-col bg-[#111827] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-[0.2em]">KITCHEN</h1>
          <span
            title={feed.connected ? 'Live' : 'Reconnecting…'}
            className={`h-2.5 w-2.5 rounded-full ${
              feed.connected ? 'bg-green-500' : 'bg-amber-400'
            }`}
          />
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <span className="font-mono tabular-nums">{clockLabel}</span>
          <span>Updated {lastRefreshLabel}</span>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-3 gap-3 overflow-hidden p-3">
        {COLUMNS.map((col) => {
          const cards = columns[col.key];
          return (
            <section
              key={col.key}
              className="flex min-h-0 flex-col rounded-xl bg-black/30"
            >
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-sm font-bold tracking-widest text-gray-300">
                  {col.label}
                </h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums">
                  {cards.length}
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {cards.map((card) => {
                  const key = cardKey(card);
                  return (
                    <KitchenCard
                      key={key}
                      card={card}
                      nowMs={nowMs}
                      alertMins={alertMins}
                      fresh={(freshUntil[key] ?? 0) > nowMs}
                      bumping={bumpingKeys.has(key)}
                      onBump={handleBump}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
