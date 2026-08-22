// client/apps/admin/src/app/shared/purchases/purchases-scan-drawer.tsx
'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  PiX,
  PiCamera,
  PiTextT,
  PiUploadSimple,
  PiSpinner,
  PiWarningCircle,
  PiPlus,
  PiArrowSquareOut,
  PiMinus,
  PiStack,
} from 'react-icons/pi';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { routes } from '@/config/routes';
import { fmtCur } from './purchases-analytics-helpers';
import { scanService, type ScanResultItem } from '@/services/scan.service';
import PurchasesProductLineSearch from './purchases-product-line-search';
import {
  scanRowToPurchaseLine,
  scanRowCostPrice,
  type PurchaseLineDraft,
  type PurchaseLineOverride,
} from './purchases-scan-selection';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

type Mode = 'qr' | 'upload' | 'paste';
type Phase = 'idle' | 'working' | 'done' | 'error';

interface ReviewedRow {
  /** Stable per-result identity (positional) — extracted names can repeat. */
  rowKey: string;
  item: ScanResultItem;
  selected: boolean;
  sizeId: string | null;
  qty: number;
  /** When the operator manually picks a product via the override picker. */
  override?: PurchaseLineOverride;
  overriding?: boolean;
}

const CONF_BADGE: Record<string, { label: string; cls: string }> = {
  exact: { label: 'Exact', cls: 'bg-emerald-50 text-emerald-600' },
  partial: { label: 'Partial', cls: 'bg-amber-50 text-amber-600' },
  none: { label: 'Not found', cls: 'bg-gray-100 text-gray-500' },
};

export interface PurchasesScanDrawerProps {
  open: boolean;
  token: string;
  onClose: () => void;
  /** Add one purchase-order line. Called once per accepted row. */
  onAdd: (line: PurchaseLineDraft) => void;
}

/**
 * Scan & Match drawer for the purchase-order create/edit pages. The purchases
 * twin of sales/sales-scan-drawer.tsx — same server endpoints, same three
 * input modes:
 *  - QR: show a code the buyer scans with their phone to photograph a vendor's
 *    quotation; the result streams back here via polling.
 *  - Upload: drop a photo or a PDF/Word/Excel/CSV quotation on the desktop.
 *  - Paste: paste a free-form list from an email or WhatsApp.
 * Every price shown and added is the COST price (see purchases-scan-selection).
 */
export default function PurchasesScanDrawer({
  open,
  token,
  onClose,
  onAdd,
}: PurchasesScanDrawerProps) {
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
      const { pairingCode: code, expiresAt: exp } =
        await scanService.createPairing(token);
      setPairingCode(code);
      setExpiresAt(exp);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        // Pairing codes die server-side after ~10 min — stop polling and tell
        // the buyer instead of hammering the status endpoint forever.
        if (exp && Date.now() > exp) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setPhase('error');
          setError(
            'Pairing code expired — tap “Regenerate code” for a fresh one.'
          );
          return;
        }
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
              (st.result && (st.result as { error?: string }).error) ||
                'Scan failed'
            );
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    } catch (err) {
      setPhase('error');
      setError(
        err instanceof Error ? err.message : 'Failed to create pairing code'
      );
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
        const isImage = file.type.startsWith('image/');
        let items;
        if (isImage) {
          // Images: upload to Cloudinary, then AI-match via image URL.
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
          if (!upRes.ok || !upBody.success)
            throw new Error(upBody.message || 'Upload failed');
          items = await scanService.match(token, {
            imageUrl: upBody.data?.url ?? '',
          });
        } else {
          // Documents (PDF / Word / Excel / CSV): extract text server-side.
          const form = new FormData();
          form.append('file', file);
          const docRes = await fetch(`${API_URL}/api/scan/upload-document`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const docBody = (await docRes.json().catch(() => ({}))) as {
            success?: boolean;
            message?: string;
            data?: { items?: unknown[] };
          };
          if (!docRes.ok || !docBody.success)
            throw new Error(docBody.message || 'Document processing failed');
          items = docBody.data?.items ?? [];
        }
        setRows((items as ScanResultItem[]).map(toReviewedRow));
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

  // ── Review → add to the PO ─────────────────────────────────────────────────
  // A row is addable only when it has something to add: a manual override or an
  // actual matched subproduct (the AI can report confidence without one).
  const selectedRows = rows.filter(
    (r) =>
      r.selected &&
      (r.override ||
        (r.item.confidence !== 'none' && r.item.matchedSubProducts[0]))
  );

  function addSelected() {
    for (const r of selectedRows) {
      const line = scanRowToPurchaseLine(r.item, {
        sizeId: r.sizeId,
        qty: r.qty,
        override: r.override,
      });
      if (line) onAdd(line);
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
          <h2 className="text-base font-semibold text-gray-900">
            Scan &amp; Match
          </h2>
          <div className="ml-auto flex items-center gap-1">
            {!showReview && (
              <>
                <ModeTab active={mode === 'qr'} onClick={() => setMode('qr')}>
                  <PiCamera className="h-4 w-4" /> QR
                </ModeTab>
                <ModeTab
                  active={mode === 'upload'}
                  onClick={() => setMode('upload')}
                >
                  <PiUploadSimple className="h-4 w-4" /> Upload
                </ModeTab>
                <ModeTab
                  active={mode === 'paste'}
                  onClick={() => setMode('paste')}
                >
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
            <ReviewList rows={rows} setRows={setRows} token={token} />
          ) : (
            <>
              {/* QR mode */}
              {mode === 'qr' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  {pairingCode ? (
                    <>
                      <p className="text-center text-sm text-gray-600">
                        Scan this code with your phone to photograph a vendor
                        quotation. Matched products appear here automatically.
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
                        Code <span className="font-mono">{pairingCode}</span> ·
                        expires in ~
                        {Math.max(
                          1,
                          Math.round((expiresAt - Date.now()) / 60000)
                        )}{' '}
                        min
                      </p>
                      {phase === 'idle' && (
                        <p className="flex items-center gap-2 text-xs text-gray-500">
                          <PiSpinner className="h-3.5 w-3.5 animate-spin" />{' '}
                          Waiting for your phone…
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
                <UploadDropzone
                  onFile={handleUpload}
                  busy={phase === 'working'}
                />
              )}

              {/* Paste mode */}
              {mode === 'paste' && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-600">
                    Paste a vendor&apos;s quotation, price list, or an email.
                    The AI parses it into items and matches each to your
                    catalogue at cost price.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={8}
                    placeholder={
                      'e.g.\n10 cartons Hennessy VS 70cl\nJameson 1L x 24\nRemy Martin VSOP\n5 cases Moet champagne'
                    }
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                  />
                  <button
                    type="button"
                    onClick={handlePaste}
                    disabled={!pasteText.trim() || phase === 'working'}
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#b20202] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8f0202] disabled:opacity-40"
                  >
                    {phase === 'working' ? (
                      <>
                        <PiSpinner className="h-4 w-4 animate-spin" />{' '}
                        Analyzing…
                      </>
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
                className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8f0202] disabled:opacity-40"
              >
                Add {selectedRows.length || ''} to PO
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

function UploadDropzone({
  onFile,
  busy,
}: {
  onFile: (f: File) => void;
  busy: boolean;
}) {
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
          <p className="text-sm text-gray-600">Analyzing file…</p>
        </>
      ) : (
        <>
          <PiUploadSimple className="h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">
            Drag a vendor quotation here or click to choose
          </p>
          <p className="text-xs text-gray-400">
            Photo · PDF · Word · Excel · CSV
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8f0202]"
          >
            Choose file
          </button>
        </>
      )}
    </div>
  );
}

function ReviewList({
  rows,
  setRows,
  token,
}: {
  rows: ReviewedRow[];
  setRows: Dispatch<SetStateAction<ReviewedRow[]>>;
  token: string;
}) {
  function update(key: string, patch: Partial<ReviewedRow>) {
    setRows((rs) => rs.map((r) => (r.rowKey === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const key = r.rowKey;
        const conf = CONF_BADGE[r.item.confidence] ?? CONF_BADGE.none;
        const sp = r.item.matchedSubProducts[0];
        const unmatched = (r.item.confidence === 'none' || !sp) && !r.override;
        const hasMatch = !!sp || !!r.override;
        const cost = scanRowCostPrice(r.item, r.sizeId, r.override);
        const packSize =
          r.override?.packSize ??
          sp?.sizes.find((s) => s.size === r.sizeId)?.unitsPerPack ??
          1;

        return (
          <div
            key={key}
            className={`rounded-xl border p-3 ${
              unmatched
                ? 'border-gray-200 bg-gray-50/60'
                : 'border-gray-200 bg-white'
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
                {/* Row header */}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {r.item.extractedName}
                  </p>
                  {r.override ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      Manually set
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${conf.cls}`}
                    >
                      {conf.label}
                    </span>
                  )}
                  {r.item.sizeText && (
                    <span className="text-[10px] text-gray-400">
                      extracted: {r.item.sizeText}
                    </span>
                  )}
                </div>
                {r.item.note && !r.override && (
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {r.item.note}
                  </p>
                )}

                {/* Match info */}
                {hasMatch && !r.overriding && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-700">
                      {r.override?.productName ?? r.item.matchedProductName}
                    </span>
                    {/* Size picker — only for AI-matched rows (an override has
                        already picked its size). */}
                    {!r.override && sp && sp.sizes.length > 1 && (
                      <select
                        value={r.sizeId ?? ''}
                        onChange={(e) =>
                          update(key, { sizeId: e.target.value })
                        }
                        className="rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                      >
                        {sp.sizes.map((s) => (
                          <option key={s.size} value={s.size}>
                            {s.displayName ?? s.size}
                            {s.costPrice || sp.costPrice
                              ? ` · ${fmtCur(s.costPrice || sp.costPrice, 'NGN')}`
                              : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {/* Cost price — what this line will cost us per unit. */}
                    {cost > 0 && (
                      <span className="text-[11px] font-medium text-gray-900">
                        {fmtCur(cost, 'NGN')}
                        <span className="ml-1 font-normal text-gray-400">
                          cost
                        </span>
                      </span>
                    )}
                    {packSize > 1 && (
                      <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        <PiStack className="h-3 w-3" />
                        {packSize}/pack
                      </span>
                    )}
                    {/* Change / clear override */}
                    <button
                      type="button"
                      onClick={() => update(key, { overriding: true })}
                      className="ml-1 text-[10px] font-medium text-[#b20202] hover:underline"
                    >
                      Change
                    </button>
                    {r.override && (
                      <button
                        type="button"
                        onClick={() =>
                          update(key, {
                            override: undefined,
                            selected: false,
                            overriding: false,
                          })
                        }
                        className="text-[10px] text-gray-400 hover:text-gray-600 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                    {/* Qty stepper */}
                    <div className="ml-auto flex items-center rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() =>
                          update(key, { qty: Math.max(1, r.qty - 1) })
                        }
                        disabled={r.qty <= 1}
                        className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                      >
                        <PiMinus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-semibold">
                        {r.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          update(key, { qty: Math.min(9999, r.qty + 1) })
                        }
                        className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50"
                      >
                        <PiPlus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline override picker: shown when unmatched OR on "Change" */}
                {(unmatched || r.overriding) && (
                  <div className="mt-2">
                    {unmatched && (
                      <p className="mb-1.5 text-[11px] text-gray-400">
                        Not found — search your catalogue to assign manually:
                      </p>
                    )}
                    <PurchasesProductLineSearch
                      token={token}
                      query={r.item.extractedName}
                      onSelect={(sel) => {
                        update(key, {
                          override: sel,
                          overriding: false,
                          selected: true,
                          sizeId: sel.sizeId ?? null,
                        });
                      }}
                    />
                    {r.overriding && (
                      <button
                        type="button"
                        onClick={() => update(key, { overriding: false })}
                        className="mt-1 text-[10px] text-gray-400 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Link
                        href={routes.eCommerce.createSubProduct}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b20202] hover:underline"
                      >
                        Create new product{' '}
                        <PiArrowSquareOut className="h-3 w-3" />
                      </Link>
                    </div>
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

/** Build the initial reviewed row from a scan result item. The positional
 *  index keys the row — extracted names/brands can repeat within one scan. */
function toReviewedRow(item: ScanResultItem, index: number): ReviewedRow {
  const sp = item.matchedSubProducts[0];
  const sizeId =
    item.suggestedSizeId ??
    sp?.sizes.find((s) => s.isDefault)?.size ??
    sp?.sizes[0]?.size ??
    null;
  return {
    rowKey: String(index),
    item,
    selected: item.confidence !== 'none' && !!sp,
    sizeId,
    qty: Math.max(1, item.qty),
  };
}
