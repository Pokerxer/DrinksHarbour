// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiHandshake, PiStorefront, PiMagnifyingGlass, PiX,
  PiPlus, PiCheck, PiSpinner, PiCaretDown, PiCaretUp,
  PiCurrencyNgn, PiPackage, PiTruck, PiTimer,
  PiPhone, PiEnvelope, PiGlobe, PiMapPin,
  PiStar, PiStarFill, PiWarningCircle, PiTrendUp, PiTrendDown,
  PiNote, PiBuildings, PiPencil, PiArrowRight, PiTag,
  PiListBullets, PiArrowSquareOut,
} from 'react-icons/pi';
import { vendorService, type Vendor } from '@/services/vendor.service';
import { vendorPricelistService } from '@/services/vendorPricelist.service';
import VendorSearch from './VendorSearch';

// ── Shared primitives ─────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-400">
      {children}{required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

function Field({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1 ${className}`}>{children}</div>;
}

function TextInput({ icon, ...props }: { icon?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-gray-400 transition-colors">
      {icon && <span className="ml-3 shrink-0 text-gray-400">{icon}</span>}
      <input
        {...props}
        className="flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none placeholder-gray-300"
      />
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-gray-400 mt-0.5">{children}</p>;
}

function Section({ title, desc, children, action }: {
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

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  prepaid: 'Prepaid', net_7: 'Net 7', net_14: 'Net 14',
  net_30: 'Net 30', net_60: 'Net 60',
};

// ── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const labels = ['', 'Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];
  const display = hovered || value;
  return (
    <div>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110 p-0.5"
          >
            {star <= display
              ? <PiStarFill className="h-5 w-5 text-amber-400" />
              : <PiStar    className="h-5 w-5 text-gray-200" />
            }
          </button>
        ))}
        <span className={`ml-2 text-xs font-semibold ${display > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
          {display > 0 ? labels[display] : 'Not rated'}
        </span>
      </div>
    </div>
  );
}

// ── Quick-pick chips ──────────────────────────────────────────────────────────

function Chips({ options, value, onSelect, color = 'gray' }: {
  options: number[]; value: number; onSelect: (v: number) => void; color?: string;
}) {
  const activeCls =
    color === 'blue'   ? 'bg-blue-600 text-white'   :
    color === 'purple' ? 'bg-purple-600 text-white'  :
    'bg-gray-800 text-white';

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect(v)}
          className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
            Number(value) === v ? activeCls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ── Cost breakdown card ───────────────────────────────────────────────────────

function CostBreakdown({
  supplierPrice, shippingCost, costPrice, sellingPrice, symbol,
}: {
  supplierPrice: number; shippingCost: number;
  costPrice: number; sellingPrice: number; symbol: string;
}) {
  const landed    = supplierPrice + shippingCost;
  const hasData   = supplierPrice > 0 || costPrice > 0 || sellingPrice > 0;
  if (!hasData) return null;

  const costOverLanded   = landed > 0 ? ((costPrice - landed) / landed) * 100 : null;
  const grossMargin      = sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : null;
  const totalMarkup      = sellingPrice > 0 && supplierPrice > 0
    ? ((sellingPrice - supplierPrice) / supplierPrice) * 100 : null;

  function Row({ label, value, sub, highlight }: {
    label: string; value: string; sub?: string; highlight?: boolean;
  }) {
    return (
      <div className={`flex items-center justify-between py-2 ${highlight ? 'font-bold' : ''}`}>
        <span className={`text-xs ${highlight ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
        <div className="text-right">
          <span className={`text-sm tabular-nums ${highlight ? 'text-gray-900' : 'text-gray-800'}`}>{value}</span>
          {sub && <p className="text-[9px] text-gray-400 mt-0">{sub}</p>}
        </div>
      </div>
    );
  }

  function Pct({ value, invert = false }: { value: number | null; invert?: boolean }) {
    if (value === null) return null;
    const pos = invert ? value < 0 : value >= 0;
    return (
      <span className={`ml-2 rounded-full px-2 py-0.5 text-[9px] font-bold ${
        pos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}>
        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-xs font-bold text-gray-700">Cost Breakdown</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Full margin chain from supplier to customer</p>
      </div>
      <div className="px-4 divide-y divide-gray-50">
        {supplierPrice > 0 && (
          <Row
            label="Supplier price"
            value={`${symbol}${supplierPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
          />
        )}
        {shippingCost > 0 && (
          <Row
            label="+ Est. shipping"
            value={`${symbol}${shippingCost.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
          />
        )}
        {shippingCost > 0 && supplierPrice > 0 && (
          <Row
            label="= Landed cost"
            value={`${symbol}${landed.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
            highlight
          />
        )}
        {costPrice > 0 && (
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-gray-500">Your cost price</span>
            <div className="flex items-center">
              <span className="text-sm tabular-nums text-gray-800">
                {symbol}{costPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
              <Pct value={costOverLanded} />
            </div>
          </div>
        )}
        {sellingPrice > 0 && (
          <div className="flex items-center justify-between py-2 border-t-2 border-gray-100">
            <span className="text-xs font-bold text-gray-900">Selling price</span>
            <div className="flex items-center">
              <span className="text-sm font-bold tabular-nums text-gray-900">
                {symbol}{sellingPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
              <Pct value={grossMargin} />
            </div>
          </div>
        )}
      </div>
      {(grossMargin !== null || totalMarkup !== null) && (
        <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-2.5">
          {grossMargin !== null && (
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Gross Margin</p>
              <p className={`text-sm font-black tabular-nums ${grossMargin >= 20 ? 'text-green-600' : grossMargin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                {grossMargin.toFixed(1)}%
              </p>
            </div>
          )}
          {grossMargin !== null && totalMarkup !== null && (
            <div className="h-8 w-px bg-gray-200" />
          )}
          {totalMarkup !== null && (
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Total Markup</p>
              <p className={`text-sm font-black tabular-nums ${totalMarkup >= 30 ? 'text-green-600' : totalMarkup >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                +{totalMarkup.toFixed(1)}%
              </p>
            </div>
          )}
          {costPrice > 0 && supplierPrice > 0 && costPrice < supplierPrice && (
            <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5">
              <PiWarningCircle className="h-3.5 w-3.5 text-red-500" />
              <p className="text-[10px] font-semibold text-red-600">Cost below supplier price</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vendor pricelist panel ────────────────────────────────────────────────────

function VendorPricelists({
  subProductId, vendorId, token, currencySymbol,
  onUsePrice,
}: {
  subProductId: string; vendorId: string; token: string;
  currencySymbol: string; onUsePrice: (price: number) => void;
}) {
  const [entries, setEntries]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);

  useEffect(() => {
    if (!subProductId || !token) return;
    setLoading(true);
    vendorPricelistService.getVendorPricesForProduct(subProductId, token)
      .then((res) => {
        const list = (res.data || []).filter((e: any) =>
          !vendorId || !e.vendor?._id || e.vendor._id === vendorId
        );
        setEntries(list);
        if (list.length > 0) setOpen(true);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [subProductId, vendorId, token]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
        <PiSpinner className="h-3.5 w-3.5 animate-spin" /> Checking pricelists…
      </div>
    );
  }

  if (!entries.length) return null;

  return (
    <div className="rounded-2xl border border-indigo-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-indigo-50 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <PiListBullets className="h-4 w-4 text-indigo-500" />
          <p className="text-xs font-bold text-indigo-800">
            Pricelist entries ({entries.length})
          </p>
          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
            From vendor contracts
          </span>
        </div>
        {open
          ? <PiCaretUp className="h-3.5 w-3.5 text-indigo-400" />
          : <PiCaretDown className="h-3.5 w-3.5 text-indigo-400" />
        }
      </button>

      {open && (
        <div className="divide-y divide-indigo-50">
          {entries.map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{e.pricelistName}</p>
                <div className="flex flex-wrap gap-x-3 mt-0.5">
                  <span className="text-[10px] text-gray-400">
                    {e.vendor?.name || 'Unknown vendor'}
                  </span>
                  {e.leadTimeDays > 0 && (
                    <span className="text-[10px] text-gray-400">{e.leadTimeDays}d lead time</span>
                  )}
                  {e.discountPercent > 0 && (
                    <span className="text-[10px] text-indigo-500">-{e.discountPercent}% disc.</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold tabular-nums text-gray-900">
                  {currencySymbol}{Number(e.unitPrice).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
                <button
                  type="button"
                  onClick={() => onUsePrice(e.unitPrice)}
                  className="flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  Use price
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vendor search dropdown ────────────────────────────────────────────────────

// ── Create vendor inline panel ────────────────────────────────────────────────

const PT_OPTIONS = [
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'net_7',   label: 'Net 7 days' },
  { value: 'net_14',  label: 'Net 14 days' },
  { value: 'net_30',  label: 'Net 30 days (default)' },
  { value: 'net_60',  label: 'Net 60 days' },
];

function CreateVendorPanel({
  initialName, token, onCreated, onCancel,
}: {
  initialName: string; token: string;
  onCreated: (vendor: Vendor) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initialName,
    email: '', phone: '', website: '', taxId: '', notes: '',
    paymentTerms: 'net_30',
    contactName: '', contactEmail: '', contactPhone: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  async function handleCreate() {
    if (!form.name.trim()) return toast.error('Vendor name is required');
    setLoading(true);
    try {
      const vendor = await vendorService.create({
        name: form.name.trim(),
        email: form.email || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        taxId: form.taxId || undefined,
        notes: form.notes || undefined,
        paymentTerms: form.paymentTerms as any,
        contactPerson: (form.contactName || form.contactEmail || form.contactPhone)
          ? { name: form.contactName, email: form.contactEmail, phone: form.contactPhone }
          : undefined,
      }, token);
      toast.success(`Vendor "${vendor.name}" created`);
      onCreated(vendor);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create vendor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">Create New Vendor</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <PiX className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <Label required>Vendor Name</Label>
          <TextInput
            icon={<PiStorefront className="h-4 w-4" />}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. ABC Distributors Ltd"
            autoFocus
          />
        </Field>

        <Field>
          <Label>Email</Label>
          <TextInput
            icon={<PiEnvelope className="h-4 w-4" />}
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="vendor@example.com"
          />
        </Field>

        <Field>
          <Label>Phone</Label>
          <TextInput
            icon={<PiPhone className="h-4 w-4" />}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+234…"
          />
        </Field>

        <Field>
          <Label>Website</Label>
          <TextInput
            icon={<PiGlobe className="h-4 w-4" />}
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://…"
          />
        </Field>

        <Field>
          <Label>Payment Terms</Label>
          <select
            value={form.paymentTerms}
            onChange={(e) => set('paymentTerms', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-400"
          >
            {PT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        {/* Contact person */}
        <div className="sm:col-span-2 rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Contact Person</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <TextInput value={form.contactName}  onChange={(e) => set('contactName',  e.target.value)} placeholder="Full name"    />
            <TextInput value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="Email" type="email" />
            <TextInput value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="Phone"         />
          </div>
        </div>

        <Field className="sm:col-span-2">
          <Label>Internal Notes</Label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Payment instructions, discounts, SLA…"
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 placeholder-gray-300"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading || !form.name.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {loading ? <PiSpinner className="h-4 w-4 animate-spin" /> : <PiPlus className="h-4 w-4" />}
          {loading ? 'Creating…' : 'Create Vendor'}
        </button>
      </div>
    </div>
  );
}

// ── Selected vendor card ──────────────────────────────────────────────────────

function SelectedVendorCard({ vendor, onClear, onEdit }: {
  vendor: Vendor; onClear: () => void; onEdit: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-base">
          {vendor.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-indigo-900">{vendor.name}</p>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-700">
              <PiCheck className="h-2.5 w-2.5" /> Selected
            </span>
            {vendor.paymentTerms && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-600">
                {PAYMENT_TERMS_LABELS[vendor.paymentTerms] ?? vendor.paymentTerms}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {vendor.email && (
              <a href={`mailto:${vendor.email}`} className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline">
                <PiEnvelope className="h-3 w-3" /> {vendor.email}
              </a>
            )}
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline">
                <PiPhone className="h-3 w-3" /> {vendor.phone}
              </a>
            )}
            {vendor.website && (
              <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline">
                <PiGlobe className="h-3 w-3" />
                <span className="max-w-[140px] truncate">{vendor.website.replace(/^https?:\/\//, '')}</span>
                <PiArrowSquareOut className="h-2.5 w-2.5 opacity-60" />
              </a>
            )}
          </div>

          {vendor.contactPerson?.name && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[10px] text-indigo-700">
              <PiBuildings className="h-3.5 w-3.5 shrink-0" />
              <strong>{vendor.contactPerson.name}</strong>
              {vendor.contactPerson.phone && <span className="text-indigo-500">· {vendor.contactPerson.phone}</span>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-indigo-200 bg-white p-1.5 text-indigo-600 hover:bg-indigo-100 transition-colors"
            title="Change vendor"
          >
            <PiPencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-red-200 bg-white p-1.5 text-red-500 hover:bg-red-50 transition-colors"
            title="Remove vendor"
          >
            <PiX className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubProductVendor() {
  const { watch, setValue, control, register } = useFormContext();
  const { data: session } = useSession();
  const token = session?.user?.token || '';

  const vendorId         = watch('subProductData.vendor')             || '';
  const subProductId     = watch('subProductData._id') || watch('subProductData.id') || '';
  const supplierPrice    = Number(watch('subProductData.supplierPrice'))    || 0;
  const shippingCost     = Number(watch('subProductData.estimatedShippingCost')) || 0;
  const costPrice        = Number(watch('subProductData.costPrice'))         || 0;
  const baseSellingPrice = Number(watch('subProductData.baseSellingPrice'))  || 0;
  const currency         = watch('subProductData.currency')            || 'NGN';

  const currencySymbol = { USD: '$', EUR: '€', GBP: '£', ZAR: 'R', KES: 'KSh', GHS: '₵' }[currency] ?? '₦';

  // Vendor resolution
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [loadingVendor,  setLoadingVendor]  = useState(false);
  const [showSearch,     setShowSearch]     = useState(false);
  const [showCreate,     setShowCreate]     = useState(false);
  const [createInitial,  setCreateInitial]  = useState('');
  const [showContacts,   setShowContacts]   = useState(false);

  // Resolve vendor from ID when editing
  useEffect(() => {
    if (!vendorId || !token) return;
    if (/^[a-f\d]{24}$/i.test(vendorId) && (!selectedVendor || selectedVendor._id !== vendorId)) {
      setLoadingVendor(true);
      vendorService.getById(vendorId, token)
        .then(setSelectedVendor)
        .catch(() => setSelectedVendor(null))
        .finally(() => setLoadingVendor(false));
    }
  }, [vendorId, token]);

  function handleSelectVendor(vendor: Vendor) {
    setSelectedVendor(vendor);
    setValue('subProductData.vendor', vendor._id);
    // Auto-populate contact overrides
    const cp = vendor.contactPerson;
    if (cp?.name)  setValue('subProductData.vendorContactName', cp.name);
    if (cp?.phone || vendor.phone) setValue('subProductData.vendorPhone', cp?.phone || vendor.phone || '');
    if (cp?.email || vendor.email) setValue('subProductData.vendorEmail', cp?.email || vendor.email || '');
    if (vendor.website) setValue('subProductData.vendorWebsite', vendor.website);
    setShowSearch(false);
    setShowCreate(false);
  }

  function handleClearVendor() {
    setSelectedVendor(null);
    setValue('subProductData.vendor', '');
    setValue('subProductData.supplierSKU', '');
    setValue('subProductData.supplierPrice', 0);
    setValue('subProductData.leadTimeDays', 0);
    setValue('subProductData.minimumOrderQuantity', 0);
    setValue('subProductData.estimatedShippingCost', 0);
    setValue('subProductData.supplierRating', 0);
    setValue('subProductData.vendorContactName', '');
    setValue('subProductData.vendorPhone', '');
    setValue('subProductData.vendorEmail', '');
    setValue('subProductData.vendorWebsite', '');
    setValue('subProductData.vendorAddress', '');
    setValue('subProductData.vendorNotes', '');
  }

  function openCreate(query = '') {
    setCreateInitial(query);
    setShowCreate(true);
    setShowSearch(false);
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
          <PiHandshake className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Vendor & Sourcing</p>
          <p className="text-[11px] text-gray-400">Link a supplier and configure purchase terms for this product</p>
        </div>
      </div>

      {/* ── Vendor selector ── */}
      <Section title="Supplier / Vendor" desc="Link this product to a vendor in your vendor directory">

        {loadingVendor ? (
          <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
            <PiSpinner className="h-4 w-4 animate-spin" /> Loading vendor…
          </div>
        ) : selectedVendor ? (
          <>
            <SelectedVendorCard vendor={selectedVendor} onClear={handleClearVendor} onEdit={() => setShowSearch(true)} />
            {/* Pricelist entries for this product from selected vendor */}
            {subProductId && (
              <div className="mt-3">
                <VendorPricelists
                  subProductId={subProductId}
                  vendorId={vendorId}
                  token={token}
                  currencySymbol={currencySymbol}
                  onUsePrice={(price) => setValue('subProductData.supplierPrice', price)}
                />
              </div>
            )}
          </>
        ) : vendorId && !loadingVendor ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <PiWarningCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800 truncate">Vendor ID: {vendorId}</p>
              <p className="text-[10px] text-amber-600">Vendor not found in directory — re-assign below</p>
            </div>
            <button type="button" onClick={() => setShowSearch(true)}
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">
              Re-assign
            </button>
          </div>
        ) : !showSearch && !showCreate ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
              <PiMagnifyingGlass className="h-4 w-4" /> Search vendors…
            </button>
            <button type="button" onClick={() => openCreate()}
              className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
              <PiPlus className="h-4 w-4" /> Create new vendor
            </button>
          </div>
        ) : null}

        {showSearch && !showCreate && (
          <div className="mt-3">
            <VendorSearch
              token={token}
              selectedId={vendorId}
              onSelect={handleSelectVendor}
              onCreateNew={openCreate}
              onCancel={() => setShowSearch(false)}
            />
          </div>
        )}

        {showCreate && (
          <div className="mt-3">
            <CreateVendorPanel
              initialName={createInitial}
              token={token}
              onCreated={handleSelectVendor}
              onCancel={() => { setShowCreate(false); setShowSearch(false); }}
            />
          </div>
        )}
      </Section>

      {/* ── Cost breakdown ── */}
      <CostBreakdown
        supplierPrice={supplierPrice}
        shippingCost={shippingCost}
        costPrice={costPrice}
        sellingPrice={baseSellingPrice}
        symbol={currencySymbol}
      />

      {/* ── Sourcing details ── */}
      <Section title="Sourcing Details" desc="Purchase terms and logistics for this product">
        <div className="grid gap-4 sm:grid-cols-2">

          <Field>
            <Label>Supplier SKU</Label>
            <TextInput
              icon={<PiTag className="h-4 w-4" />}
              placeholder="Vendor's product code"
              {...register('subProductData.supplierSKU')}
            />
            <Hint>The vendor's own code for this item</Hint>
          </Field>

          <Field>
            <Label>Supplier Price ({currencySymbol})</Label>
            <TextInput
              icon={<PiCurrencyNgn className="h-4 w-4" />}
              type="number" step="0.01" min="0"
              placeholder="0.00"
              {...register('subProductData.supplierPrice', { valueAsNumber: true })}
            />
            <Hint>What you pay the vendor per unit</Hint>
          </Field>

          <Field>
            <Label>Lead Time (days)</Label>
            <TextInput
              icon={<PiTimer className="h-4 w-4" />}
              type="number" min="0" placeholder="0"
              {...register('subProductData.leadTimeDays', { valueAsNumber: true })}
            />
            <Controller
              name="subProductData.leadTimeDays"
              control={control}
              render={({ field }) => (
                <Chips options={[1, 3, 5, 7, 14, 21, 30]} value={field.value} onSelect={field.onChange} color="blue" />
              )}
            />
          </Field>

          <Field>
            <Label>Min. Order Qty (MOQ)</Label>
            <TextInput
              icon={<PiPackage className="h-4 w-4" />}
              type="number" min="0" placeholder="0"
              {...register('subProductData.minimumOrderQuantity', { valueAsNumber: true })}
            />
            <Controller
              name="subProductData.minimumOrderQuantity"
              control={control}
              render={({ field }) => (
                <Chips options={[6, 12, 24, 50, 100]} value={field.value} onSelect={field.onChange} color="purple" />
              )}
            />
          </Field>

          <Field>
            <Label>Est. Shipping Cost ({currencySymbol})</Label>
            <TextInput
              icon={<PiTruck className="h-4 w-4" />}
              type="number" step="0.01" min="0" placeholder="0.00"
              {...register('subProductData.estimatedShippingCost', { valueAsNumber: true })}
            />
            <Hint>Per-unit shipping from vendor to you</Hint>
          </Field>

          <Field>
            <Label>Supplier Rating</Label>
            <Controller
              name="subProductData.supplierRating"
              control={control}
              render={({ field }) => (
                <div className="pt-1">
                  <StarRating value={field.value ?? 0} onChange={field.onChange} />
                </div>
              )}
            />
          </Field>
        </div>
      </Section>

      {/* ── Vendor notes ── */}
      <Section title="Notes">
        <textarea
          rows={3}
          placeholder="Payment arrangements, discount agreements, lead time exceptions…"
          {...register('subProductData.vendorNotes')}
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 placeholder-gray-300"
        />
      </Section>

      {/* ── Contact overrides (collapsible) ── */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowContacts((v) => !v)}
          className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left border-b border-gray-100"
        >
          <div>
            <p className="text-xs font-bold text-gray-700">Contact Overrides</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Product-specific contact info that overrides the vendor's directory entry
            </p>
          </div>
          {showContacts
            ? <PiCaretUp   className="h-4 w-4 shrink-0 text-gray-400" />
            : <PiCaretDown className="h-4 w-4 shrink-0 text-gray-400" />
          }
        </button>

        {showContacts && (
          <div className="p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label>Contact Person</Label>
                <TextInput
                  icon={<PiBuildings className="h-4 w-4" />}
                  placeholder="Name"
                  {...register('subProductData.vendorContactName')}
                />
              </Field>
              <Field>
                <Label>Phone</Label>
                <TextInput
                  icon={<PiPhone className="h-4 w-4" />}
                  placeholder="+234…"
                  {...register('subProductData.vendorPhone')}
                />
              </Field>
              <Field>
                <Label>Email</Label>
                <TextInput
                  icon={<PiEnvelope className="h-4 w-4" />}
                  type="email"
                  placeholder="vendor@example.com"
                  {...register('subProductData.vendorEmail')}
                />
              </Field>
              <Field>
                <Label>Website</Label>
                <TextInput
                  icon={<PiGlobe className="h-4 w-4" />}
                  placeholder="https://…"
                  {...register('subProductData.vendorWebsite')}
                />
              </Field>
              <Field className="sm:col-span-2">
                <Label>Address</Label>
                <TextInput
                  icon={<PiMapPin className="h-4 w-4" />}
                  placeholder="Full address"
                  {...register('subProductData.vendorAddress')}
                />
              </Field>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
