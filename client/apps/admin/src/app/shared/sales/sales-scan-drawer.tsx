// client/apps/admin/src/app/shared/sales/sales-scan-drawer.tsx
'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  PiX,
  PiCamera,
  PiTextT,
  PiUploadSimple,
  PiSpinner,
  PiCheck,
  PiWarningCircle,
  PiPlus,
  PiArrowSquareOut,
  PiMinus,
} from 'react-icons/pi';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { routes } from '@/config/routes';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { scanService, type ScanResultItem, type ScanMatchedSubProduct } from '@/services/scan.service';
import type { ProductLineSelection } from './product-line-search';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

type Mode = 'qr' | 'upload' | 'paste';
type Phase = 'idle' | 'working' | 'done' | 'error';

interface ReviewedRow {
  item: ScanResultItem;
  selected: boolean;
  sizeId: string | null;
  qty: number;
}

const CONF_BADGE: Record<string, { label: string; cls: string }> = {
  exact: { label: 'Exact', cls: 'bg-emerald-50 text-emerald-600' },
  partial: { label: 'Partial', cls: 'bg-amber-50 text-amber-600' },
  none: { label: 'Not found', cls: 'bg-gray-100 text-gray-500' },
};

export interface SalesScanDrawerProps {
  open: boolean;
  token: string;
  onClose: () => void;
  /** Add a line. Receives the picked selection + the chosen quantity. */
  onAdd: (selection: ProductLineSelection) => void;
}

/**
 * Scan & Match drawer for the Sales create page. Three input modes:
 *  - QR: show a code the operator scans with their phone to capture a photo;
 *    the result streams back here via polling (Socket.io optional).
 *  - Upload: drop/choose a photo on the desktop.
 *  - Paste: paste free-form text (a list / notes / an invoice).
 * All paths land in a review list where the operator picks sizes/quantities and
 * adds matched products to the order. Unmatched rows link to "Create new product".
 */
export default function SalesScanDrawer({ open, token, onClose, onAdd }: SalesScanDrawerProps) {
  const [mode, setMode] = useState<Mode>('qr');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');

  // QR pairing state.
  const [pairingCode, setPairingCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Paste state.
  const [pasteText, setPasteText] = useState('');

  // Review state.
  const [rows, setRows] = useState<ReviewedRow[]>([]);

  // ── Lifecycle: reset on close ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setMode('qr');
      setPhase('idle');
      setError('');
      setPairingCode('');
      setPasteText('');
      setRows([]);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [open]);

  // Esc to close + lock body scroll.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // ── QR pairing: create on mount, poll for completion ──────────────────────
  const startPairing = useCallback(async () => {
    if (!token) return;
    setPhase('idle');
    setError('');
    setRows([]);
    try {
      const { pairingCode: code, expiresAt: exp } = await scanService.createPairing(token);
      setPairingCode(code);
      setExpiresAt(exp);
      // Begin polling the status endpoint (Socket.io is optional — the polling
      // fallback guarantees the drawer updates even if the socket can't connect).
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const st = await scanService.getStatus(token, code);
          if (st.status === 'complete') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            if (Array.isArray(st.result)) {
              setRows(st.result.map(toReviewedRow));
              setPhase('done');
            }
          } else if (st.status === 'error') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setPhase('error');
            setError(
              (st.result && (st.result as { error?: string }).error) || 'Scan failed'
            );
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Failed to create pairing code');
    }
  }, [token]);

  useEffect(() => {
    if (open && mode === 'qr' && !pairingCode) void startPairing();
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, mode, pairingCode, startPairing]);

  // ── Desktop upload ─────────────────────────────────────────────────────────
  const handleUpload = useCallback(
    async (file: File) => {
      setPhase('working');
      setError('');
      setRows([]);
      try {
        // Upload via the existing image endpoint, then match.
        const form = new FormData();
        form.append('image', file);
        const upRes = await fetch(`${API_URL}/api/upload/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const upBody = (await upRes.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          data?: { url?: string };
        };
        if (!upRes.ok || !upBody.success) throw new Error(upBody.message || 'Upload failed');
        const imageUrl: string = upBody.data?.url ?? '';
        const items = await scanService.match(token, { imageUrl });
        setRows(items.map(toReviewedRow));
        setPhase('done');
      } catch (err) {
        setPhase('error');
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [token]
  );

  // ── Paste-list ──────────────────────────────────────────────────────────────
  const handlePaste = useCallback(async () => {
    if (!pasteText.trim()) return;
    setPhase('working');
    setError('');
    setRows([]);
    try {
      const items = await scanService.match(token, { text: pasteText.trim() });
      setRows(items.map(toReviewedRow));
      setPhase('done');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Failed to analyze text');
    }
  }, [token, pasteText]);

  // ── Review → add to order ──────────────────────────────────────────────────
  const selectedRows = rows.filter((r) => r.selected && r.item.confidence !== 'none');

  function buildSelection(r: ReviewedRow): ProductLineSelection {
    const sp = r.item.matchedSubProducts[0];
    const size = sp?.sizes.find((s) => s.size === r.sizeId);
    const base = {
      subProductId: sp._id,
      productId: r.item.matchedProductId ?? undefined,
      costPrice: sp.costPrice,
      taxRate: sp.taxRate,
      bundleDeals: sp.bundleDeals as never,
    };
    if (size) {
      return {
        ...base,
        name: `${r.item.matchedProductName ?? r.item.extractedName} – ${size.displayName ?? size.size}`,
        sku: size.sku ?? sp.sku,
        sellingPrice: size.sellingPrice,
        sizeId: size.size,
        sizeName: size.displayName ?? size.size,
        originalPrice: size.sellingPrice,
      };
    }
    return {
      ...base,
      name: r.item.matchedProductName ?? r.item.extractedName,
      sku: sp.sku,
      sellingPrice: sp.baseSellingPrice,
      originalPrice: sp.baseSellingPrice,
    };
  }

  function addSelected() {
    for (const r of selectedRows) {
      // Bump qty for repeated picks (the onAdd callback is idempotent by
      // subProductId+sizeId, so calling it `qty` times lands at the right count).
      for (let i = 0; i < r.qty; i++) onAdd(buildSelection(r));
    }
    onClose();
  }

  if (!open) return null;

  const showReview = phase === 'done' && rows.length > 0;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:p-4">
      <div className="flex w-full max-w-3xl flex-col bg-white shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-gray-900">Scan &amp; Match</h2>
          <div className="ml-auto flex items-center gap-1">
            {!showReview && (
              <>
                <ModeTab active={mode === 'qr'} onClick={() => setMode('qr')}>
                  <PiCamera className="h-4 w-4" /> QR
                </ModeTab>
                <ModeTab active={mode === 'upload'} onClick={() => setMode('upload')}>
                  <PiUploadSimple className="h-4 w-4" /> Upload
                </ModeTab>
                <ModeTab active={mode === 'paste'} onClick={() => setMode('paste')}>
                  <PiTextT className="h-4 w-4" /> Paste
                </ModeTab>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Close"
            >
              <PiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {showReview ? (
            <ReviewList
              rows={rows}
              setRows={setRows}
            />
          ) : (
            <>
              {/* QR mode */}
              {mode === 'qr' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  {pairingCode ? (
                    <>
                      <p className="text-center text-sm text-gray-600">
                        Scan this code with your phone to take a photo. Matched products appear here automatically.
                      </p>
                      <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <QRCodeCanvas
                          value={`${origin}/scan/${pairingCode}`}
                          size={220}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        Code <span className="font-mono">{pairingCode}</span> · expires in ~10 min
                      </p>
                      {phase === 'idle' && (
                        <p className="flex items-center gap-2 text-xs text-gray-500">
                          <PiSpinner className="h-3.5 w-3.5 animate-spin" /> Waiting for your phone…
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (pollRef.current) clearInterval(pollRef.current);
                          setPairingCode('');
                          void startPairing();
                        }}
                        className="text-xs font-medium text-[#b20202] hover:underline"
                      >
                        Regenerate code
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <PiSpinner className="h-7 w-7 animate-spin" />
                      <p className="text-sm">Creating pairing code…</p>
                    </div>
                  )}
                </div>
              )}

              {/* Upload mode */}
              {mode === 'upload' && (
                <UploadDropzone onFile={handleUpload} busy={phase === 'working'} />
              )}

              {/* Paste mode */}
              {mode === 'paste' && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-600">
                    Paste a list of products, notes, or an invoice. The AI parses it into items and matches each to your catalogue.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={8}
                    placeholder={'e.g.\n2x Hennessy VS 70cl\nJameson 1L\nRemy Martin\nA bottle of Moet champagne'}
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                  />
                  <button
                    type="button"
                    onClick={handlePaste}
                    disabled={!pasteText.trim() || phase === 'working'}
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-40"
                  >
                    {phase === 'working' ? (
                      <><PiSpinner className="h-4 w-4 animate-spin" /> Analyzing…</>
                    ) : (
                      <>Analyze list</>
                    )}
                  </button>
                </div>
              )}

              {/* Error */}
              {phase === 'error' && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <PiWarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {showReview && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-5">
            <span className="text-xs text-gray-500">
              {selectedRows.length} of {rows.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRows([]);
                  setPhase('idle');
                  if (mode === 'qr') void startPairing();
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={addSelected}
                disabled={selectedRows.length === 0}
                className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-40"
              >
                Add {selectedRows.length || ''} to order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
        active ? 'bg-[#b20202] text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function UploadDropzone({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 ${
        drag ? 'border-[#b20202] bg-red-50/30' : 'border-gray-200'
      }`}
    >
      {busy ? (
        <>
          <PiSpinner className="h-8 w-8 animate-spin text-[#b20202]" />
          <p className="text-sm text-gray-600">Analyzing image…</p>
        </>
      ) : (
        <>
          <PiUploadSimple className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-600">Drag a photo here or click to choose one</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]"
          >
            Choose photo
          </button>
        </>
      )}
    </div>
  );
}

function ReviewList({
  rows,
  setRows,
}: {
  rows: ReviewedRow[];
  setRows: Dispatch<SetStateAction<ReviewedRow[]>>;
}) {
  function update(key: string, patch: Partial<ReviewedRow>) {
    setRows((rs) => rs.map((r) => (r.item.extractedName + (r.item.brand ?? '') === key ? { ...r, ...patch } : r)));
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const key = r.item.extractedName + (r.item.brand ?? '');
        const conf = CONF_BADGE[r.item.confidence] ?? CONF_BADGE.none;
        const sp = r.item.matchedSubProducts[0];
        const unmatched = r.item.confidence === 'none';
        return (
          <div
            key={key}
            className={`rounded-xl border p-3 ${
              unmatched ? 'border-gray-200 bg-gray-50/60' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={r.selected}
                disabled={unmatched}
                onChange={(e) => update(key, { selected: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#b20202] focus:ring-[#b20202]/20 disabled:opacity-40"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{r.item.extractedName}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${conf.cls}`}>
                    {conf.label}
                  </span>
                  {r.item.sizeText && (
                    <span className="text-[10px] text-gray-400">extracted: {r.item.sizeText}</span>
                  )}
                </div>
                {r.item.note && (
                  <p className="mt-0.5 text-[11px] text-gray-500">{r.item.note}</p>
                )}
                {sp ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-700">
                      {r.item.matchedProductName}
                    </span>
                    {sp.sizes.length > 1 && (
                      <select
                        value={r.sizeId ?? ''}
                        onChange={(e) => update(key, { sizeId: e.target.value })}
                        className="rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                      >
                        {sp.sizes.map((s) => (
                          <option key={s.size} value={s.size}>
                            {s.displayName ?? s.size}
                            {s.sellingPrice ? ` · ${fmtCur(s.sellingPrice, 'NGN')}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {sp.sizes.length > 0 && (
                      <span className="text-[11px] font-medium text-gray-900">
                        {fmtCur(
                          sp.sizes.find((s) => s.size === r.sizeId)?.sellingPrice ??
                            sp.baseSellingPrice,
                          'NGN'
                        )}
                      </span>
                    )}
                    {/* qty stepper */}
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="flex items-center rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() => update(key, { qty: Math.max(1, r.qty - 1) })}
                          disabled={r.qty <= 1}
                          className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                        >
                          <PiMinus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold">{r.qty}</span>
                        <button
                          type="button"
                          onClick={() => update(key, { qty: Math.min(999, r.qty + 1) })}
                          className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50"
                        >
                          <PiPlus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-xs text-gray-400">No catalogue match.</p>
                    <Link
                      href={routes.eCommerce.createSubProduct}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#b20202] hover:underline"
                    >
                      Create new product <PiArrowSquareOut className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build the initial reviewed row from a scan result item. */
function toReviewedRow(item: ScanResultItem): ReviewedRow {
  const sp = item.matchedSubProducts[0];
  const sizeId =
    item.suggestedSizeId ??
    (sp?.sizes.find((s) => s.isDefault)?.size) ??
    sp?.sizes[0]?.size ??
    null;
  return {
    item,
    selected: item.confidence !== 'none',
    sizeId,
    qty: Math.max(1, item.qty),
  };
}