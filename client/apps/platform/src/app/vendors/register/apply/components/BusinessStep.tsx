'use client';

import React, { useRef, useState } from 'react';
import * as Icon from 'react-icons/pi';
import type { FormData } from './ApplyForm';
import { BUSINESS_TYPES } from '../../data';
import { Field, StepHeader, inputCls } from './step-ui';

export function BusinessStep({
  form,
  update,
  errors,
}: {
  form: FormData;
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  return (
    <div className="space-y-5">
      <StepHeader title="Tell us about your business" subtitle="This information becomes your public storefront profile." />

      <Field label="Business name" required error={errors.businessName}>
        <input
          type="text"
          required
          autoFocus
          value={form.businessName || ''}
          onChange={(e) => {
            update('businessName', e.target.value);
            if (!form.slug || form.slug === generateSlugFrom(form.businessName)) {
              update('slug', generateSlug(e.target.value));
            }
          }}
          placeholder="e.g. ABC Wines & Spirits"
          className={inputCls}
        />
      </Field>

      <Field
        label="Store URL"
        required
        hint={form.slug ? `drinksharbour.com/vendors/${form.slug}` : 'auto-generated'}
        error={errors.slug}
      >
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none font-mono">
            /vendors/
          </span>
          <input
            type="text"
            required
            value={form.slug || ''}
            onChange={(e) => update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="abc-wines"
            className={`${inputCls} pl-[70px] font-mono`}
          />
        </div>
      </Field>

      {/* Business type — visual cards */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-gray-700">
            Business type <span className="text-red-500">*</span>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {BUSINESS_TYPES.map(({ label, icon: Ic, description }) => {
            const selected = form.businessType === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => update('businessType', label)}
                className={`text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                  selected
                    ? 'border-red-300 bg-red-50 ring-1 ring-red-200 scale-[1.02]'
                    : 'border-gray-100 hover:border-red-200 hover:bg-gray-50'
                }`}
              >
                <Ic size={20} className={selected ? 'text-red-700' : 'text-gray-500'} />
                <p className={`font-bold text-xs mt-2 ${selected ? 'text-red-700' : 'text-gray-900'}`}>{label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>
              </button>
            );
          })}
        </div>
        {errors.businessType && (
          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <Icon.PiWarningCircle size={12} /> {errors.businessType}
          </p>
        )}
      </div>

      <Field label="What do you sell?" hint="optional — helps us verify your application">
        <textarea
          value={form.description || ''}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
          placeholder="Tell us about your products, how long you've been in business, and anything else we should know."
          className={inputCls}
        />
      </Field>
    </div>
  );
}

function generateSlug(name: string): string {
  return generateSlugFrom(name);
}

function generateSlugFrom(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}