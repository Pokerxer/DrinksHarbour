'use client';

import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { StepsProgress } from './StepsProgress';
import { BusinessStep } from './BusinessStep';
import { AddressStep } from './AddressStep';
import { ContactStep } from './ContactStep';
import { LegalStep } from './LegalStep';
import { PlanStep } from './PlanStep';
import { ReviewStep } from './ReviewStep';
import { SuccessScreen } from './SuccessScreen';

export interface FormData {
  businessName: string;
  slug: string;
  businessType: string;
  description: string;
  addressFormatted: string;
  addressLat: number | null;
  addressLon: number | null;
  city: string;
  state: string;
  postcode: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  // Legal & verification
  cacNumber: string;
  cacDoc: string;
  tin: string;
  bvn: string;
  idType: string;
  idNumber: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  nafdacRequired: boolean | null;
  nafdacNumber: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
  dataConsent: boolean;
  plan: string;
}

const INITIAL: FormData = {
  businessName: '',
  slug: '',
  businessType: '',
  description: '',
  addressFormatted: '',
  addressLat: null,
  addressLon: null,
  city: '',
  state: '',
  postcode: '',
  contactName: '',
  contactRole: '',
  email: '',
  phone: '',
  cacNumber: '',
  cacDoc: '',
  tin: '',
  bvn: '',
  idType: '',
  idNumber: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountName: '',
  nafdacRequired: null,
  nafdacNumber: '',
  ageConfirmed: false,
  termsAccepted: false,
  dataConsent: false,
  plan: 'free_trial',
};

const TOTAL_STEPS = 6;

export function ApplyForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function goToStep(target: number) {
    setStep(target);
    setErrors({});
    setSubmitError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function next() {
    const stepErrors = validateStep(step, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1);
    } else {
      handleSubmit();
    }
  }

  function back() {
    if (step > 0) goToStep(step - 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/tenants/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Something went wrong. Please try again.');
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return <SuccessScreen slug={form.slug} />;
  }

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10">
      <StepsProgress current={step} total={TOTAL_STEPS} />

      <style dangerouslySetInnerHTML={{
        __html: `@keyframes stepSlide{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}`
      }} />

      {/* Step content */}
      <div key={step} style={{ animation: 'stepSlide 0.35s ease-out' }}>
        {step === 0 && <BusinessStep form={form} update={update} errors={errors} />}
        {step === 1 && <AddressStep form={form} update={update} errors={errors} />}
        {step === 2 && <ContactStep form={form} update={update} errors={errors} />}
        {step === 3 && <LegalStep form={form} update={update} errors={errors} />}
        {step === 4 && <PlanStep form={form} update={update} errors={errors} />}
        {step === 5 && <ReviewStep form={form} goToStep={goToStep} />}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mt-5 flex items-center gap-2 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          <Icon.PiWarningCircle size={16} className="flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-50">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-0 disabled:cursor-default transition-all"
        >
          <Icon.PiArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-red-600 to-red-800 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-700 hover:to-red-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          >
            {submitting ? (
              <>
                <Icon.PiSpinnerGap size={16} className="animate-spin" /> Submitting...
              </>
            ) : isLast ? (
              <>
                <Icon.PiPaperPlaneTilt size={16} /> Submit Application
              </>
            ) : (
              <>
                Continue <Icon.PiArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Validation ──────────────────────────────────────────────────────────────────

function validateStep(step: number, form: FormData): Partial<Record<keyof FormData, string>> {
  const e: Partial<Record<keyof FormData, string>> = {};

  if (step === 0) {
    if (!form.businessName.trim()) e.businessName = 'Business name is required';
    if (!form.slug.trim()) e.slug = 'Store URL is required';
    if (!form.businessType) e.businessType = 'Please select a business type';
  }

  if (step === 1) {
    if (!form.addressFormatted.trim()) e.addressFormatted = 'Please search and select your business address';
    else if (!form.addressLat || !form.addressLon) e.addressFormatted = 'Please pin your location on the map';
  }

  if (step === 2) {
    if (!form.contactName.trim()) e.contactName = 'Full name is required';
    else if (form.contactName.trim().length < 2) e.contactName = 'Name must be at least 2 characters';
    if (!form.contactRole) e.contactRole = 'Please select your role';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    else if (!/^(\+?234|0)[7-9][01]\d{8}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Enter a valid Nigerian phone number (e.g. +234 801 234 5678)';
  }

  if (step === 3) {
    // Business registration
    if (!form.cacNumber.trim()) e.cacNumber = 'CAC registration number is required';
    else if (!/^(RC|BN|IT)\d{5,8}$/i.test(form.cacNumber)) e.cacNumber = 'Format: RC1234567 or BN1234567';
    if (!form.tin.trim()) e.tin = 'Tax ID (TIN) is required';
    else if (!/^\d{10}[-\d]*$/.test(form.tin)) e.tin = 'TIN must be 10-14 digits (hyphens allowed)';
    if (!form.cacDoc) e.cacDoc = 'Please upload your CAC certificate';

    // KYC
    if (!form.bvn.trim()) e.bvn = 'BVN is required';
    else if (!/^\d{11}$/.test(form.bvn)) e.bvn = 'BVN must be exactly 11 digits';
    if (!form.idType) e.idType = 'Please select an ID type';
    if (!form.idNumber.trim()) e.idNumber = 'ID number is required';
    else if (form.idNumber.length < 5) e.idNumber = 'ID number must be at least 5 characters';
    else if (!/^[A-Za-z0-9-]+$/.test(form.idNumber)) e.idNumber = 'ID number can only contain letters, numbers, and hyphens';

    // Bank
    if (!form.bankName) e.bankName = 'Please select your bank';
    if (!form.bankAccountNumber.trim()) e.bankAccountNumber = 'Account number is required';
    else if (!/^\d{10}$/.test(form.bankAccountNumber)) e.bankAccountNumber = 'Account number must be exactly 10 digits';
    if (!form.bankAccountName.trim()) e.bankAccountName = 'Account name is required';
    else if (form.bankAccountName.trim().length < 3) e.bankAccountName = 'Account name must be at least 3 characters';

    // NAFDAC
    if (form.nafdacRequired && !form.nafdacNumber.trim()) e.nafdacNumber = 'NAFDAC number is required for regulated beverages';
    else if (form.nafdacNumber && !/^[A-Za-z0-9\-\/]+$/.test(form.nafdacNumber)) e.nafdacNumber = 'NAFDAC number can only contain letters, numbers, hyphens, and slashes';

    // Agreements
    if (!form.ageConfirmed) e.ageConfirmed = 'You must confirm the owner is 21 or older';
    if (!form.termsAccepted) e.termsAccepted = 'You must accept the Terms and Vendor Agreement';
    if (!form.dataConsent) e.dataConsent = 'You must consent to data processing';
  }

  if (step === 4) {
    if (!form.plan) e.plan = 'Please select a plan';
  }

  return e;
}