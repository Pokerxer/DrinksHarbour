'use client';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import { X } from 'lucide-react';
import {
  fetchPeerEmployeeScores,
  type PeerEmployee,
  type PeerEmployeeScores,
} from '@/services/peerAppraisal.service';
import { formatMoney } from './result-card';
import ScoreComponents from './score-components';
export default function EmployeeScores({
  cycleId,
  employee,
  onClose,
}: {
  cycleId: string;
  employee: PeerEmployee;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PeerEmployeeScores | null>(null),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError('');
    fetchPeerEmployeeScores(cycleId, employee.employee)
      .then((data) => {
        if (active) {
          if (data.employee !== employee.employee)
            throw new Error('The employee details changed. Please retry.');
          setDetail(data);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Could not load employee scores.'
          );
      });
    return () => {
      active = false;
    };
  }, [cycleId, employee.employee, reload]);
  return (
    <Dialog open onClose={onClose} className="fixed inset-0 z-[100]">
      <div className="fixed inset-0 bg-black/35" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
          <DialogPanel className="w-full max-w-3xl space-y-5 rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#b20202]">
                  Performance breakdown
                </p>
                <DialogTitle className="break-words text-xl font-semibold text-gray-900">
                  {employee.displayName}’s scores
                </DialogTitle>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close scores"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b20202]"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <Description className="text-sm leading-6 text-gray-500">
              {detail?.final
                ? 'Released results from this appraisal cycle.'
                : 'Scores remain provisional until HR closes the appraisal cycle. Missing scores are not counted as zero.'}
            </Description>
            {error ? (
              <div
                role="alert"
                className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                <p>{error}</p>
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => setReload((n) => n + 1)}
                >
                  Retry scores
                </button>
              </div>
            ) : !detail ? (
              <p
                role="status"
                className="rounded-xl bg-gray-50 p-6 text-sm text-gray-500"
              >
                Loading employee scores…
              </p>
            ) : (
              <>
                <ScoreComponents detail={detail} />
                {detail.combined ? (
                  <section
                    aria-label="Combined score and bonus"
                    className="flex flex-wrap items-center justify-between gap-5 rounded-xl bg-red-50 p-5"
                  >
                    <div>
                      <p className="text-xs font-medium text-[#790505]">
                        {detail.final ? 'Final total' : 'Provisional total'}
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#790505]">
                        {detail.combined.score.toFixed(2)} / 100
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">
                        {detail.final ? 'Calculated bonus' : 'Estimated bonus'}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
                        {formatMoney(detail.combined.bonusMinor)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Allocation {formatMoney(detail.allocationMinor)}
                      </p>
                    </div>
                  </section>
                ) : (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-500">
                    Combined score is available when all required ratings,
                    examination and attendance scores are complete.
                  </p>
                )}
                <p className="text-xs leading-5 text-gray-500">
                  Each component contributes its score × its weight. Bonuses use
                  the unrounded total. Individual colleague ratings remain
                  private.
                </p>
              </>
            )}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
