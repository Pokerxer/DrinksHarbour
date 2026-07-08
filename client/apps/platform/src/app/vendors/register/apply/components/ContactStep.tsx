'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';
import type { FormData } from './ApplyForm';
import { Field, StepHeader, InfoNote, inputCls } from './step-ui';

const ROLES = ['Owner', 'Director', 'Manager', 'Partner', 'Staff'];

export function ContactStep({
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
      <StepHeader title="How can we reach you?" subtitle="We use this to verify your business and send approval updates." />

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full name" required error={errors.contactName}>
          <input
            type="text"
            required
            autoFocus
            value={form.contactName || ''}
            onChange={(e) => update('contactName', e.target.value)}
            placeholder="Your full name"
            className={inputCls}
          />
        </Field>

        <Field label="Your role" required error={errors.contactRole}>
          <select
            required
            value={form.contactRole || ''}
            onChange={(e) => update('contactRole', e.target.value)}
            className={inputCls}
          >
            <option value="" disabled>Select your role</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Email address" required error={errors.email}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon.PiEnvelope size={16} />
          </span>
          <input
            type="email"
            required
            value={form.email || ''}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@business.com"
            className={`${inputCls} pl-10`}
          />
        </div>
      </Field>

      <Field label="Phone number" required error={errors.phone} hint="WhatsApp preferred">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon.PiPhone size={16} />
          </span>
          <input
            type="tel"
            required
            value={form.phone || ''}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+234 801 234 5678"
            className={`${inputCls} pl-10`}
          />
        </div>
      </Field>

      <InfoNote icon={Icon.PiShieldCheckBold} color="blue">
        Your contact details are kept private and only used to verify your application.
        We never share them with third parties.
      </InfoNote>
    </div>
  );
}