// @ts-nocheck
'use client';

/**
 * Reusable form primitives for the banner create/edit form:
 * collapsible section shell, Cloudinary-backed image upload, tag input and
 * the per-field AI sparkle button.
 */

import { useState, useRef } from 'react';
import { Input } from 'rizzui';
import {
  PiCaretDownBold,
  PiUploadSimpleBold,
  PiXBold,
  PiSpinnerBold,
  PiSparkleBold,
} from 'react-icons/pi';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { uploadService } from '@/services/upload.service';

export function CollapsibleSection({
  icon,
  iconBg,
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/60"
      >
        <div
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
            iconBg
          )}
        >
          {icon}
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className={cn('transition-transform', isOpen ? 'rotate-180' : '')}>
          <PiCaretDownBold className="h-4 w-4 text-gray-400" />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ImageUploadField({
  label,
  required,
  value,
  onChange,
  token,
  folder,
  aspectRatio = 'video',
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (url: string) => void;
  token: string;
  folder: string;
  aspectRatio?: 'video' | 'square' | 'wide';
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClasses = {
    video: 'aspect-[3/1]',
    square: 'aspect-square',
    wide: 'aspect-[16/9]',
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadService.uploadImage(file, token, folder);
      if (res.success && res.data?.url) {
        onChange(res.data.url);
        toast.success('Image uploaded');
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div className={cn('w-full', aspectClasses[aspectRatio])}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Preview"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-lg bg-red-500 p-2 text-white hover:bg-red-600"
            >
              <PiXBold className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full rounded-xl border-2 border-dashed transition-all disabled:opacity-60',
            'hover:border-blue-400 hover:bg-blue-50/30',
            aspectClasses[aspectRatio]
          )}
        >
          <div className="flex h-full flex-col items-center justify-center gap-2">
            {uploading ? (
              <>
                <PiSpinnerBold className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-sm text-gray-500">Uploading...</span>
              </>
            ) : (
              <>
                <PiUploadSimpleBold className="h-8 w-8 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">
                  Click to upload
                </span>
                <span className="text-xs text-gray-400">
                  PNG, JPG, WEBP, GIF (animated) up to 20MB
                </span>
              </>
            )}
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Input
        placeholder="Or paste image URL..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full"
        size="sm"
      />
    </div>
  );
}

export function TagsInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && input) {
      e.preventDefault();
      addTag(input);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-blue-900"
            >
              <PiXBold className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <Input
        placeholder="Type a tag and press Enter or comma..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        size="sm"
      />
    </div>
  );
}

/** Small inline sparkle button rendered as an Input suffix. */
export function FieldSparkle({
  busy,
  disabled,
  onClick,
  field,
}: {
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  field: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Rewrite this ${field} with AI`}
      aria-label={`Rewrite ${field} with AI`}
      className={cn(
        'flex items-center justify-center rounded-md p-1 transition-colors',
        disabled
          ? 'cursor-not-allowed text-gray-300'
          : 'text-purple-500 hover:bg-purple-50 hover:text-purple-700'
      )}
    >
      {busy ? (
        <PiSpinnerBold className="h-4 w-4 animate-spin" />
      ) : (
        <PiSparkleBold className="h-4 w-4" />
      )}
    </button>
  );
}
