'use client';

import Link from 'next/link';
import { Text } from 'rizzui';
import { motion, MotionConfig } from 'framer-motion';
import {
  PiArrowLeft,
  PiArrowRight,
  PiArrowsClockwise,
  PiCalendarDots,
  PiClipboardText,
  PiPlusBold,
  PiStar,
  PiUserFocus,
  PiSparkle,
  PiLightning,
} from 'react-icons/pi';
import { TEMPLATE_PRESETS, type TemplatePreset } from './template-presets';
import type { DraftSection, FeedbackKind } from '@/services/appraisal.service';

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PiClipboardText,
  PiArrowsClockwise,
  PiCalendarDots,
  PiUserFocus,
};

function PresetIcon({ name, className }: { name: string; className?: string }) {
  const Comp = ICON_MAP[name];
  return Comp ? (
    <Comp className={className} />
  ) : (
    <PiStar className={className} />
  );
}

// ---------------------------------------------------------------------------
// Audience badge
// ---------------------------------------------------------------------------
const AUDIENCE_META: Record<FeedbackKind, { label: string; cls: string }> = {
  self: { label: 'Self', cls: 'bg-blue-50 text-blue-600 ring-blue-100' },
  manager: { label: 'Manager', cls: 'bg-purple-50 text-purple-600 ring-purple-100' },
  peer: { label: 'Peer', cls: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
};

function AudienceBadge({ kind }: { kind: FeedbackKind }) {
  const m = AUDIENCE_META[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section count badges for preset cards
// ---------------------------------------------------------------------------
function SectionBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
      <span className="text-gray-900">{count}</span> sections
    </span>
  );
}

// ---------------------------------------------------------------------------
// Animated background shapes for the hero
// ---------------------------------------------------------------------------
function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Gradient orbs */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#b20202]/5 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -20, 0], y: [0, 15, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-purple-500/5 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-1/3 top-1/2 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl"
      />
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared animation variants
// ---------------------------------------------------------------------------
const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 26,
      delay: Math.min(i * 0.08, 0.4),
    },
  }),
};

const heroVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 200, damping: 20, delay: 0.1 },
  },
};

// ---------------------------------------------------------------------------
// Preset card
// ---------------------------------------------------------------------------
interface PresetCardProps {
  preset: TemplatePreset;
  index: number;
  onSelect: (sections: DraftSection[], name: string, description: string) => void;
}

function PresetCard({ preset, index, onSelect }: PresetCardProps) {
  return (
    <motion.button
      type="button"
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(preset.sections, preset.title, preset.description)}
      className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:border-[#b20202]/20 hover:shadow-lg hover:shadow-[#b20202]/5"
    >
      {/* Hover glow effect */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#b20202]/0 to-[#b20202]/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:from-[#b20202]/[0.02] group-hover:to-purple-500/[0.02]" />

      {/* Icon + title */}
      <div className="relative mb-3 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#b20202]/10 to-[#b20202]/5 text-[#b20202] transition-transform duration-200 group-hover:scale-105">
          <PresetIcon name={preset.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {preset.title}
          </p>
          <p className="truncate text-[11px] text-gray-400">
            {preset.subtitle}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="relative mb-4 line-clamp-2 text-xs leading-relaxed text-gray-500">
        {preset.description}
      </p>

      {/* Metadata row */}
      <div className="relative mt-auto flex flex-wrap items-center gap-1.5">
        {preset.audiences.map((a) => (
          <AudienceBadge key={a} kind={a} />
        ))}
        <SectionBadge count={preset.questionCount} />
      </div>

      {/* CTA */}
      <div className="relative mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#b20202] opacity-70 transition-opacity duration-200 group-hover:opacity-100">
        Use this template
        <motion.div
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          <PiArrowRight className="h-3.5 w-3.5" />
        </motion.div>
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Blank card
// ---------------------------------------------------------------------------
function BlankCard({
  index,
  onSelect,
}: {
  index: number;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-5 text-center shadow-sm transition-all duration-300 hover:border-[#b20202]/40 hover:bg-white hover:shadow-lg hover:shadow-[#b20202]/5"
    >
      {/* Hover glow */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#b20202]/0 to-purple-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:from-[#b20202]/[0.02] group-hover:to-purple-500/[0.02]" />

      <div className="relative mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-400 transition-all duration-200 group-hover:bg-[#b20202]/10 group-hover:text-[#b20202]">
        <PiPlusBold className="h-5 w-5" />
      </div>
      <p className="relative text-sm font-semibold text-gray-600 group-hover:text-gray-900">
        Start blank
      </p>
      <p className="relative mt-1 text-[11px] text-gray-400">
        Build your own form from scratch
      </p>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface TemplatePresetPickerProps {
  onPreset: (
    sections: DraftSection[],
    name: string,
    description: string
  ) => void;
}

export default function TemplatePresetPicker({
  onPreset,
}: TemplatePresetPickerProps) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-[calc(100vh-4rem)]">
        <HeroBackground />

        <div className="relative flex flex-col gap-8 px-6 py-8 md:px-10 lg:px-14">
          {/* Hero section */}
          <motion.div
            variants={heroVariants}
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            <Link
              href="/appraisals/templates"
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              <PiArrowLeft className="h-3.5 w-3.5" />
              All review forms
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#b20202] to-[#9f0101] text-white shadow-lg shadow-[#b20202]/20">
                <PiSparkle className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                New review form
              </h1>
            </div>

            <Text className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
              Choose a starting template based on industry best practices, or
              build from scratch. Every question is customisable after picking
              a starting point.
            </Text>

            {/* Quick stats */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <PiLightning className="h-3.5 w-3.5 text-amber-500" />
                4 industry-standard templates
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                6 question types
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-blue-400" />
                3 reviewer audiences
              </span>
            </div>
          </motion.div>

          {/* Preset grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATE_PRESETS.map((preset, i) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                index={i}
                onSelect={onPreset}
              />
            ))}
            <BlankCard
              index={TEMPLATE_PRESETS.length}
              onSelect={() => onPreset([], '', '')}
            />
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
