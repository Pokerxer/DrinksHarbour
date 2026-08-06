'use client';

import { motion } from 'framer-motion';
import { Button, Text } from 'rizzui';
import { PiFloppyDisk, PiPlusBold, PiKeyboard } from 'react-icons/pi';

interface TemplateFormFooterProps {
  saving: boolean;
  blockedReason: string | null;
  onSave: () => void;
  onAddSection: () => void;
}

export default function TemplateFormFooter({
  saving,
  blockedReason,
  onSave,
  onAddSection,
}: TemplateFormFooterProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
      className="sticky bottom-0 z-20 -mx-6 border-t border-gray-100 bg-white/80 backdrop-blur-xl px-6 py-4 md:-mx-10 lg:-mx-12 md:px-10 lg:px-12"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onAddSection}
            disabled={saving}
            className="transition-colors"
          >
            <PiPlusBold className="me-1.5 h-4 w-4" />
            Add section
          </Button>

          {/* Keyboard shortcut hint */}
          <span className="hidden items-center gap-1 text-[10px] text-gray-400 sm:flex">
            <PiKeyboard className="h-3 w-3" />
            <span>
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-[9px] font-medium text-gray-500">
                ⌘S
              </kbd>{' '}
              to save
            </span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          {blockedReason ? (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <Text className="text-xs font-medium text-red-600">
                {blockedReason}
              </Text>
            </motion.div>
          ) : null}
          <Button
            onClick={onSave}
            disabled={saving || Boolean(blockedReason)}
            className="bg-[#b20202] shadow-md shadow-[#b20202]/20 hover:bg-[#9f0101] hover:shadow-lg transition-all duration-200"
          >
            {saving ? (
              <>
                <PiFloppyDisk className="me-1.5 h-4 w-4 animate-pulse" />
                Saving…
              </>
            ) : (
              <>
                <PiFloppyDisk className="me-1.5 h-4 w-4" />
                Save form
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
