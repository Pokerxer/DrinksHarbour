// @ts-nocheck
'use client';

import { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import {
  PiEye, PiStar, PiSparkle, PiCrown, PiCalendar,
  PiClock, PiCheckCircle, PiWarningCircle, PiPauseCircle,
  PiTrash, PiEyeSlash, PiArrowsClockwise, PiStorefront,
  PiShoppingCart, PiGlobe, PiArchive,
  PiCaretDown, PiCaretUp,
} from 'react-icons/pi';

// ── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  {
    value: 'active',
    label: 'Active',
    description: 'Live and visible to customers',
    icon: PiCheckCircle,
    activeBorder: 'border-green-400',
    activeBg: 'bg-green-50',
    activeText: 'text-green-700',
    activeIcon: 'text-green-600',
    dot: 'bg-green-500',
  },
  {
    value: 'draft',
    label: 'Draft',
    description: 'Work in progress, not visible',
    icon: PiPauseCircle,
    activeBorder: 'border-blue-400',
    activeBg: 'bg-blue-50',
    activeText: 'text-blue-700',
    activeIcon: 'text-blue-600',
    dot: 'bg-blue-400',
  },
  {
    value: 'pending',
    label: 'Pending',
    description: 'Awaiting review or approval',
    icon: PiClock,
    activeBorder: 'border-amber-400',
    activeBg: 'bg-amber-50',
    activeText: 'text-amber-700',
    activeIcon: 'text-amber-600',
    dot: 'bg-amber-400',
  },
  {
    value: 'hidden',
    label: 'Hidden',
    description: 'Manually hidden from store',
    icon: PiEyeSlash,
    activeBorder: 'border-gray-400',
    activeBg: 'bg-gray-50',
    activeText: 'text-gray-700',
    activeIcon: 'text-gray-500',
    dot: 'bg-gray-400',
  },
  {
    value: 'out_of_stock',
    label: 'Out of Stock',
    description: 'Temporarily unavailable',
    icon: PiWarningCircle,
    activeBorder: 'border-red-400',
    activeBg: 'bg-red-50',
    activeText: 'text-red-700',
    activeIcon: 'text-red-600',
    dot: 'bg-red-500',
  },
  {
    value: 'discontinued',
    label: 'Discontinued',
    description: 'No longer sold or stocked',
    icon: PiTrash,
    activeBorder: 'border-slate-400',
    activeBg: 'bg-slate-50',
    activeText: 'text-slate-700',
    activeIcon: 'text-slate-500',
    dot: 'bg-slate-500',
  },
  {
    value: 'archived',
    label: 'Archived',
    description: 'Removed from active listings',
    icon: PiArchive,
    activeBorder: 'border-slate-300',
    activeBg: 'bg-slate-50',
    activeText: 'text-slate-600',
    activeIcon: 'text-slate-400',
    dot: 'bg-slate-400',
  },
] as const;

// ── Shared primitives ─────────────────────────────────────────────────────────

function Section({
  title, desc, children, action,
}: {
  title: string; desc?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-xs font-bold text-gray-700">{title}</p>
          {desc && <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Custom toggle ─────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, label, description, icon, accent = '#111827',
}: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string;
  icon?: React.ReactNode; accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
        checked ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-white hover:bg-gray-50'
      }`}
    >
      {icon && (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          checked ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${checked ? 'text-gray-900' : 'text-gray-700'}`}>{label}</p>
        {description && <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      {/* Toggle pill */}
      <div className={`relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-gray-900' : 'bg-gray-200'
      }`}>
        <span className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`} />
      </div>
    </button>
  );
}

// ── Status card ───────────────────────────────────────────────────────────────

function StatusCard({
  option, selected, onClick,
}: {
  option: typeof STATUS_OPTIONS[number];
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
        selected
          ? `${option.activeBorder} ${option.activeBg}`
          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
        selected ? `${option.activeBg} border border-current/20` : 'bg-gray-100'
      }`}>
        <Icon className={`h-4.5 w-4.5 ${selected ? option.activeIcon : 'text-gray-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold leading-tight ${selected ? option.activeText : 'text-gray-700'}`}>
          {option.label}
        </p>
        <p className={`text-[10px] leading-tight mt-0.5 ${selected ? option.activeText + '/70' : 'text-gray-400'}`}>
          {option.description}
        </p>
      </div>
      {selected && (
        <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${option.dot}`} />
      )}
    </button>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────

function QuickAction({
  label, icon, onClick, variant = 'default', active = false,
}: {
  label: string; icon: React.ReactNode; onClick: () => void;
  variant?: 'default' | 'danger' | 'success'; active?: boolean;
}) {
  const cls =
    active && variant === 'success' ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' :
    active && variant === 'danger'  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' :
    active                          ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-700' :
    variant === 'danger'            ? 'border-red-200 text-red-600 hover:bg-red-50' :
    variant === 'success'           ? 'border-green-200 text-green-700 hover:bg-green-50' :
    'border-gray-200 text-gray-600 hover:bg-gray-50';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${cls}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubProductStatusVisibility() {
  const { watch, setValue, register, control } = useFormContext();

  const status              = watch('subProductData.status')              || 'draft';
  const isFeaturedByTenant  = watch('subProductData.isFeaturedByTenant')  ?? false;
  const isNewArrival        = watch('subProductData.isNewArrival')        ?? false;
  const isBestSeller        = watch('subProductData.isBestSeller')        ?? false;
  const isPublished         = watch('subProductData.isPublished')         ?? false;
  const visibleInPOS        = watch('subProductData.visibleInPOS')        ?? true;
  const visibleInOnlineStore = watch('subProductData.visibleInOnlineStore') ?? true;

  const [showSchedule, setShowSchedule] = useState(false);

  const currentOpt = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[1];
  const CurrentIcon = currentOpt.icon;

  function setStatus(newStatus: string) {
    setValue('subProductData.status', newStatus, { shouldValidate: true });
    if (newStatus === 'active' && status !== 'active') {
      setValue('subProductData.activatedAt', new Date().toISOString().slice(0, 16));
      setValue('subProductData.isPublished', true);
      setValue('subProductData.deactivatedAt', '');
    }
    if (newStatus === 'discontinued') {
      setValue('subProductData.discontinuedAt', new Date().toISOString().slice(0, 16));
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${currentOpt.activeBg} border ${currentOpt.activeBorder}`}>
          <CurrentIcon className={`h-5 w-5 ${currentOpt.activeIcon}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">Status & Visibility</p>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${currentOpt.activeBorder} ${currentOpt.activeBg} ${currentOpt.activeText}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${currentOpt.dot}`} />
              {currentOpt.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Control visibility, featured badges, and listing channels
          </p>
        </div>
      </div>

      {/* ── Status selector ── */}
      <Section
        title="Product Status"
        desc="Where this product is in its lifecycle"
        action={
          <button
            type="button"
            onClick={() => setShowSchedule((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <PiCalendar className="h-3.5 w-3.5" />
            Schedule
            {showSchedule ? <PiCaretUp className="h-3 w-3" /> : <PiCaretDown className="h-3 w-3" />}
          </button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUS_OPTIONS.map((opt) => (
            <StatusCard
              key={opt.value}
              option={opt}
              selected={status === opt.value}
              onClick={() => setStatus(opt.value)}
            />
          ))}
        </div>

        {/* Quick actions row */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <QuickAction
            label={status === 'active' ? 'Unpublish' : 'Publish'}
            icon={status === 'active'
              ? <PiEyeSlash className="h-3.5 w-3.5" />
              : <PiCheckCircle className="h-3.5 w-3.5" />
            }
            onClick={() => setStatus(status === 'active' ? 'hidden' : 'active')}
            variant={status === 'active' ? 'default' : 'success'}
            active={status === 'active'}
          />
          <QuickAction
            label={status === 'discontinued' ? 'Reactivate' : 'Discontinue'}
            icon={status === 'discontinued'
              ? <PiArrowsClockwise className="h-3.5 w-3.5" />
              : <PiTrash className="h-3.5 w-3.5" />
            }
            onClick={() => setStatus(status === 'discontinued' ? 'draft' : 'discontinued')}
            variant={status === 'discontinued' ? 'success' : 'danger'}
          />
          <QuickAction
            label={status === 'archived' ? 'Restore to Draft' : 'Archive'}
            icon={status === 'archived'
              ? <PiArrowsClockwise className="h-3.5 w-3.5" />
              : <PiArchive className="h-3.5 w-3.5" />
            }
            onClick={() => setStatus(status === 'archived' ? 'draft' : 'archived')}
            variant="default"
          />
        </div>
      </Section>

      {/* ── Scheduling (collapsible) ── */}
      {showSchedule && (
        <Section title="Scheduling" desc="Set automatic activation and deactivation dates">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { name: 'subProductData.activatedAt',    label: 'Activated At',    hint: 'When this product went live' },
              { name: 'subProductData.deactivatedAt',  label: 'Deactivate At',   hint: 'Auto-hide after this date' },
              { name: 'subProductData.discontinuedAt', label: 'Discontinued At', hint: 'When product was discontinued' },
            ].map(({ name, label, hint }) => (
              <div key={name}>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {label}
                </label>
                <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-gray-400 transition-colors">
                  <span className="ml-3 shrink-0 text-gray-400">
                    <PiCalendar className="h-4 w-4" />
                  </span>
                  <input
                    type="datetime-local"
                    {...register(name)}
                    className="flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-400">{hint}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Visibility channels ── */}
      <Section title="Visibility Channels" desc="Which sales channels show this product">
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            checked={visibleInPOS}
            onChange={(v) => setValue('subProductData.visibleInPOS', v)}
            label="Point of Sale"
            description="Show in the cashier POS terminal"
            icon={<PiShoppingCart className="h-4 w-4" />}
          />
          <Toggle
            checked={visibleInOnlineStore}
            onChange={(v) => setValue('subProductData.visibleInOnlineStore', v)}
            label="Online Store"
            description="Show in the web storefront"
            icon={<PiGlobe className="h-4 w-4" />}
          />
          <Toggle
            checked={isPublished}
            onChange={(v) => setValue('subProductData.isPublished', v)}
            label="Published on Platform"
            description="Visible on drinksharbour.com"
            icon={<PiStorefront className="h-4 w-4" />}
          />
        </div>
      </Section>

      {/* ── Featured badges ── */}
      <Section title="Featured Badges" desc="Promotional labels shown on the product listing">
        <div className="space-y-2">
          <Toggle
            checked={isFeaturedByTenant}
            onChange={(v) => setValue('subProductData.isFeaturedByTenant', v)}
            label="Featured Product"
            description="Highlighted in featured sections of your store"
            icon={<PiStar className="h-4 w-4" />}
          />
          <Toggle
            checked={isNewArrival}
            onChange={(v) => setValue('subProductData.isNewArrival', v)}
            label="New Arrival"
            description="Shown in the new arrivals section"
            icon={<PiSparkle className="h-4 w-4" />}
          />
          <Toggle
            checked={isBestSeller}
            onChange={(v) => setValue('subProductData.isBestSeller', v)}
            label="Best Seller"
            description="Marked as a top-selling product"
            icon={<PiCrown className="h-4 w-4" />}
          />
        </div>

        {/* Active badges preview */}
        {(isFeaturedByTenant || isNewArrival || isBestSeller) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <p className="w-full text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Active badges</p>
            {isFeaturedByTenant && (
              <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold text-purple-700">
                <PiStar className="h-3 w-3" /> Featured
              </span>
            )}
            {isNewArrival && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                <PiSparkle className="h-3 w-3" /> New Arrival
              </span>
            )}
            {isBestSeller && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                <PiCrown className="h-3 w-3" /> Best Seller
              </span>
            )}
          </div>
        )}
      </Section>

    </div>
  );
}
