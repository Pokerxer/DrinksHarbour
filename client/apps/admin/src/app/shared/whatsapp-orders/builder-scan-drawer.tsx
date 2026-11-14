// client/apps/admin/src/app/shared/whatsapp-orders/builder-scan-drawer.tsx
'use client';

// Trimmed clone of shared/sales/sales-scan-drawer.tsx for the WhatsApp order
// builder. Same mechanics (scanService pairing/match, upload, Esc, scroll lock),
// but rows resolve into per-tenant offers through BuilderTenantPicker instead of
// an inline size picker: the AI match row carries the product id, and the
// marketplace price only exists via fetchTenantOffers inside the picker.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  PiX,
  PiCamera,
  PiTextT,
  PiUploadSimple,
  PiSpinner,
  PiWarningCircle,
  PiPlus,
  PiMinus,
  PiMagnifyingGlass,
  PiCaretRight,
  PiCheckCircle,
  PiXCircle,
} from 'react-icons/pi';
import { QRCodeCanvas } from 'qrcode.react';
import {
  scanService,
  type ScanResultItem,
} from '@/services/scan.service';
import type { BuilderLine } from '@/services/whatsapp-order.service';
import BuilderTenantPicker from './builder-tenant-picker';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const SEARCH_DEBOUNCE_MS = 300;

type Mode = 'paste' | 'upload' | 'qr';
type Phase = 'idle' | 'working' | 'done' | 'error';

interface ScanRow {
  /** Stable per-result identity (positional) — extracted names can repeat. */
  rowKey: string;
  item: ScanResultItem;
  /** AI-extracted quantity — seeds the tenant picker's stepper. */
  qty: number;
  /** Line staged via the tenant picker (one per row: picking a tenant/size
   *  completes the row). */
  staged?: Omit<BuilderLine, 'key'> | null;
}

const CONF_BADGE: Record<string, { label: string; cls: string }> = {
  exact: { label: 'Exact', cls: 'bg-emerald-50 text-emerald-600' },
  partial: { label: 'Partial', cls: 'bg-amber-50 text-amber-600' },
  none: { label: 'Not found', cls: 'bg-gray-100 text-gray-500' },
};

export interface BuilderScanDrawerProps {
  open: boolean;
  token: string;
  onClose: () => void;
  /** Add the staged lines to the order (orchestrator appends + closes). */
  onAdd: (lines: BuilderLine[]) => void;
}

/**
 * Scan & Match drawer for the WhatsApp order builder (platform admins —
 * matching is cross-tenant server-side). Three input modes:
 *  - Paste: free-form text (a list / notes / an invoice).
 *  - Upload: photo (Cloudinary → image match) or PDF/DOC(X)/CSV document.
 *  - QR: pairing code the operator scans with their phone; the result streams
 *    back here via status polling.
 * Matched rows open BuilderTenantPicker (per-tenant offers, marketplace
 * prices); unmatched rows fall back to a manual catalogue search.
 */
export default function BuilderScanDrawer({
  open,
  token,
  onClose,
  onAdd,
}: BuilderScanDrawerProps) {
  const [mode, setMode] = useState<Mode>('paste');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');

  // QR pairing state.
  const [pairingCode, setPairingCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Paste state.
  const [pasteText, setPasteText] = useState('');

  // Review state.
  const [rows, setRows] = useState<ScanRow[]>([]);

  // Tenant picker target — scan matches and manual fallbacks both funnel
  // through the shared product-based picker.
  const [picker, setPicker] = useState<{
    rowKey: string;
    productId: string;
    productName: string;
  } | null>(null);
  // Esc must not close the drawer while the picker dialog sits on top.
  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = Boolean(picker);

  // ── Lifecycle: reset on close ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setMode('paste');
      setPhase('idle');
      setError('');
      setPairingCode('');
      setPasteText('');
      setRows([]);
      setPicker(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [open]);

  // Esc to close + lock body scroll (cloned from the sales drawer; Esc is
  // suppressed while the tenant-picker dialog is open so it closes only that).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pickerOpenRef.current) onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // ── QR pairing: create on mount, poll for completion (sales drawer clone) ──
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
      // Polling fallback guarantees the drawer updates even if the socket
      // can't connect (codes die server-side after ~10 min).
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (exp && Date.now() > exp) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setPhase('error');
          setError('Pairing code expired — tap “Regenerate code” for a fresh one.');
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
              setRows(st.result.map(toScanRow));
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
          // Documents (PDF / Word / Excel / CSV): extract text server-side,
          // then AI-match.
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
        setRows(
          (items as ScanResultItem[]).map(toScanRow)
        );
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
      setRows(items.map(toScanRow));
      setPhase('done');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Failed to analyze text');
    }
  }, [token, pasteText]);

  // ── Review → stage → add to order ─────────────────────────────────────────
  const stagedRows = rows.filter((r) => r.staged);

  const handlePickerAdd = useCallback(
    (ls: Array<Omit<BuilderLine, 'key'>>) => {
      if (!picker) return;
      const line = ls[0];
      if (!line) return;
      setRows((rs) =>
        rs.map((r) => (r.rowKey === picker.rowKey ? { ...r, staged: line } : r))
      );
      setPicker(null);
    },
    [picker]
  );

  function addStaged() {
    const staged = stagedRows
      .map((r) => r.staged)
      .filter(Boolean)
      .map((l) => ({ ...(l as Omit<BuilderLine, 'key'>), key: crypto.randomUUID() }));
    if (!staged.length) return;
    onAdd(staged);
    onClose();
  }

  if (!open) return null;

  const showReview = phase === 'done' && rows.length > 0;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50">
        <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-gray-900">
              Scan &amp; Match
            </h2>
            <div className="ml-auto flex items-center gap-1">
              {!showReview && (
                <>
                  <ModeTab
                    active={mode === 'paste'}
                    onClick={() => setMode('paste')}
                  >
                    <PiTextT className="h-4 w-4" /> Paste
                  </ModeTab>
                  <ModeTab
                    active={mode === 'upload'}
                    onClick={() => setMode('upload')}
                  >
                    <PiUploadSimple className="h-4 w-4" /> Upload
                  </ModeTab>
                  <ModeTab active={mode === 'qr'} onClick={() => setMode('qr')}>
                    <PiCamera className="h-4 w-4" /> QR
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {showReview ? (
              <ReviewList
                rows={rows}
                setRows={setRows}
                token={token}
                onPickProduct={(rowKey, productId, productName) =>
                  setPicker({ rowKey, productId, productName })
                }
              />
            ) : (
              <>
                {/* Paste mode */}
                {mode === 'paste' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-gray-600">
                      Paste the customer&apos;s WhatsApp list, notes, or an
                      invoice. The AI parses it into items and matches each
                      across all tenants&apos; catalogues.
                    </p>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={8}
                      placeholder={
                        'e.g.\n2x Hennessy VS 70cl\nJameson 1L\nRemy Martin\nA bottle of Moet champagne'
                      }
                      className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                    <button
                      type="button"
                      onClick={handlePaste}
                      disabled={!pasteText.trim() || phase === 'working'}
                      className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
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

                {/* Upload mode */}
                {mode === 'upload' && (
                  <UploadDropzone
                    onFile={handleUpload}
                    busy={phase === 'working'}
                  />
                )}

                {/* QR mode */}
                {mode === 'qr' && (
                  <div className="flex flex-col items-center gap-4 py-4">
                    {pairingCode ? (
                      <>
                        <p className="text-center text-sm text-gray-600">
                          Scan this code with your phone to take a photo.
                          Matched products appear here automatically.
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
                          Code <span className="font-mono">{pairingCode}</span>{' '}
                          · expires in ~
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
                          className="text-xs font-medium text-brand hover:underline"
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
                {stagedRows.length} of {rows.length} ready
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
                  onClick={addStaged}
                  disabled={stagedRows.length === 0}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
                >
                  Add {stagedRows.length || ''} line
                  {stagedRows.length === 1 ? '' : 's'} to order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shared tenant picker — scan matches (and manual fallback picks)
          resolve into per-tenant offers here. */}
      <BuilderTenantPicker
        open={Boolean(picker)}
        onClose={() => setPicker(null)}
        token={token}
        productId={picker?.productId ?? null}
        productName={picker?.productName ?? ''}
        initialQty={picker ? rows.find((r) => r.rowKey === picker.rowKey)?.qty : undefined}
        onAdd={handlePickerAdd}
      />
    </>
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
        active ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
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
        drag ? 'border-brand bg-red-50/30' : 'border-gray-200'
      }`}
    >
      {busy ? (
        <>
          <PiSpinner className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm text-gray-600">Analyzing file…</p>
        </>
      ) : (
        <>
          <PiUploadSimple className="h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">
            Drag a file here or click to choose
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
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
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
  onPickProduct,
}: {
  rows: ScanRow[];
  setRows: React.Dispatch<React.SetStateAction<ScanRow[]>>;
  token: string;
  /** Open the tenant picker for a row's product (AI match or manual pick). */
  onPickProduct: (rowKey: string, productId: string, productName: string) => void;
}) {
  function update(key: string, patch: Partial<ScanRow>) {
    setRows((rs) => rs.map((r) => (r.rowKey === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const key = r.rowKey;
        const conf = CONF_BADGE[r.item.confidence] ?? CONF_BADGE.none;
        // buildResult (scanMatch.service) only returns matchedSubProducts on
        // rows that also carry matchedProductId — so a missing id means the
        // row is genuinely unmatched and needs the manual fallback.
        const matched = Boolean(r.item.matchedProductId);
        const unmatched = !matched && !r.staged;

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
              {r.staged ? (
                <PiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : unmatched ? (
                <PiXCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />
              ) : null}
              <div className="min-w-0 flex-1">
                {/* Row header: extractedName · qty · confidence */}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {r.item.extractedName}
                  </p>
                  {r.staged ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      Staged · {r.staged.tenantName}
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
                {r.item.note && !r.staged && (
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {r.item.note}
                  </p>
                )}

                {/* Staged summary */}
                {r.staged && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-700">
                    <span className="font-semibold text-gray-900">
                      {[r.staged.productName, r.staged.sizeName]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span>× {r.staged.quantity}</span>
                    {typeof r.staged.unitPrice === 'number' && (
                      <span className="font-medium text-gray-900">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN',
                          maximumFractionDigits: 0,
                        }).format(r.staged.unitPrice)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => update(key, { staged: null })}
                      className="text-[10px] font-medium text-brand hover:underline"
                    >
                      Choose again
                    </button>
                  </div>
                )}

                {/* Matched row: pick tenant/size/qty via the shared picker */}
                {matched && !r.staged && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-700">
                      {r.item.matchedProductName}
                    </span>
                    {/* AI qty stepper — seeds the picker's default quantity */}
                    <div className="flex items-center rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => update(key, { qty: Math.max(1, r.qty - 1) })}
                        disabled={r.qty <= 1}
                        className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                      >
                        <PiMinus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-semibold">
                        {r.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => update(key, { qty: Math.min(999, r.qty + 1) })}
                        className="flex h-6 w-6 items-center justify-center text-gray-500 hover:bg-gray-50"
                      >
                        <PiPlus className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onPickProduct(
                          key,
                          r.item.matchedProductId as string,
                          r.item.matchedProductName ?? r.item.extractedName
                        )
                      }
                      className="ml-auto flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand"
                    >
                      Choose tenant <PiCaretRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Unmatched row: manual catalogue search fallback */}
                {unmatched && (
                  <div className="mt-2">
                    <p className="mb-1.5 text-[11px] text-gray-400">
                      Not found — search the catalogue to assign manually:
                    </p>
                    <ManualProductSearch
                      token={token}
                      seed={r.item.extractedName}
                      onPick={(productId, productName) =>
                        onPickProduct(key, productId, productName)
                      }
                    />
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

/** Mini catalogue search for unmatched rows — GET /api/subproducts?search=
 *  &limit=8, pick a product → opens the shared tenant picker. */
function ManualProductSearch({
  token,
  seed,
  onPick,
}: {
  token: string;
  seed: string;
  onPick: (productId: string, productName: string) => void;
}) {
  const [draft, setDraft] = useState(seed);
  const [results, setResults] = useState<
    Array<{ _id: string; product?: { _id?: string; name?: string } | null; tenant?: { name?: string } | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = draft.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: 'active',
          search: q,
          limit: '8',
        });
        const res = await fetch(`${API_URL}/api/subproducts?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const body = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { subProducts?: Array<{ _id: string; product?: { _id?: string; name?: string } | null; tenant?: { name?: string } | null }> };
        };
        setResults(body.success ? (body.data?.subProducts ?? []) : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, token]);

  // Group the (per-tenant) rows by product so the admin picks a PRODUCT and
  // then resolves the tenant via the shared picker.
  const byProduct = new Map<string, { productId: string; name: string }>();
  for (const r of results) {
    const pid = r.product?._id;
    if (!pid || byProduct.has(pid)) continue;
    byProduct.set(pid, { productId: pid, name: r.product?.name || 'Unnamed product' });
  }
  const products = [...byProduct.values()];

  return (
    <div>
      <div className="flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/40">
        <PiMagnifyingGlass className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={120}
          placeholder="Search products, SKU or barcode…"
          className="min-h-9 min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0"
        />
        {loading && <PiSpinner className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />}
      </div>
      {products.length > 0 && (
        <div className="mt-1.5 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
          {products.map((p) => (
            <button
              key={p.productId}
              type="button"
              onClick={() => onPick(p.productId, p.name)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
            >
              <span className="truncate font-medium text-gray-800">{p.name}</span>
              <span className="shrink-0 font-semibold text-brand">Choose</span>
            </button>
          ))}
        </div>
      )}
      {!loading && searched && products.length === 0 && draft.trim().length >= 2 && (
        <p className="mt-1.5 text-[11px] text-gray-400">No catalogue matches.</p>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build the initial scan row from a result item. The positional index keys
 *  the row — extracted names/brands can repeat within one scan. */
function toScanRow(item: ScanResultItem, index: number): ScanRow {
  return {
    rowKey: String(index),
    item,
    qty: Math.max(1, item.qty),
  };
}
