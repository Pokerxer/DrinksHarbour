'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PiChartBar,
  PiListChecks,
  PiListNumbers,
  PiTextAlignLeft,
  PiToggleLeft,
  PiTrophy,
} from 'react-icons/pi';
import type { QuestionType } from '@/services/appraisal.service';

// ---------------------------------------------------------------------------
// Type metadata
// ---------------------------------------------------------------------------
export interface TypeInfo {
  value: QuestionType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  ring: string;
}

export const QUESTION_TYPES: TypeInfo[] = [
  {
    value: 'rating',
    label: 'Numbered Rating',
    shortLabel: 'Rating',
    description: 'Numeric scale (1–5, 1–10) for quantified scoring',
    icon: PiChartBar,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
  },
  {
    value: 'likert',
    label: 'Likert Scale',
    shortLabel: 'Likert',
    description: 'Agree/Disagree or frequency scale with labels',
    icon: PiListNumbers,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    ring: 'ring-violet-200',
  },
  {
    value: 'text',
    label: 'Open Text',
    shortLabel: 'Text',
    description: 'Free-form written response',
    icon: PiTextAlignLeft,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
  },
  {
    value: 'choice',
    label: 'Choice',
    shortLabel: 'Choice',
    description: 'Single or multi-select from custom options',
    icon: PiListChecks,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
  },
  {
    value: 'yes_no',
    label: 'Yes / No',
    shortLabel: 'Yes/No',
    description: 'Binary choice with optional comment',
    icon: PiToggleLeft,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    ring: 'ring-rose-200',
  },
  {
    value: 'scale',
    label: 'Visual Scale',
    shortLabel: 'Scale',
    description: 'Slider-style with custom low/high labels',
    icon: PiTrophy,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    ring: 'ring-cyan-200',
  },
];

export function getTypeInfo(type: QuestionType): TypeInfo {
  return QUESTION_TYPES.find((t) => t.value === type) ?? QUESTION_TYPES[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface TemplateTypeSelectorProps {
  value: QuestionType;
  onChange: (type: QuestionType) => void;
  disabled?: boolean;
}

export default function TemplateTypeSelector({
  value,
  onChange,
  disabled,
}: TemplateTypeSelectorProps) {
  const [hovered, setHovered] = useState<QuestionType | null>(null);

  return (
    <div className="relative">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
        {QUESTION_TYPES.map((t) => {
          const active = value === t.value;
          return (
            <motion.button
              key={t.value}
              type="button"
              whileHover={{ scale: disabled ? 1 : 1.03 }}
              whileTap={{ scale: disabled ? 1 : 0.96 }}
              onClick={() => !disabled && onChange(t.value)}
              onMouseEnter={() => setHovered(t.value)}
              onMouseLeave={() => setHovered(null)}
              disabled={disabled}
              className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-semibold transition-all duration-150 sm:flex-row sm:px-3 sm:py-2 ${
                active
                  ? `${t.bg} ${t.color} ring-2 ${t.ring} shadow-sm`
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              } disabled:opacity-50`}
            >
              <t.icon className="h-4 w-4" />
              <span>{t.shortLabel}</span>

              {/* Active indicator */}
              {active ? (
                <motion.div
                  layoutId="type-indicator"
                  className={`absolute -bottom-0.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full ${t.bg.replace('50', '400')}`}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              ) : null}
            </motion.button>
          );
        })}
      </div>

      {/* Tooltip */}
      {hovered && !disabled ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-8 left-0 z-10 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-[10px] text-white shadow-lg"
        >
          {QUESTION_TYPES.find((t) => t.value === hovered)?.description}
        </motion.div>
      ) : null}
    </div>
  );
}
