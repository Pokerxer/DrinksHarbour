'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';
import type { FormData } from './ApplyForm';
import { PLAN_TIERS } from '../../data';

function formatNaira(n: number): string {
  if (n === 0) return 'Free';
  return `₦${n.toLocaleString('en-NG')}`;
}

export function ReviewStep({
  form,
  goToStep,
}: {
  form: FormData;
  goToStep: (step: number) => void;
}) {
  const selectedPlan = PLAN_TIERS.find((t) => t.key === form.plan);

  const sections = [
    {
      title: 'Business',
      step: 0,
      icon: Icon.PiStorefrontBold,
      rows: [
        { label: 'Business name', value: form.businessName },
        { label: 'Store URL', value: `drinksharbour.com/vendors/${form.slug}` },
        { label: 'Type', value: form.businessType },
      ],
    },
    {
      title: 'Address',
      step: 1,
      icon: Icon.PiMapPinBold,
      rows: [
        { label: 'Address', value: form.addressFormatted },
        { label: 'City', value: form.city },
        { label: 'State', value: form.state },
        ...(form.postcode ? [{ label: 'Postcode', value: form.postcode }] : []),
        ...(form.addressLat ? [{ label: 'Coordinates', value: `${form.addressLat.toFixed(4)}, ${form.addressLon?.toFixed(4)}` }] : []),
      ],
    },
    {
      title: 'Contact',
      step: 2,
      icon: Icon.PiUserBold,
      rows: [
        { label: 'Name', value: form.contactName },
        { label: 'Role', value: form.contactRole },
        { label: 'Email', value: form.email },
        { label: 'Phone', value: form.phone },
      ],
    },
    {
      title: 'Legal',
      step: 3,
      icon: Icon.PiIdentificationCardBold,
      rows: [
        { label: 'CAC number', value: form.cacNumber },
        { label: 'TIN', value: form.tin },
        { label: 'BVN', value: form.bvn ? `${form.bvn.slice(0, 4)}••••${form.bvn.slice(-3)}` : '—' },
        { label: 'ID', value: form.idType ? `${form.idType}: ${form.idNumber}` : '—' },
        { label: 'Bank', value: form.bankName ? `${form.bankName} — ${form.bankAccountNumber}` : '—' },
        ...(form.nafdacRequired && form.nafdacNumber ? [{ label: 'NAFDAC', value: form.nafdacNumber }] : []),
      ],
    },
    {
      title: 'Plan',
      step: 4,
      icon: Icon.PiTagBold,
      rows: [
        { label: 'Plan', value: selectedPlan?.label ?? '—' },
        { label: 'Price', value: `${formatNaira(selectedPlan?.priceMonthly ?? 0)}${(selectedPlan?.priceMonthly ?? 0) > 0 ? '/mo' : ''}` },
        { label: 'Commission', value: selectedPlan?.commissionRate ?? '—' },
      ],
    },
  ];

  const completedCount = sections.filter((s) => s.rows.some((r) => r.value && r.value !== '—')).length;
  const allComplete = completedCount === sections.length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-gray-900 mb-1">Review your application</h2>
        <p className="text-sm text-gray-500 mb-6">
          Make sure everything looks right. Click any section to edit.
        </p>
      </div>

      {/* Completion indicator */}
      <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${
        allComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}>
        {allComplete ? (
          <Icon.PiCheckCircleBold size={18} className="flex-shrink-0" />
        ) : (
          <Icon.PiInfoBold size={18} className="flex-shrink-0" />
        )}
        <p className="text-xs font-semibold">
          {allComplete
            ? 'All sections complete — ready to submit!'
            : `${completedCount} of ${sections.length} sections complete`}
        </p>
      </div>

      <div className="space-y-3">
        {sections.map(({ title, step, icon: Ic, rows }) => {
          const hasData = rows.some((r) => r.value && r.value !== '—');
          return (
            <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => goToStep(step)}
                className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    hasData ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-700'
                  }`}>
                    {hasData ? <Icon.PiCheckBold size={16} /> : <Ic size={16} />}
                  </span>
                  <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
                </div>
                <Icon.PiPencilSimple size={14} className="text-gray-300 group-hover:text-red-600 transition-colors" />
              </button>

              <dl className="px-4 pb-4 pt-0 space-y-1.5">
                {rows.map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-3 text-xs">
                    <dt className="text-gray-400">{label}</dt>
                    <dd className="font-semibold text-gray-700 text-right truncate max-w-[60%]">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      {form.description && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-2">About your business</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{form.description}</p>
        </div>
      )}

      {/* Agreements confirmation */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Icon.PiShieldCheckBold size={14} className="text-emerald-600" />
          <span>Agreements confirmed in the Legal step:</span>
        </div>
        <ul className="text-[11px] text-gray-500 ml-6 space-y-0.5">
          <li className="flex items-center gap-1.5">
            <Icon.PiCheckBold size={10} className="text-emerald-500" /> Age 21+ confirmed
          </li>
          <li className="flex items-center gap-1.5">
            <Icon.PiCheckBold size={10} className="text-emerald-500" /> Terms & Vendor Agreement accepted
          </li>
          <li className="flex items-center gap-1.5">
            <Icon.PiCheckBold size={10} className="text-emerald-500" /> NDPR data consent given
          </li>
        </ul>
      </div>

      {/* Final confirmation */}
      <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl hover:bg-gray-50 transition-colors">
        <input type="checkbox" required className="mt-1 w-4 h-4 rounded accent-red-600" />
        <span className="text-xs text-gray-600 leading-relaxed">
          I confirm that all information above is accurate and complete to the best of my knowledge.
          I understand that providing false information may result in application rejection or account
          suspension.
        </span>
      </label>
    </div>
  );
}