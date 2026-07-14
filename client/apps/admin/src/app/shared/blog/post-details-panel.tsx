'use client';

// Post details panel — title, slug, category, excerpt, tags, featured.
// The title is the hero input; everything else supports it.

import { useState } from 'react';
import { Input, Textarea, Select, Switch } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiTagBold,
  PiXBold,
  PiLockSimpleBold,
  PiLockSimpleOpenBold,
  PiStarFill,
  PiStarBold,
  PiTextAaBold,
} from 'react-icons/pi';
import {
  CATEGORY_OPTIONS,
  categoryColor,
} from './blog-helpers';
import {
  CharCount,
  FieldLabel,
  SectionCard,
} from './editor-primitives';
import { RegenerateButton } from './ai-bar';

interface Props {
  post: any;
  slugTouched: boolean;
  setSlugTouched: (b: boolean) => void;
  set: (patch: any) => void;
  setTitle: (t: string) => void;
  fieldBusy: string;
  regenerateField: (f: string) => void;
}

export default function PostDetailsPanel({
  post,
  slugTouched,
  setSlugTouched,
  set,
  setTitle,
  fieldBusy,
  regenerateField,
}: Props) {
  const [tagInput, setTagInput] = useState('');

  const addTag = (raw: string) => {
    const parts = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    set({ tags: Array.from(new Set([...post.tags, ...parts])) });
    setTagInput('');
  };

  const removeTag = (tag: string) =>
    set({ tags: post.tags.filter((t: string) => t !== tag) });

  const titleLen = String(post.title || '').length;

  return (
    <SectionCard
      title="Post Details"
      description="The title is what readers see first — make it specific and compelling."
    >
      <div className="space-y-5">
        {/* ─── Hero title ─────────────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label
              htmlFor="blog-title"
              className="text-sm font-medium text-gray-700"
            >
              Title
            </label>
            <span className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {titleLen === 0
                  ? 'aim for 50–60 chars'
                  : `${titleLen} chars`}
              </span>
              <RegenerateButton
                field="title"
                busy={fieldBusy}
                onClick={regenerateField}
              />
            </span>
          </div>
          <div className="relative">
            <input
              id="blog-title"
              value={post.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Best Champagnes for Nigerian Weddings in 2025"
              className={cn(
                'w-full rounded-xl border bg-white px-4 py-3.5 text-2xl font-bold leading-tight text-gray-900 shadow-sm outline-none transition',
                'placeholder:text-base placeholder:font-normal placeholder:text-gray-400',
                'focus:border-violet-400 focus:ring-2 focus:ring-violet-200',
                titleLen > 60
                  ? 'border-amber-300'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            />
            <PiTextAaBold className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-200" />
          </div>
          {titleLen > 60 ? (
            <p className="mt-1.5 text-xs text-amber-600">
              Titles over 60 characters may get truncated in search results.
            </p>
          ) : null}
        </div>

        {/* ─── Slug + Category row ────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <FieldLabel hint="auto-syncs with title">
              URL slug
            </FieldLabel>
            <div className="relative">
              <Input
                value={post.slug}
                placeholder="auto-generated-from-title"
                onChange={(e) => {
                  setSlugTouched(true);
                  set({ slug: e.target.value });
                }}
                prefix={
                  <span className="font-mono text-xs text-gray-400">
                    /blog/
                  </span>
                }
                className="pe-9 font-mono text-sm"
                inputClassName="font-mono"
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                title={
                  slugTouched
                    ? 'Slug locked — you edited it manually'
                    : 'Slug auto-syncs with title'
                }
              >
                {slugTouched ? (
                  <PiLockSimpleBold className="h-4 w-4" />
                ) : (
                  <PiLockSimpleOpenBold className="h-4 w-4" />
                )}
              </span>
            </div>
            {post.slug ? (
              <p className="mt-1.5 truncate text-xs text-gray-400">
                Full URL:{' '}
                <span className="font-mono text-gray-500">
                  drinksharbour.com/blog/{post.slug}
                </span>
              </p>
            ) : null}
          </div>

          <div>
            <FieldLabel>Category</FieldLabel>
            <Select
              options={CATEGORY_OPTIONS}
              value={post.category}
              onChange={(v: any) => set({ category: v?.value ?? v })}
              getOptionValue={(o) => o.value}
              displayValue={(v: any) => v}
              suffix={
                post.category ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
                      categoryColor(post.category),
                    )}
                  >
                    {post.category}
                  </span>
                ) : null
              }
            />
          </div>
        </div>

        {/* ─── Excerpt ────────────────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel className="mb-0">Excerpt</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">120–160 chars</span>
              <CharCount value={post.excerpt} max={160} warn={145} />
              <RegenerateButton
                field="excerpt"
                busy={fieldBusy}
                onClick={regenerateField}
              />
            </div>
          </div>
          <Textarea
            rows={3}
            placeholder="A short summary shown in search results and social shares…"
            value={post.excerpt}
            onChange={(e) => set({ excerpt: e.target.value })}
            className="[&>textarea]:resize-y"
          />
        </div>

        {/* ─── Tags ───────────────────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel className="mb-0">
              <span className="flex items-center gap-1.5">
                <PiTagBold className="h-3.5 w-3.5 text-gray-500" /> Tags
              </span>
            </FieldLabel>
            <RegenerateButton
              field="tags"
              busy={fieldBusy}
              onClick={regenerateField}
            />
          </div>
          <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 transition focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-200">
            {post.tags.map((tag: string) => (
              <span
                key={tag}
                className="group/tag flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-violet-50 hover:text-violet-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-gray-400 transition hover:text-red-600"
                  aria-label={`Remove ${tag}`}
                >
                  <PiXBold className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagInput);
                }
                if (
                  e.key === 'Backspace' &&
                  !tagInput &&
                  post.tags.length
                ) {
                  removeTag(post.tags[post.tags.length - 1]);
                }
              }}
              onBlur={() => tagInput.trim() && addTag(tagInput)}
              placeholder={
                post.tags.length ? '' : 'Type a tag and press Enter…'
              }
              className="min-w-[140px] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Press Enter or comma to add · Backspace removes the last tag
          </p>
        </div>

        {/* ─── Featured ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Switch
              label="Featured post"
              checked={post.featured}
              onChange={(e) => set({ featured: e.target.checked })}
            />
            {post.featured ? (
              <PiStarFill className="h-4 w-4 text-amber-400" />
            ) : (
              <PiStarBold className="h-4 w-4 text-gray-300" />
            )}
          </div>
          <p className="text-xs text-gray-400">
            Featured posts appear prominently on the blog homepage.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}