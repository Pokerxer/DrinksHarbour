'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Button, Input, Text } from 'rizzui';
import {
  PiArrowClockwise,
  PiMagnifyingGlass,
  PiPlusBold,
  PiClipboardText,
} from 'react-icons/pi';
import {
  archiveTemplate,
  fetchTemplates,
  type AppraisalTemplateDoc,
  type QuestionType,
} from '@/services/appraisal.service';
import TemplateListCard from './template-list-card';
import ArchiveConfirmModal from './archive-confirm-modal';
import StatsBar from './template-stats-bar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function totalQuestions(templates: AppraisalTemplateDoc[]): number {
  return templates.reduce(
    (sum, t) =>
      sum +
      (t.sections || []).reduce(
        (ss, s) => ss + (s.questions || []).length,
        0
      ),
    0
  );
}

function totalSections(templates: AppraisalTemplateDoc[]): number {
  return templates.reduce(
    (sum, t) => sum + (t.sections || []).length,
    0
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TemplateList() {
  const [templates, setTemplates] = useState<AppraisalTemplateDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [archiving, setArchiving] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<AppraisalTemplateDoc | null>(null);

  // --- Fetch ---
  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const rows = await fetchTemplates();
      setTemplates(rows);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load review forms'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Silent refetch on window focus
  useEffect(() => {
    let busy = false;
    function onFocus() {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      fetchTemplates()
        .then((rows) => setTemplates(rows))
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    }
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, []);

  // --- Search filter ---
  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    );
  }, [templates, search]);

  // --- Stats ---
  const stats = useMemo(
    () => ({
      total: templates.length,
      questions: totalQuestions(templates),
      sections: totalSections(templates),
      defaults: templates.filter((t) => t.isDefault).length,
    }),
    [templates]
  );

  // --- Archive ---
  async function handleArchive() {
    if (!archiveConfirm) return;
    setArchiving(archiveConfirm._id);
    setArchiveConfirm(null);
    try {
      await archiveTemplate(archiveConfirm._id);
      setTemplates((prev) => prev.filter((x) => x._id !== archiveConfirm._id));
      toast.success(`"${archiveConfirm.name}" archived`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not archive this form'
      );
    } finally {
      setArchiving(null);
    }
  }

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 md:px-10 lg:px-14">
        {/* Stats skeleton */}
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 flex-1 animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 md:px-10 lg:px-14">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Review forms
            </h1>
            <Text className="mt-1 max-w-2xl text-sm text-gray-500">
              Questionnaires that cycles are launched against. Editing a form
              that a cycle has already launched creates a new version.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              title="Refresh"
              className="rounded-xl p-2.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              <motion.div
                animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={
                  refreshing
                    ? { duration: 1, repeat: Infinity, ease: 'linear' }
                    : { duration: 0 }
                }
              >
                <PiArrowClockwise className="h-4 w-4" />
              </motion.div>
            </button>
            <Link href="/appraisals/templates/new">
              <Button className="bg-[#b20202] shadow-md shadow-[#b20202]/20 hover:bg-[#9f0101] hover:shadow-lg transition-all duration-200">
                <PiPlusBold className="me-1.5 h-4 w-4" />
                New form
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        {stats.total > 0 ? (
          <StatsBar
            total={stats.total}
            sections={stats.sections}
            questions={stats.questions}
            defaults={stats.defaults}
          />
        ) : null}

        {/* Search */}
        {stats.total > 0 ? (
          <div className="relative max-w-md">
            <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms..."
              className="ps-9"
            />
          </div>
        ) : null}

        {/* Content */}
        <AnimatePresence mode="wait">
          {filtered.length === 0 && !loading ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <PiClipboardText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-700">
                {search ? 'No forms match your search' : 'No review forms yet'}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-gray-400">
                {search
                  ? `No forms found for "${search}". Try a different search term.`
                  : 'Create your first form to launch a cycle against it.'}
              </p>
              {!search ? (
                <Link href="/appraisals/templates/new" className="mt-5">
                  <Button className="bg-[#b20202]">
                    <PiPlusBold className="me-1.5 h-4 w-4" />
                    Create first form
                  </Button>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-4 text-sm font-medium text-[#b20202] hover:underline"
                >
                  Clear search
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((t, i) => (
                <TemplateListCard
                  key={t._id}
                  template={t}
                  index={i}
                  onArchive={setArchiveConfirm}
                  archiving={archiving}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Archive confirmation modal */}
      <ArchiveConfirmModal
        template={archiveConfirm}
        archiving={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveConfirm(null)}
      />
    </MotionConfig>
  );
}
