'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiCheck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  vendorPricelistService,
  type VendorPricelist,
} from '@/services/vendorPricelist.service';
import { fraunces } from '../purchases-fonts';
import ConfirmDialog from './confirm-dialog';
import DetailHeader from './detail-header';
import DetailMetadata, { DATE_RANGE_HINT, dateRangeInvalid } from './detail-metadata';
import LineItemsEditor from './line-items-editor';
import {
  isBigJump,
  makeLineKey,
  netPrice,
  toPayloadItems,
  type EditorLine,
} from './helpers';

type DetailDoc = Omit<VendorPricelist, 'items'> & { items: EditorLine[] };

/** Exact plan signature — every editable field plus the items array. */
function signature(p: VendorPricelist | null): string {
  return p
    ? JSON.stringify([
        p.name,
        p.vendor,
        p.vendorName,
        p.currency,
        p.startDate,
        p.endDate,
        p.isActive,
        p.discountPercent,
        p.notes,
        p.autoManaged,
        p.source,
        p.items,
      ])
    : '';
}

function withKeys(data: VendorPricelist): DetailDoc {
  return {
    ...data,
    items: (data.items ?? []).map((it) => ({ ...it, _key: makeLineKey() })),
  };
}

export default function PurchasesPricelistDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [pl, setPl] = useState<DetailDoc | null>(null);
  const [snapshot, setSnapshot] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = signature(pl) !== snapshot;

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorPricelistService.getPricelist(id, token);
      const next = withKeys(res.data);
      setPl(next);
      setSnapshot(signature(next));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  function patch(p: Partial<VendorPricelist>) {
    setPl((prev) => (prev ? { ...prev, ...p } : prev));
  }

  async function toggleActive() {
    if (!pl || togglingActive) return;
    const nextIsActive = !pl.isActive;
    setTogglingActive(true);
    try {
      await vendorPricelistService.updatePricelist(
        id,
        { isActive: nextIsActive },
        token
      );
      const next = { ...pl, isActive: nextIsActive };
      setPl(next);
      setSnapshot(signature(next));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setTogglingActive(false);
    }
  }

  const datesInvalid = dateRangeInvalid(pl?.startDate, pl?.endDate);

  async function save() {
    if (!pl || saving) return;
    if (!pl.name?.trim()) {
      toast.error('Pricelist name is required');
      return;
    }
    if (datesInvalid) {
      toast.error(DATE_RANGE_HINT);
      return;
    }
    setSaving(true);
    try {
      await vendorPricelistService.updatePricelist(
        id,
        {
          name: pl.name,
          vendorName: pl.vendorName,
          currency: pl.currency,
          isActive: pl.isActive,
          discountPercent: pl.discountPercent,
          notes: pl.notes,
          autoManaged: pl.autoManaged,
          source: pl.source,
          startDate: pl.startDate,
          endDate: pl.endDate,
          items: toPayloadItems(pl.items),
        },
        token
      );
      setSnapshot(signature(pl));
      toast.success('Pricelist saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function syncFromLastPO() {
    if (!pl || syncing) return;
    setSyncing(true);
    try {
      const res = await vendorPricelistService.syncNow(id, token);
      if (!res.success) {
        toast.error(res.message || 'Nothing to sync');
      } else {
        toast.success(
          `Synced from ${res.result?.poNumber ?? 'last PO'} — ${res.result?.changed ?? 0} price change(s)`
        );
        if (res.data) {
          const next = withKeys(res.data);
          setPl(next);
          setSnapshot(signature(next));
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function remove() {
    if (!pl || deleting) return;
    setDeleting(true);
    try {
      await vendorPricelistService.deletePricelist(id, token);
      toast.success('Pricelist deleted');
      router.push(routes.eCommerce.vendorPricelists);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  const totals = useMemo(() => {
    const items = pl?.items ?? [];
    const value = items.reduce((s, l) => s + netPrice(l), 0);
    const preferred = items.filter((l) => l.isPreferred).length;
    const alerts = items.filter((l) => isBigJump(l)).length;
    return { lines: items.length, value, preferred, alerts };
  }, [pl]);

  if (loading) {
    return (
      <div>
        <div className="mb-6 h-28 animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
        <div className="h-[440px] animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
      </div>
    );
  }

  if (!pl) {
    return (
      <div className="rounded-2xl border border-[#ece4d6] bg-white py-20 text-center">
        <p className="text-sm text-gray-500">Pricelist not found</p>
        <Link
          href={routes.eCommerce.vendorPricelists}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#b20202]"
        >
          <PiArrowLeft className="h-4 w-4" /> Back to pricelists
        </Link>
      </div>
    );
  }

  const saveDisabled = saving || !dirty || datesInvalid || !pl.name?.trim();

  return (
    <div className="space-y-5">
      <DetailHeader
        pl={pl}
        dirty={dirty}
        totals={totals}
        saving={saving}
        saveDisabled={saveDisabled}
        syncing={syncing}
        togglingActive={togglingActive}
        deleting={deleting}
        onSave={save}
        onToggleActive={toggleActive}
        onSyncFromLastPO={syncFromLastPO}
        onRequestDelete={() => setConfirmDelete(true)}
      />

      {/* ── Metadata ── */}
      <DetailMetadata pl={pl} onPatch={patch} />

      {/* ── Line items ── */}
      <LineItemsEditor
        lines={pl.items}
        currency={pl.currency}
        globalDiscountPercent={pl.discountPercent}
        onChange={(items: EditorLine[]) =>
          setPl((prev) => (prev ? { ...prev, items } : prev))
        }
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saveDisabled}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
        >
          <PiCheck className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${pl.name}"?`}
        message="This pricelist and its price lines will be permanently removed."
        confirmLabel="Delete"
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </div>
  );
}
