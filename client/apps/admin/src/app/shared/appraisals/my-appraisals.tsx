'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiArrowClockwise,
  PiChatCircleText,
  PiCheckCircle,
  PiClipboardText,
  PiHourglassHigh,
  PiUserCircle,
  PiWarningCircle,
} from 'react-icons/pi';
import {
  fetchMyAppraisals,
  fetchMyReviews,
  type Appraisal,
  type ReviewRequest,
} from '@/services/appraisal.service';
import AppraisalSubjectCard from './appraisal-subject-card';
import ReviewRequestRow from './review-request-row';
import {
  computeSubjectStats,
  sortAppraisalsForSubject,
} from './my-appraisals-utils';

// One staggered entrance, nothing perpetual — same restraint as the sign-in
// form. Cards/rows add their own per-index delay on top of this.
const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 26 },
  },
};

function StatCard({
  icon,
  label,
  value,
  iconClass,
  delay,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  iconClass: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 26 }}
      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight text-gray-900">{value}</p>
        <p className="truncate text-[11px] font-medium text-gray-500">{label}</p>
      </div>
    </motion.div>
  );
}

function SectionHeading({
  icon,
  label,
  count,
}: {
  icon: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
      {icon}
      {label}
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
        {count}
      </span>
    </h2>
  );
}

function InlineEmpty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        {icon}
      </div>
      <p className="max-w-xs text-sm text-gray-500">{text}</p>
    </div>
  );
}

export default function MyAppraisals() {
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Serialises loads so a focus-triggered silent refresh can't race the
  // initial fetch (or another refresh) and clobber newer data with older.
  const busyRef = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const silent = opts?.silent ?? false;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [a, r] = await Promise.all([
        fetchMyAppraisals(),
        fetchMyReviews(),
      ]);
      setAppraisals(a);
      setReviews(r);
      setLastUpdated(new Date());
    } catch (e) {
      if (!silent) {
        const msg =
          e instanceof Error ? e.message : 'Failed to load your appraisals';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      busyRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fire the initial fetch on mount. `request()` resolves the session token
  // itself (awaiting the session endpoint if needed), so there is no token
  // gate here — the server's protect() middleware gets its Authorization
  // header from the session regardless of when it finishes hydrating.
  useEffect(() => {
    load();
  }, [load]);

  // Silent re-sync when the tab regains focus — the page is a work queue, so
  // it should reflect submissions made elsewhere without a manual refresh.
  // Errors on this path are swallowed: toasting on every tab switch is noise.
  useEffect(() => {
    const onFocus = () => load({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  // Subject-first ordering (see SUBJECT_STATE_PRIORITY); stable sort keeps
  // the server's createdAt-desc order within each group.
  const sortedAppraisals = useMemo(
    () => sortAppraisalsForSubject(appraisals),
    [appraisals]
  );
  const pendingReviews = useMemo(
    () => reviews.filter((r) => r.status === 'pending'),
    [reviews]
  );
  const submittedReviews = useMemo(
    () => reviews.filter((r) => r.status === 'submitted'),
    [reviews]
  );

  // The three headline numbers (pure — see computeSubjectStats). Cancelled
  // appraisals count in none of them.
  const { needsAttention, inProgress, completed } = computeSubjectStats(
    appraisals,
    reviews
  );

  const isEmpty = !loading && appraisals.length === 0 && reviews.length === 0;
  const showError = !loading && error && appraisals.length === 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-7 px-6 py-8 md:px-10 lg:px-14">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="relative pb-2 text-2xl font-semibold text-gray-900">
              My appraisals
              <span className="absolute bottom-0 left-0 h-[3px] w-10 rounded-full bg-[#b20202]" />
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Your own performance reviews and any feedback others have asked
              you for.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden text-xs text-gray-400 sm:inline">
                Updated{' '}
                {lastUpdated.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            )}
            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={refreshing || loading}
              aria-label="Refresh"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PiArrowClockwise
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<PiWarningCircle className="h-5 w-5" />}
            iconClass="bg-red-50 text-[#b20202]"
            label="Needs your attention"
            value={needsAttention}
            delay={0.05}
          />
          <StatCard
            icon={<PiHourglassHigh className="h-5 w-5" />}
            iconClass="bg-blue-50 text-blue-600"
            label="In progress"
            value={inProgress}
            delay={0.12}
          />
          <StatCard
            icon={<PiCheckCircle className="h-5 w-5" />}
            iconClass="bg-green-50 text-green-600"
            label="Completed"
            value={completed}
            delay={0.19}
          />
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-7"
            >
              <section>
                <div className="mb-3 h-4 w-40 rounded bg-gray-100" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-36 animate-pulse rounded-2xl border border-gray-100 bg-gray-50"
                    />
                  ))}
                </div>
              </section>
              <section>
                <div className="mb-3 h-4 w-44 rounded bg-gray-100" />
                <div className="flex flex-col gap-2">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-xl border border-gray-100 bg-gray-50"
                    />
                  ))}
                </div>
              </section>
            </motion.div>
          ) : showError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <PiWarningCircle className="h-8 w-8 text-[#b20202]" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                Couldn&rsquo;t load your appraisals
              </p>
              <p className="mt-1 max-w-sm text-sm text-gray-400">{error}</p>
              <button
                type="button"
                onClick={() => load()}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9f0101]"
              >
                <PiArrowClockwise className="h-4 w-4" />
                Try again
              </button>
            </motion.div>
          ) : isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <PiWarningCircle className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">
                Nothing here yet
              </p>
              <p className="mt-1 max-w-sm text-sm text-gray-400">
                Your appraisals and feedback requests will appear here once
                your manager launches a cycle.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              variants={sectionVariants}
              className="flex flex-col gap-8"
            >
              <section>
                <SectionHeading
                  icon={<PiClipboardText className="h-4 w-4 text-[#b20202]" />}
                  label="My appraisals"
                  count={appraisals.length}
                />
                <div className="mt-3">
                  {sortedAppraisals.length === 0 ? (
                    <InlineEmpty
                      icon={<PiClipboardText className="h-6 w-6 text-gray-400" />}
                      text="No appraisal cycles have been launched for you yet."
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {sortedAppraisals.map((a, i) => (
                        <AppraisalSubjectCard
                          key={a._id}
                          appraisal={a}
                          index={i}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <SectionHeading
                  icon={<PiUserCircle className="h-4 w-4 text-[#b20202]" />}
                  label="Feedback requested from me"
                  count={reviews.length}
                />
                <div className="mt-3 flex flex-col gap-3">
                  {reviews.length === 0 ? (
                    <InlineEmpty
                      icon={<PiChatCircleText className="h-6 w-6 text-gray-400" />}
                      text="Nobody has asked you for feedback right now."
                    />
                  ) : (
                    <>
                      {pendingReviews.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {pendingReviews.map((r, i) => (
                            <ReviewRequestRow key={r._id} review={r} index={i} />
                          ))}
                        </div>
                      )}
                      {submittedReviews.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {pendingReviews.length > 0 && (
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                              Submitted
                            </p>
                          )}
                          {submittedReviews.map((r, i) => (
                            <ReviewRequestRow
                              key={r._id}
                              review={r}
                              index={pendingReviews.length + i}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
