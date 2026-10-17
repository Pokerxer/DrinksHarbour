'use client';
import { useMemo, useState, useRef } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { PiArrowsClockwise } from 'react-icons/pi';
import { useSubProductReview } from './useSubProductReview';
import { buildOverrides, reviewLines } from './pricing';
import type { PriceTargets, ReviewOverrides } from './types';
import ReviewWorkspace from './ReviewWorkspace';
import ReviewFooter from './ReviewFooter';
import ReviewHeader from './ReviewHeader';
import ReviewDiscardPrompt from './ReviewDiscardPrompt';
import { useReviewNavigation } from './useReviewNavigation';
import { inspectRows, type RowFilter } from './workspace';
import ReviewOverview, { ReviewInventory } from './ReviewOverview';
const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40';
export default function ReviewSubProductModal({
  subProductId,
  token,
  onClose,
  onApprove,
  onDecline,
}: {
  subProductId: string;
  token: string;
  onClose: () => void;
  onApprove: (id: string, overrides: ReviewOverrides) => Promise<void>;
  onDecline: (id: string, reason?: string) => Promise<void>;
}) {
  const { listing, drafts, loading, error, edit, updateDrafts, reset, refresh } =
    useSubProductReview(subProductId, token);
  const [targets, setTargets] = useState<PriceTargets>({ platform: '', tenant: '' });
  const [tab, setTab] = useState('pricing');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RowFilter>('all');
  const body = useRef<HTMLElement>(null);
  const [action, setAction] = useState<'approve' | 'decline' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const lines = useMemo(() => (listing ? reviewLines(listing) : []), [listing]);
  const rows = useMemo(
    () => (listing ? inspectRows(lines, drafts, listing, targets) : []),
    [lines, drafts, listing, targets]
  );
  const blocked = rows.filter((row) => row.error);
  const invalid = blocked[0]?.error || null;
  const edited = rows.filter((row) => row.changed).length;
  const navigation = useReviewNavigation({
    recordKey: `${subProductId}:${token}`,
    dirty: edited > 0 || (declining && !!reason.trim()),
    busy: !!action,
    onClose,
    onFocusReview: () => body.current?.focus(),
    onReload: () => {
      setActionError(null);
      setDeclining(false);
      setReason('');
      refresh();
    },
  });
  const close = () => navigation.request('close');
  const approve = async () => {
    if (!listing || action) return;
    setActionError(null);
    try {
      const overrides = buildOverrides(lines, drafts, listing);
      setAction('approve');
      await onApprove(listing._id, overrides);
      onClose();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : 'Approval failed. Please try again.'
      );
    } finally {
      setAction(null);
    }
  };
  const decline = async () => {
    if (!listing || action) return;
    setActionError(null);
    setAction('decline');
    try {
      await onDecline(listing._id, reason.trim() || undefined);
      onClose();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : 'Decline failed. Please try again.'
      );
    } finally {
      setAction(null);
    }
  };
  return (
    <Dialog
      open
      onClose={() => (navigation.pending ? navigation.cancel() : close())}
      className="relative z-[9999]"
    >
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0">
        <DialogPanel className="flex h-full w-full max-w-none flex-col overflow-hidden bg-white">
          <ReviewHeader
            listing={listing}
            edited={edited}
            busy={!!action}
            onClose={close}
          />
          {listing && (
            <nav
              aria-label="Review sections"
              className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-gray-200 px-4 py-2 sm:px-6"
            >
              {[
                ['pricing', 'Pricing & margins'],
                ['details', 'Listing details'],
                ['inventory', 'Inventory'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                  className={`min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-blue-500 ${tab === value ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                aria-label="Reload listing details"
                disabled={!!action}
                onClick={() => navigation.request('reload')}
                className={`${button} ml-auto shrink-0`}
              >
                <PiArrowsClockwise aria-hidden />
                Reload
              </button>
            </nav>
          )}
          <main
            ref={body}
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6"
          >
            {loading ? (
              <p role="status" className="py-24 text-center text-sm text-gray-500">
                Loading listing details…
              </p>
            ) : error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-white p-6"
              >
                <p className="text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  aria-label="Retry listing details"
                  onClick={refresh}
                  className={`${button} mt-4`}
                >
                  Try again
                </button>
              </div>
            ) : (
              listing && (
                <>
                  {tab === 'pricing' && (
                    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <ReviewWorkspace
                        lines={lines}
                        listing={listing}
                        drafts={drafts}
                        targets={targets}
                        onTargets={setTargets}
                        onEdit={(lineId, field, value) => {
                          setActionError(null);
                          edit(lineId, field, value);
                        }}
                        onBatch={updateDrafts}
                        onReset={reset}
                        disabled={!!action}
                        query={query}
                        onQuery={setQuery}
                        filter={filter}
                        onFilter={setFilter}
                      />
                      <aside className="min-w-0 xl:sticky xl:top-0">
                        <ReviewOverview listing={listing} />
                      </aside>
                    </div>
                  )}
                  {tab === 'details' && (
                    <div className="mx-auto max-w-5xl">
                      <ReviewOverview listing={listing} />
                    </div>
                  )}
                  {tab === 'inventory' && <ReviewInventory listing={listing} />}
                </>
              )
            )}
          </main>
          {navigation.pending ? (
            <ReviewDiscardPrompt
              intent={navigation.pending}
              edited={edited}
              onKeep={navigation.cancel}
              onDiscard={navigation.proceed}
            />
          ) : (
            <ReviewFooter
              loaded={!!listing}
              edited={edited}
              blocked={blocked.length}
              invalid={invalid}
              action={action}
              actionError={actionError}
              declining={declining}
              reason={reason}
              onReason={setReason}
              onDeclining={(value) => {
                setDeclining(value);
                setActionError(null);
              }}
              onClose={close}
              onApprove={approve}
              onDecline={decline}
              onShowIssues={() => {
                setTab('pricing');
                setQuery('');
                setFilter('blocked');
                if (body.current) body.current.scrollTop = 0;
              }}
            />
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
