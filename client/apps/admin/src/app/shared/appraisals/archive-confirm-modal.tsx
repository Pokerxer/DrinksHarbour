'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { PiWarningCircle } from 'react-icons/pi';
import type { AppraisalTemplateDoc } from '@/services/appraisal.service';

interface ArchiveConfirmModalProps {
  template: AppraisalTemplateDoc | null;
  archiving: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ArchiveConfirmModal({
  template,
  archiving,
  onConfirm,
  onCancel,
}: ArchiveConfirmModalProps) {
  if (!template) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
              <PiWarningCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Archive "{template.name}"?
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                This form will be hidden from the list and no new cycles can
                be launched against it. Existing cycles are not affected.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={archiving === template._id}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {archiving === template._id ? 'Archiving…' : 'Archive form'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
