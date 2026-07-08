'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';
import type { FormData } from './ApplyForm';
import { ID_TYPES, NIGERIAN_BANKS } from '../../data';
import { Section, Field, FileInput, Checkbox, inputCls } from './legal-ui';

export function LegalStep({
  form,
  update,
  errors,
}: {
  form: FormData;
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 mb-1">Legal & verification</h2>
        <p className="text-sm text-gray-500 mb-6">
          Required for compliance, payouts, and verification. Your data is encrypted and never shared.
        </p>
      </div>

      {/* Business registration */}
      <Section title="Business registration" icon={Icon.PiBuildingBold}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="CAC registration number" required error={errors.cacNumber} hint="RC, BN, or IT prefix">
            <input
              type="text"
              required
              maxLength={12}
              value={form.cacNumber || ''}
              onChange={(e) => update('cacNumber', e.target.value.toUpperCase())}
              placeholder="RC1234567"
              className={inputCls}
            />
          </Field>
          <Field label="Tax ID (TIN)" required error={errors.tin} hint="10-14 digits">
            <input
              type="text"
              required
              maxLength={14}
              value={form.tin || ''}
              onChange={(e) => update('tin', e.target.value.replace(/[^\d-]/g, ''))}
              placeholder="1234567890"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Upload CAC certificate" required error={errors.cacDoc} hint="PDF, JPG, or PNG — max 5MB">
          <FileInput accept=".pdf,.jpg,.jpeg,.png" onChange={(file) => update('cacDoc', file?.name || '')} />
        </Field>
      </Section>

      {/* Director KYC */}
      <Section title="Director / owner verification (KYC)" icon={Icon.PiIdentificationCardBold}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="BVN" required error={errors.bvn} hint="11 digits">
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={11}
              value={form.bvn || ''}
              onChange={(e) => update('bvn', e.target.value.replace(/\D/g, ''))}
              placeholder="12345678901"
              className={inputCls}
            />
          </Field>
          <Field label="ID type" required error={errors.idType}>
            <select required value={form.idType || ''} onChange={(e) => update('idType', e.target.value)} className={inputCls}>
              <option value="" disabled>Select ID type</option>
              {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="ID number" required error={errors.idNumber} hint="letters, numbers, hyphens">
          <input
            type="text"
            required
            maxLength={30}
            value={form.idNumber || ''}
            onChange={(e) => update('idNumber', e.target.value.replace(/[^A-Za-z0-9-]/g, ''))}
            placeholder="Your ID number"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Bank details */}
      <Section title="Payout account" icon={Icon.PiCreditCardBold}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Bank name" required error={errors.bankName}>
            <select required value={form.bankName || ''} onChange={(e) => update('bankName', e.target.value)} className={inputCls}>
              <option value="" disabled>Select bank</option>
              {NIGERIAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Account number" required error={errors.bankAccountNumber} hint="10 digits">
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={10}
              value={form.bankAccountNumber || ''}
              onChange={(e) => update('bankAccountNumber', e.target.value.replace(/\D/g, ''))}
              placeholder="0123456789"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Account name" required error={errors.bankAccountName} hint="as shown on bank statement">
          <input
            type="text"
            required
            maxLength={100}
            value={form.bankAccountName || ''}
            onChange={(e) => update('bankAccountName', e.target.value)}
            placeholder="Account holder name"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* NAFDAC (conditional) */}
      <Section title="NAFDAC registration" icon={Icon.PiShieldCheckBold} subtitle="Required only if you sell imported or regulated beverages">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Do you sell regulated beverages?" hint="imported spirits, wines, etc.">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update('nafdacRequired', true)}
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  form.nafdacRequired === true ? 'border-red-300 bg-red-50 text-red-700 ring-1 ring-red-200' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => update('nafdacRequired', false)}
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  form.nafdacRequired === false ? 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                No
              </button>
            </div>
          </Field>
          {form.nafdacRequired === true && (
            <Field label="NAFDAC registration number" required error={errors.nafdacNumber} hint="letters, numbers, hyphens">
              <input
                type="text"
                maxLength={20}
                value={form.nafdacNumber || ''}
                onChange={(e) => update('nafdacNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9\-\/]/g, ''))}
                placeholder="NAFDAC-REG-123"
                className={inputCls}
              />
            </Field>
          )}
        </div>
      </Section>

      {/* Agreements */}
      <Section title="Agreements" icon={Icon.PiScrollBold}>
        <div className="space-y-3">
          <Checkbox
            checked={form.ageConfirmed}
            onChange={(v) => update('ageConfirmed', v)}
            error={errors.ageConfirmed}
            label={<>I confirm that the business owner/director is <strong>21 years or older</strong> and authorised to sell alcoholic beverages under Nigerian law.</>}
          />
          <Checkbox
            checked={form.termsAccepted}
            onChange={(v) => update('termsAccepted', v)}
            error={errors.termsAccepted}
            label={<>I agree to the <a href="/terms" target="_blank" className="text-red-700 underline hover:text-red-800">Terms of Service</a>, <a href="/vendors/agreement" target="_blank" className="text-red-700 underline hover:text-red-800">Vendor Agreement</a>, and <a href="/privacy-policy" target="_blank" className="text-red-700 underline hover:text-red-800">Privacy Policy</a>.</>}
          />
          <Checkbox
            checked={form.dataConsent}
            onChange={(v) => update('dataConsent', v)}
            error={errors.dataConsent}
            label={<>I consent to DrinksHarbour processing my business and personal data for verification, compliance, and platform operations in accordance with the NDPR and Data Protection Act.</>}
          />
        </div>
      </Section>
    </div>
  );
}