'use client';

// Collapsible AI generation bar — generate a full draft from a topic, or
// regenerate individual fields later from the post details panel.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Input, Select, Button, ActionIcon, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiSparkleBold, PiCaretDownBold } from 'react-icons/pi';
import { blogService } from '@/services/blog.service';
import { CATEGORY_OPTIONS } from './blog-helpers';

export default function AiBar({
  token,
  onApply,
  onBusy,
}: {
  token: string;
  onApply: (data: any) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return toast.error('Enter a topic first');
    setBusy(true);
    onBusy?.(true);
    try {
      const data: any = await blogService.generatePost(
        { topic, category: category || undefined },
        token,
      );
      onApply(data);
      toast.success('Draft generated — review before saving');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-violet-50/40"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
          <PiSparkleBold className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-gray-900">
            Generate with AI
          </Text>
          <p className="text-xs text-gray-500">
            Draft a full post from a single topic in seconds.
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600">
          Beta
        </span>
        <PiCaretDownBold
          className={cn(
            'h-4 w-4 text-gray-400 transition',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-violet-50 bg-violet-50/20 px-4 py-3.5">
          <Input
            label="Topic"
            placeholder="e.g. Best champagnes for Nigerian weddings"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            className="min-w-64 flex-1"
          />
          <Select
            label="Category (optional)"
            options={[{ label: 'Let AI choose', value: '' }, ...CATEGORY_OPTIONS]}
            value={category}
            onChange={(v: any) => setCategory(v?.value ?? v ?? '')}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) => (v ? v : 'Let AI choose')}
            className="w-52"
          />
          <Button
            onClick={generate}
            isLoading={busy}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <PiSparkleBold className="me-1.5 h-4 w-4" /> Generate full post
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function RegenerateButton({
  field,
  busy,
  onClick,
}: {
  field: string;
  busy: string;
  onClick: (field: string) => void;
}) {
  return (
    <ActionIcon
      size="sm"
      variant="text"
      className="text-violet-600 hover:bg-violet-50"
      title={`Regenerate ${field} with AI`}
      isLoading={busy === field}
      onClick={() => onClick(field)}
    >
      <PiSparkleBold className="h-4 w-4" />
    </ActionIcon>
  );
}