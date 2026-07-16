// @ts-nocheck
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Input, Select, Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiSparkleBold, PiCaretDownBold } from 'react-icons/pi';
import { generateSubCategory } from '@/services/subcategory.service';

export default function SubCategoryAiBar({
  token,
  onApply,
  parentOptions,
}: {
  token: string;
  onApply: (data: any) => void;
  parentOptions: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(true);
  const [topic, setTopic] = useState('');
  const [parent, setParent] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return toast.error('Enter a topic or subcategory name first');
    if (!parent) return toast.error('Select a parent category first');
    setBusy(true);
    try {
      const parentName = parentOptions.find((o) => o.value === parent)?.label || '';
      const { data } = await generateSubCategory(
        { topic, parentName },
        token,
      );
      onApply(data);
      toast.success('Subcategory draft generated — review before saving');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
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
          <Text className="text-sm font-semibold text-gray-900">Generate SubCategory with AI</Text>
          <p className="text-xs text-gray-500">
            Draft a full subcategory (description, SEO, taxonomy, flavours, pairings) from a single topic.
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600">
          Beta
        </span>
        <PiCaretDownBold className={cn('h-4 w-4 text-gray-400 transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-violet-50 bg-violet-50/20 px-4 py-3.5">
          <Select
            label="Parent category *"
            options={parentOptions}
            value={parent}
            onChange={(v: any) => setParent(v?.value ?? v ?? '')}
            getOptionValue={(o) => o.value}
            displayValue={(v: any) =>
              v ? parentOptions.find((o) => o.value === v)?.label ?? '' : 'Select parent'
            }
            className="min-w-52 flex-1"
          />
          <Input
            label="Topic / SubCategory name"
            placeholder="e.g. Single Malt"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            className="min-w-64 flex-1"
          />
          <Button
            onClick={generate}
            isLoading={busy}
            disabled={!parent}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <PiSparkleBold className="me-1.5 h-4 w-4" /> Generate subcategory
          </Button>
        </div>
      ) : null}
    </section>
  );
}