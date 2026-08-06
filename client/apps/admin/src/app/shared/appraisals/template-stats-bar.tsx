'use client';

import { motion } from 'framer-motion';
import {
  PiClipboardText,
  PiLightning,
  PiStack,
  PiChartBar,
} from 'react-icons/pi';

interface StatsBarProps {
  total: number;
  sections: number;
  questions: number;
  defaults: number;
}

const STATS = [
  {
    key: 'total' as const,
    icon: PiClipboardText,
    label: 'Forms',
    color: 'text-[#b20202]',
    bg: 'bg-[#b20202]/10',
  },
  {
    key: 'sections' as const,
    icon: PiStack,
    label: 'Sections',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    key: 'questions' as const,
    icon: PiChartBar,
    label: 'Questions',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    key: 'defaults' as const,
    icon: PiLightning,
    label: 'Defaults',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
];

export default function StatsBar({
  total,
  sections,
  questions,
  defaults,
}: StatsBarProps) {
  const values = { total, sections, questions, defaults };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {STATS.map((s) => (
        <div
          key={s.key}
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg}`}
          >
            <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{values[s.key]}</p>
            <p className="text-[11px] font-medium text-gray-500">{s.label}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
