'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PiArrowLeft,
  PiArrowRight,
  PiPencilSimple,
  PiFloppyDisk,
  PiX,
  PiBuildings,
  PiUser,
  PiPhone,
  PiMapPin,
  PiCurrencyDollar,
  PiShoppingCart,
  PiReceipt,
  PiCheck,
  PiCaretDown,
  PiArrowSquareOut,
  PiSpinnerGap,
  PiPlus,
  PiTrash,
  PiEnvelopeSimple,
  PiHandshake,
  PiBarcode,
  PiSlidersHorizontal,
  PiScales,
  PiBank,
  PiBell,
  PiGear,
  PiLightning,
  PiChartLineUp,
  PiArrowFatLineRight,
  PiNotePencil,
  PiShoppingBag,
  PiWarning,
  PiProhibit,
  PiTruck,
  PiFileText,
  PiCamera,
  PiCalendarBlank,
  PiStar,
  PiClipboardText,
  PiHashStraight,
  PiGlobe,
  PiCurrencyCircleDollar,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from '@/services/vendor.service';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import { vendorBillService } from '@/services/vendorBill.service';
import { meetingService } from '@/services/meeting.service';
import { taskService } from '@/services/task.service';
import { pricelistService } from '@/services/pricelist.service';
import { vendorPricelistService } from '@/services/vendorPricelist.service';
import type { VendorPricelist } from '@/services/vendorPricelist.service';

const PAYMENT_TERMS = [
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_14', label: 'Net 14' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
];

const PAYMENT_METHODS: Record<string, string> = {
  bank: 'Bank Transfer',
  cash: 'Cash',
  transfer: 'Wire Transfer',
  cheque: 'Cheque',
};

const SALES_TEAMS = [
  'Direct Sales',
  'Inside Sales',
  'Channel Partners',
  'Key Accounts',
  'Online / E-commerce',
  'Export / International',
];

type DetailTab = 'contacts' | 'sales' | 'accounting' | 'notes';
type ContactType = 'contact' | 'invoice' | 'delivery' | 'followup' | 'other';

interface ContactEntry {
  id: string;
  type: ContactType;
  name: string;
  email: string;
  phone: string;
  mobile: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  notes: string;
}

interface BankAccount {
  id: string;
  accountNumber: string;
  bankName: string;
}

interface FormState {
  vendorType: 'individual' | 'company';
  name: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  taxId: string;
  jobPosition: string;
  title: string;
  tags: string;
  isActive: boolean;
  notes: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // Sales & Purchase tab
  salesperson: string;
  salesTeam: string;
  salesPaymentTerms: string;
  salesPaymentMethod: string;
  pricelist: string;
  deliveryMethod: string;
  barcode: string;
  companyId: string;
  reference: string;
  buyer: string;
  purchasePaymentTerms: string;
  purchasePaymentMethod: string;
  receiptReminder: boolean;
  supplierCurrency: string;
  fiscalPosition: string;
  leadTime: string;
  minOrderQty: string;
  // Accounting tab
  accountReceivable: string;
  accountPayable: string;
  invoiceRemindersMode: 'automatic' | 'manual';
  autoPostBills: string;
  partnerLimit: boolean;
  creditLimitAmount: string;
  // Internal Notes warnings
  warningSalesOrder: string;
  warningInvoice: string;
  warningPurchaseOrder: string;
  warningPicking: string;
}

function emptyForm(): FormState {
  return {
    vendorType: 'company',
    name: '',
    email: '',
    phone: '',
    mobile: '',
    website: '',
    taxId: '',
    jobPosition: '',
    title: '',
    tags: '',
    isActive: true,
    notes: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    salesperson: '',
    salesTeam: '',
    salesPaymentTerms: '',
    salesPaymentMethod: '',
    pricelist: '',
    deliveryMethod: '',
    barcode: '',
    companyId: '',
    reference: '',
    buyer: '',
    purchasePaymentTerms: 'net_30',
    purchasePaymentMethod: '',
    receiptReminder: false,
    supplierCurrency: 'NGN',
    fiscalPosition: '',
    leadTime: '',
    minOrderQty: '',
    accountReceivable: '121000 Account Receivable',
    accountPayable: '211000 Account Payable',
    invoiceRemindersMode: 'automatic',
    autoPostBills: 'Ask after 3 validations without edits',
    partnerLimit: false,
    creditLimitAmount: '',
    warningSalesOrder: '',
    warningInvoice: '',
    warningPurchaseOrder: '',
    warningPicking: '',
  };
}

function vendorToForm(v: Vendor): FormState {
  return {
    vendorType: v.vendorType ?? 'company',
    name: v.name ?? '',
    email: v.email ?? '',
    phone: v.phone ?? '',
    mobile: '',
    website: v.website ?? '',
    taxId: v.taxId ?? '',
    jobPosition: '',
    title: '',
    tags: '',
    isActive: v.isActive !== false,
    notes: v.notes ?? '',
    street: v.address?.street ?? '',
    street2: '',
    city: v.address?.city ?? '',
    state: v.address?.state ?? '',
    country: v.address?.country ?? '',
    zipCode: v.address?.zipCode ?? '',
    contactName: v.contactPerson?.name ?? '',
    contactEmail: v.contactPerson?.email ?? '',
    contactPhone: v.contactPerson?.phone ?? '',
    salesperson: '',
    salesTeam: '',
    salesPaymentTerms: '',
    salesPaymentMethod: '',
    pricelist: '',
    deliveryMethod: '',
    barcode: '',
    companyId: '',
    reference: '',
    buyer: '',
    purchasePaymentTerms: v.paymentTerms ?? 'net_30',
    purchasePaymentMethod: '',
    receiptReminder: false,
    supplierCurrency: 'NGN',
    fiscalPosition: '',
    leadTime: '',
    minOrderQty: '',
    accountReceivable: '121000 Account Receivable',
    accountPayable: '211000 Account Payable',
    invoiceRemindersMode: 'automatic',
    autoPostBills: 'Ask after 3 validations without edits',
    partnerLimit: false,
    creditLimitAmount: '',
    warningSalesOrder: '',
    warningInvoice: '',
    warningPurchaseOrder: '',
    warningPicking: '',
  };
}

const CONTACT_TYPE_META: Record<ContactType, { label: string; cls: string }> = {
  contact: { label: 'Contact', cls: 'bg-blue-100 text-blue-700' },
  invoice: { label: 'Invoice Address', cls: 'bg-purple-100 text-purple-700' },
  delivery: { label: 'Delivery Address', cls: 'bg-green-100 text-green-700' },
  followup: { label: 'Follow-up Address', cls: 'bg-amber-100 text-amber-700' },
  other: { label: 'Other Address', cls: 'bg-gray-100 text-gray-600' },
};

function ContactCard({
  contact: c,
  onEdit,
  onDelete,
}: {
  contact: ContactEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = CONTACT_TYPE_META[c.type] ?? CONTACT_TYPE_META.other;
  const initials = (c.name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const addressLine = [c.street, c.city, c.state, c.zip, c.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md">
      <span
        className={`mb-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
      >
        {meta.label}
      </span>

      {/* Hover actions */}
      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-[#b20202]/10 hover:text-[#b20202]"
        >
          <PiPencilSimple className="text-xs" />
        </button>
        <button
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500"
        >
          <PiTrash className="text-xs" />
        </button>
      </div>

      {/* Avatar + name */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10 text-sm font-bold text-[#b20202]">
          {initials}
        </div>
        <p className="text-sm font-semibold leading-snug text-gray-800">
          {c.name || '—'}
        </p>
      </div>

      {/* Contact details */}
      <div className="space-y-1.5 text-xs text-gray-500">
        {addressLine && (
          <div className="flex items-start gap-1.5">
            <PiMapPin className="mt-0.5 shrink-0 text-gray-400" />
            <span className="leading-relaxed">{addressLine}</span>
          </div>
        )}
        {c.phone && (
          <div className="flex items-center gap-1.5">
            <PiPhone className="shrink-0 text-gray-400" />
            <a href={`tel:${c.phone}`} className="hover:text-[#b20202]">
              {c.phone}
            </a>
          </div>
        )}
        {c.mobile && (
          <div className="flex items-center gap-1.5">
            <PiPhone className="shrink-0 text-gray-400" />
            <a href={`tel:${c.mobile}`} className="hover:text-[#b20202]">
              {c.mobile}
            </a>
          </div>
        )}
        {c.email && (
          <div className="flex items-center gap-1.5">
            <PiEnvelopeSimple className="shrink-0 text-gray-400" />
            <a
              href={`mailto:${c.email}`}
              className="truncate hover:text-[#b20202]"
            >
              {c.email}
            </a>
          </div>
        )}
        {c.notes && (
          <p className="mt-2 border-t border-gray-100 pt-2 italic text-gray-400">
            {c.notes}
          </p>
        )}
      </div>
    </div>
  );
}

const DELIVERY_METHODS = [
  { value: 'standard', label: 'Standard Delivery' },
  { value: 'express', label: 'Express Delivery' },
  { value: 'overnight', label: 'Overnight Delivery' },
  { value: 'freight', label: 'Freight / Cargo' },
  { value: 'pickup', label: 'Pick-up (Customer Collection)' },
  { value: '3pl', label: 'Third-party Logistics (3PL)' },
  { value: 'dropship', label: 'Dropship' },
];

const PO_STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  rfq: 'bg-gray-100 text-gray-500',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-blue-100 text-blue-700',
  approved: 'bg-indigo-100 text-indigo-700',
  partial: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  billed: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-600',
  returned: 'bg-orange-100 text-orange-700',
};

const BILL_STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  posted: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

interface SelectOption {
  value: string;
  label: string;
  sub?: string;
}

function SearchSelect({
  value,
  onChange,
  options,
  placeholder = '— select —',
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sub ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  if (disabled) {
    return (
      <p className="min-h-[36px] py-2 text-sm text-gray-800">
        {selected?.label || <span className="text-gray-400">—</span>}
      </p>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery('');
        }}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
      >
        <span
          className={`truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <PiCaretDown
          className={`ml-2 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full px-3 py-1.5 text-left text-xs italic text-gray-400 hover:bg-gray-50"
              >
                Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">
                No results found
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${o.value === value ? 'bg-[#b20202]/5 font-medium text-[#b20202]' : 'text-gray-700'}`}
                >
                  <span>{o.label}</span>
                  {o.sub && (
                    <span className="ml-2 text-xs text-gray-400">{o.sub}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition-colors placeholder:text-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15 disabled:bg-gray-50 disabled:text-gray-400';
const LABEL_CLS =
  'block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      {children}
    </div>
  );
}

function ReadValue({ value }: { value?: string }) {
  return (
    <p className="min-h-[36px] py-2 text-sm text-gray-800">
      {value || <span className="text-gray-400">—</span>}
    </p>
  );
}

function SmartButton({
  icon,
  label,
  count,
  href,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  count?: string | number;
  href?: string;
  highlight?: boolean;
}) {
  const cls = [
    'relative flex flex-col items-center justify-center gap-0.5 min-w-[80px] px-4 py-2',
    'rounded-lg border cursor-pointer select-none transition-all duration-150',
    highlight
      ? 'border-[#b20202]/30 bg-[#b20202]/8 text-[#b20202] hover:bg-[#b20202]/12'
      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700',
  ].join(' ');

  const inner = (
    <>
      <span className="flex items-center gap-1.5 leading-none">
        <span
          className={`[&>svg]:h-3.5 [&>svg]:w-3.5 ${highlight ? '' : 'opacity-40'}`}
        >
          {icon}
        </span>
        <span
          className={`text-base font-black tabular-nums ${highlight ? 'text-[#b20202]' : 'text-gray-700'}`}
        >
          {count ?? 0}
        </span>
      </span>
      <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400">
        {label}
      </span>
    </>
  );

  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return <div className={cls}>{inner}</div>;
}

export default function PurchasesVendorDetail({ id }: { id: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [meetingCount, setMeetingCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [poCount, setPoCount] = useState(0);
  const [billCount, setBillCount] = useState(0);
  const [totalSpend, setTotalSpend] = useState(0);
  const [onTimeRate, setOnTimeRate] = useState<number | null>(null);
  const [recentPos, setRecentPos] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [invoicedTotal, setInvoicedTotal] = useState(0);
  const [outstandingTotal, setOutstandingTotal] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editMode] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('contacts');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [moreOpen, setMoreOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [availablePricelists, setAvailablePricelists] = useState<
    SelectOption[]
  >([]);
  const [vendorPricelists, setVendorPricelists] = useState<VendorPricelist[]>(
    []
  );
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactEntry | null>(
    null
  );
  const [contactDraft, setContactDraft] = useState<Partial<ContactEntry>>({});

  const load = useCallback(async () => {
    if (status === 'loading') return;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [v, allV] = await Promise.all([
        vendorService.getById(id, token),
        vendorService.getAll(token),
      ]);
      setVendor(v);
      setAllVendors(allV);
      setForm(vendorToForm(v));

      const [posRes, billsRes, plRes, vplRes, meetingsRes, tasksRes] =
        await Promise.allSettled([
          purchaseOrderService.getPurchaseOrders(token, { vendor: id }),
          vendorBillService.getVendorBills(token, { vendor: id, limit: 200 }),
          pricelistService.list(token, { isActive: true, limit: 200 }),
          vendorPricelistService.getPricelists(token, {
            vendor: id,
            isActive: true,
            limit: 200,
          }),
          meetingService.getAll(token, { vendor: id }),
          taskService.getAll(token, { vendor: id }),
        ]);

      if (meetingsRes.status === 'fulfilled') {
        setMeetingCount(meetingsRes.value.length);
      }

      if (tasksRes.status === 'fulfilled') {
        const open = tasksRes.value.filter(
          (t) => t.status === 'todo' || t.status === 'in_progress'
        );
        setTaskCount(open.length);
      }

      if (posRes.status === 'fulfilled') {
        const raw = posRes.value;
        const pos: any[] =
          raw?.data ?? raw?.purchaseOrders ?? (Array.isArray(raw) ? raw : []);
        setPoCount(pos.length);
        const spend = pos.reduce(
          (s: number, p: any) => s + (p.totalAmount ?? p.total ?? 0),
          0
        );
        setTotalSpend(spend);
        const delivered = pos.filter(
          (p: any) => p.status === 'received' || p.status === 'billed'
        );
        if (delivered.length > 0) {
          const onTime = delivered.filter((p: any) => {
            if (!p.expectedDelivery || !p.receivedAt) return false;
            return new Date(p.receivedAt) <= new Date(p.expectedDelivery);
          });
          setOnTimeRate(Math.round((onTime.length / delivered.length) * 100));
        }
        setRecentPos(pos.slice(0, 5));
      }

      if (billsRes.status === 'fulfilled') {
        const bills = billsRes.value?.data ?? [];
        setBillCount(bills.length);
        setRecentBills(bills.slice(0, 5));

        const invoiced = bills
          .filter((b: any) =>
            ['posted', 'confirmed', 'paid'].includes(b.status)
          )
          .reduce(
            (s: number, b: any) => s + (b.totalAmount ?? b.amount ?? 0),
            0
          );
        setInvoicedTotal(invoiced);

        const outstanding = bills
          .filter((b: any) =>
            ['posted', 'confirmed', 'overdue'].includes(b.status)
          )
          .reduce((s: number, b: any) => {
            const total = b.totalAmount ?? b.amount ?? 0;
            const paid = b.amountPaid ?? 0;
            return s + Math.max(0, total - paid);
          }, 0);
        setOutstandingTotal(outstanding);
      }
      if (plRes.status === 'fulfilled') {
        const raw = plRes.value?.data;
        const pls: any[] = Array.isArray(raw) ? raw : (raw?.pricelists ?? []);
        setAvailablePricelists(
          pls.map((p: any) => ({
            value: p._id,
            label: p.name,
            sub: p.currency ?? '',
          }))
        );
      }
      if (vplRes.status === 'fulfilled') {
        setVendorPricelists(vplRes.value?.data ?? []);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load vendor');
    } finally {
      setLoading(false);
    }
  }, [id, token, status]);

  useEffect(() => {
    load();
  }, [load]);

  const currentIndex = allVendors.findIndex((v) => v._id === id);
  const prevVendor = currentIndex > 0 ? allVendors[currentIndex - 1] : null;
  const nextVendor =
    currentIndex < allVendors.length - 1 ? allVendors[currentIndex + 1] : null;

  function set(key: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
    setIsDirty(true);
  }

  function saveContact() {
    const entry: ContactEntry = {
      id: editingContact?.id ?? Date.now().toString(),
      type: (contactDraft.type as ContactType) ?? 'contact',
      name: contactDraft.name ?? '',
      email: contactDraft.email ?? '',
      phone: contactDraft.phone ?? '',
      mobile: contactDraft.mobile ?? '',
      street: contactDraft.street ?? '',
      street2: contactDraft.street2 ?? '',
      city: contactDraft.city ?? '',
      state: contactDraft.state ?? '',
      zip: contactDraft.zip ?? '',
      country: contactDraft.country ?? '',
      notes: contactDraft.notes ?? '',
    };
    if (editingContact) {
      setContacts((prev) =>
        prev.map((c) => (c.id === editingContact.id ? entry : c))
      );
    } else {
      setContacts((prev) => [...prev, entry]);
    }
  }

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const saved = await vendorService.uploadPhoto(id, fd, token);
      setVendor(saved);
      toast.success('Photo updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Vendor name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        vendorType: form.vendorType,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        paymentTerms: form.purchasePaymentTerms as Vendor['paymentTerms'],
        isActive: form.isActive,
        notes: form.notes.trim() || undefined,
        address:
          form.street || form.city || form.state || form.country || form.zipCode
            ? {
                street: form.street || undefined,
                city: form.city || undefined,
                state: form.state || undefined,
                country: form.country || undefined,
                zipCode: form.zipCode || undefined,
              }
            : undefined,
        contactPerson:
          form.contactName || form.contactEmail || form.contactPhone
            ? {
                name: form.contactName || undefined,
                email: form.contactEmail || undefined,
                phone: form.contactPhone || undefined,
              }
            : undefined,
      };
      const saved = await vendorService.update(id, payload, token);
      setVendor(saved);
      setForm(vendorToForm(saved));
      toast.success('Vendor saved');
      setIsDirty(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (vendor) setForm(vendorToForm(vendor));
    setIsDirty(false);
  }

  async function handleDelete() {
    if (
      !confirm(`Permanently delete "${vendor?.name}"? This cannot be undone.`)
    )
      return;
    try {
      await vendorService.delete(id, token);
      toast.success('Vendor deleted');
      router.push('/purchases/vendors');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete vendor');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <PiSpinnerGap className="animate-spin text-4xl text-[#b20202]" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500">
        <PiBuildings className="text-5xl" />
        <p>Vendor not found</p>
        <Link
          href="/purchases/vendors"
          className="text-sm text-[#b20202] hover:underline"
        >
          Back to vendors
        </Link>
      </div>
    );
  }

  const initials = vendor.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-0">
      {/* ── Action Bar ── */}
      <div className="flex items-stretch border-b border-gray-200 bg-white">
        {/* ① New + Breadcrumb + Gear */}
        <div className="flex shrink-0 items-center gap-3 border-r border-gray-100 px-4 py-2">
          <Link
            href="/purchases/vendors/new"
            className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 active:scale-95"
          >
            <PiPlus className="h-3 w-3" />
            New
          </Link>

          <div className="flex items-center gap-1.5">
            <Link
              href="/purchases/vendors"
              className="text-xs font-medium text-[#b20202] transition-colors hover:text-[#7a0000]"
            >
              Vendors
            </Link>
            <svg
              viewBox="0 0 5 9"
              className="h-2.5 w-1.5 shrink-0 text-gray-300"
              fill="none"
            >
              <path
                d="M1 1l3 3.5L1 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="max-w-[160px] truncate text-xs font-semibold text-gray-800">
              {vendor.name}
            </span>
            {!form.isActive && (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                Archived
              </span>
            )}
          </div>

          {/* Gear dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setGearOpen((o) => !o)}
              className={`flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors ${gearOpen ? 'bg-gray-100 text-gray-600' : 'hover:bg-gray-100 hover:text-gray-600'}`}
            >
              <PiGear className="h-3.5 w-3.5" />
            </button>
            {gearOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setGearOpen(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-black/10">
                  <div className="border-b border-gray-100 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                      Actions
                    </p>
                  </div>
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => {
                        set('isActive', !form.isActive);
                        setGearOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      {form.isActive ? (
                        <PiProhibit className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      ) : (
                        <PiCheck className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      )}
                      {form.isActive ? 'Archive Vendor' : 'Restore Vendor'}
                    </button>
                    {vendor.website && (
                      <a
                        href={
                          vendor.website.startsWith('http')
                            ? vendor.website
                            : `https://${vendor.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setGearOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <PiArrowSquareOut className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        Open Website
                      </a>
                    )}
                    <div className="my-1 h-px bg-gray-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setGearOpen(false);
                        handleDelete();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-red-600 transition-colors hover:bg-red-50"
                    >
                      <PiTrash className="h-3.5 w-3.5 shrink-0" />
                      Delete Vendor
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ② Smart Metric Buttons + More */}
        <div className="flex flex-1 items-center py-2">
          {/* scrollable smart buttons */}
          <div className="flex flex-1 items-center gap-1 overflow-x-auto px-3">
            <SmartButton
              icon={<PiCalendarBlank />}
              label="Meetings"
              count={meetingCount}
              href={`/purchases/vendors/${id}/meetings`}
              highlight={meetingCount > 0}
            />
            <SmartButton
              icon={<PiShoppingCart />}
              label="Purchases"
              count={poCount}
              href={`/purchases?vendor=${id}`}
              highlight={poCount > 0}
            />
            <SmartButton
              icon={<PiReceipt />}
              label="Bills"
              count={billCount}
              href={`/purchases/bills?vendor=${id}`}
              highlight={billCount > 0}
            />
            <SmartButton
              icon={<PiCurrencyDollar />}
              label="Invoiced"
              count={
                invoicedTotal > 0
                  ? invoicedTotal >= 1_000_000
                    ? `₦${(invoicedTotal / 1_000_000).toFixed(1)}M`
                    : invoicedTotal >= 1_000
                      ? `₦${(invoicedTotal / 1_000).toFixed(0)}k`
                      : `₦${invoicedTotal.toFixed(0)}`
                  : '₦0'
              }
              highlight={invoicedTotal > 0}
              href={`/purchases/vendors/${id}/invoiced`}
            />
            <SmartButton
              icon={<PiCurrencyCircleDollar />}
              label="Outstanding"
              count={
                outstandingTotal > 0
                  ? outstandingTotal >= 1_000_000
                    ? `₦${(outstandingTotal / 1_000_000).toFixed(1)}M`
                    : outstandingTotal >= 1_000
                      ? `₦${(outstandingTotal / 1_000).toFixed(0)}k`
                      : `₦${outstandingTotal.toFixed(0)}`
                  : '₦0'
              }
              highlight={outstandingTotal > 0}
              href={`/purchases/vendors/${id}/outstanding`}
            />
            <SmartButton
              icon={<PiClipboardText />}
              label="Tasks"
              count={taskCount}
              href={`/purchases/vendors/${id}/tasks`}
              highlight={taskCount > 0}
            />
          </div>

          {/* More dropdown — outside the overflow container so it never gets clipped */}
          <div className="relative shrink-0 pr-4">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-[11px] font-semibold transition-all ${
                moreOpen
                  ? 'border-gray-300 bg-gray-50 text-gray-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              More
              <PiCaretDown
                className={`h-3 w-3 transition-transform duration-150 ${moreOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {moreOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMoreOpen(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-1.5 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-black/10">
                  {/* Metrics row */}
                  <div className="border-b border-gray-100 p-1">
                    <p className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                      Vendor Metrics
                    </p>

                    {/* On-time Rate */}
                    <Link
                      href={`/purchases/vendors/${id}/on-time-rate`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2.5 text-xs text-gray-700">
                        <PiTruck className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        On-time Rate
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          onTimeRate !== null
                            ? onTimeRate >= 90
                              ? 'text-emerald-600'
                              : onTimeRate >= 70
                                ? 'text-amber-600'
                                : 'text-red-600'
                            : 'text-gray-300'
                        }`}
                      >
                        {onTimeRate !== null ? `${onTimeRate}%` : '—'}
                      </span>
                    </Link>

                    {/* Vendor Bills */}
                    <Link
                      href={`/purchases/bills?vendor=${id}`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2.5 text-xs text-gray-700">
                        <PiReceipt className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        Vendor Bills
                      </span>
                      {billCount > 0 && (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                          {billCount}
                        </span>
                      )}
                    </Link>

                    {/* Lot/Serial Numbers */}
                    <Link
                      href={`/inventory/lot-numbers?vendor=${id}`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <PiHashStraight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      Lot/Serial Numbers
                    </Link>

                    {/* Go to Website */}
                    {(vendor.website || form.website) && (
                      <a
                        href={
                          (vendor.website || form.website).startsWith('http')
                            ? vendor.website || form.website
                            : `https://${vendor.website || form.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <PiGlobe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        Go to Website
                      </a>
                    )}
                  </div>

                  {/* Create section */}
                  <div className="border-b border-gray-100 p-1">
                    <p className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                      Create
                    </p>
                    <Link
                      href={`/purchases/create?vendor=${id}&vendorName=${encodeURIComponent(vendor.name)}`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <PiShoppingCart className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      New Purchase Order
                    </Link>
                    <Link
                      href={`/purchases/bills/create?vendor=${id}`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <PiReceipt className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      New Bill
                    </Link>
                  </div>

                  {/* Navigate section */}
                  <div className="p-1">
                    <p className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                      Navigate
                    </p>
                    <Link
                      href={`/purchases?vendor=${id}`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2.5">
                        <PiShoppingCart className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        All Purchase Orders
                      </span>
                      {poCount > 0 && (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                          {poCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      href={`/purchases/returns?vendor=${id}`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <PiTruck className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      View Returns
                    </Link>
                    {vendor.email && (
                      <a
                        href={`mailto:${vendor.email}`}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <PiEnvelopeSimple className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        Send Email
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ③ Save / Discard */}
        {isDirty && (
          <div className="flex shrink-0 items-center gap-1.5 border-l border-gray-100 px-3 py-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95"
            >
              <PiX className="h-3 w-3" />
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-[#b20202] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-[#950202] active:scale-95 disabled:opacity-60"
            >
              {saving ? (
                <PiSpinnerGap className="h-3 w-3 animate-spin" />
              ) : (
                <PiFloppyDisk className="h-3 w-3" />
              )}
              Save
            </button>
          </div>
        )}

        {/* ④ Record navigation */}
        <div className="flex shrink-0 items-center gap-0 border-l border-gray-100 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              if (isDirty && !confirm('Discard unsaved changes?')) return;
              prevVendor && router.push(`/purchases/vendors/${prevVendor._id}`);
            }}
            disabled={!prevVendor}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <PiArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-gray-500">
            {currentIndex + 1} / {allVendors.length}
          </span>
          <button
            type="button"
            onClick={() => {
              if (isDirty && !confirm('Discard unsaved changes?')) return;
              nextVendor && router.push(`/purchases/vendors/${nextVendor._id}`);
            }}
            disabled={!nextVendor}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <PiArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main form body */}
      <div className="bg-white">
        {/* ── Vendor Identity Hero ── */}
        <div className="relative overflow-hidden border-b border-gray-800/60 bg-gradient-to-br from-[#0f0f0f] via-[#1a0606] to-[#111111] px-6 py-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="pointer-events-none absolute left-0 top-0 h-full w-[40%] bg-gradient-to-r from-[#b20202]/10 to-transparent" />
          {/* Type selector — pill toggle */}
          <div className="bg-white/8 mb-5 inline-flex items-center rounded-full border border-white/10 p-0.5 backdrop-blur-sm">
            {(['individual', 'company'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => editMode && set('vendorType', type)}
                disabled={!editMode}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                  form.vendorType === type
                    ? 'bg-[#b20202] text-white shadow-sm shadow-[#b20202]/30'
                    : 'text-white/50 hover:text-white/80 disabled:cursor-default'
                }`}
              >
                {type === 'individual' ? (
                  <PiUser className="text-sm" />
                ) : (
                  <PiBuildings className="text-sm" />
                )}
                {type === 'individual' ? 'Individual' : 'Company'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-5">
            {/* Avatar — photo upload or initials fallback */}
            <div
              className="group relative shrink-0 cursor-pointer"
              onClick={() => photoInputRef.current?.click()}
              title="Click to upload photo"
            >
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#b20202] to-[#6b0101] text-2xl font-black text-white shadow-2xl shadow-[#b20202]/40 ring-2 ring-white/10">
                {vendor.photo ? (
                  <img
                    src={vendor.photo}
                    alt={vendor.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              {/* Upload overlay */}
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {uploadingPhoto ? (
                  <PiSpinnerGap className="animate-spin text-xl text-white" />
                ) : (
                  <PiCamera className="text-xl text-white" />
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                  e.target.value = '';
                }}
              />
              <span
                className={`absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#111111] text-[9px] font-bold shadow-sm ${
                  form.isActive ? 'bg-emerald-500' : 'bg-gray-500'
                } text-white`}
              >
                {form.isActive ? '✓' : '—'}
              </span>
            </div>

            {/* Name + position + status badges */}
            <div className="min-w-0 flex-1">
              {editMode ? (
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Vendor / Company name"
                  className="w-full border-0 border-b-2 border-white/15 bg-transparent pb-1 text-2xl font-bold text-white placeholder-white/25 focus:border-[#b20202] focus:outline-none"
                />
              ) : (
                <h1 className="text-2xl font-bold text-white">{vendor.name}</h1>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {editMode ? (
                  <input
                    value={form.jobPosition}
                    onChange={(e) => set('jobPosition', e.target.value)}
                    placeholder="Job position or role..."
                    className="border-0 border-b border-white/15 bg-transparent text-sm text-white/60 placeholder-white/20 focus:border-[#b20202] focus:outline-none"
                  />
                ) : (
                  form.jobPosition && (
                    <span className="text-sm text-white/55">
                      {form.jobPosition}
                    </span>
                  )
                )}

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    form.isActive
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-white/10 text-white/40 ring-1 ring-white/10'
                  }`}
                >
                  {form.isActive ? '● Active' : '○ Archived'}
                </span>

                {form.purchasePaymentTerms && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300 ring-1 ring-blue-500/20">
                    <PiCurrencyDollar className="text-xs" />
                    {PAYMENT_TERMS.find(
                      (t) => t.value === form.purchasePaymentTerms
                    )?.label ?? form.purchasePaymentTerms}
                  </span>
                )}

                {onTimeRate !== null && (
                  <Link
                    href={`/purchases/vendors/${id}/on-time-rate`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition-opacity hover:opacity-80 ${
                      onTimeRate >= 80
                        ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20'
                        : onTimeRate >= 50
                          ? 'bg-amber-500/15 text-amber-300 ring-amber-500/20'
                          : 'bg-red-500/15 text-red-300 ring-red-500/20'
                    }`}
                  >
                    <PiTruck className="text-xs" />
                    {onTimeRate}% on-time
                  </Link>
                )}
              </div>
            </div>

            {/* Quick stat cards — visible on large screens */}
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <div className="bg-white/8 rounded-xl border border-white/10 px-5 py-3.5 text-center backdrop-blur-sm">
                <p className="text-2xl font-black text-[#e85555]">{poCount}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/40">
                  Orders
                </p>
              </div>
              <div className="bg-white/8 rounded-xl border border-white/10 px-5 py-3.5 text-center backdrop-blur-sm">
                <p className="text-2xl font-black text-white">
                  {totalSpend >= 1_000_000
                    ? `₦${(totalSpend / 1_000_000).toFixed(1)}M`
                    : totalSpend >= 1_000
                      ? `₦${(totalSpend / 1_000).toFixed(1)}k`
                      : totalSpend > 0
                        ? `₦${totalSpend.toFixed(0)}`
                        : '—'}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/40">
                  Spend
                </p>
              </div>
              <div className="bg-white/8 rounded-xl border border-white/10 px-5 py-3.5 text-center backdrop-blur-sm">
                <p className="text-2xl font-black text-white">{billCount}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/40">
                  Bills
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column: address + contact */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: Address */}
          <div className="border-b border-gray-100 px-6 py-6 md:border-b-0 md:border-r">
            <h3 className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <PiMapPin className="text-[#b20202]" /> Address
            </h3>
            <div className="space-y-3">
              <Field label="Street">
                {editMode ? (
                  <input
                    value={form.street}
                    onChange={(e) => set('street', e.target.value)}
                    placeholder="Street..."
                    className={INPUT_CLS}
                  />
                ) : (
                  <ReadValue value={form.street} />
                )}
              </Field>
              <Field label="Street 2">
                {editMode ? (
                  <input
                    value={form.street2}
                    onChange={(e) => set('street2', e.target.value)}
                    placeholder="Street 2..."
                    className={INPUT_CLS}
                  />
                ) : (
                  <ReadValue value={form.street2} />
                )}
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="City">
                  {editMode ? (
                    <input
                      value={form.city}
                      onChange={(e) => set('city', e.target.value)}
                      className={INPUT_CLS}
                    />
                  ) : (
                    <ReadValue value={form.city} />
                  )}
                </Field>
                <Field label="State">
                  {editMode ? (
                    <input
                      value={form.state}
                      onChange={(e) => set('state', e.target.value)}
                      className={INPUT_CLS}
                    />
                  ) : (
                    <ReadValue value={form.state} />
                  )}
                </Field>
                <Field label="ZIP">
                  {editMode ? (
                    <input
                      value={form.zipCode}
                      onChange={(e) => set('zipCode', e.target.value)}
                      className={INPUT_CLS}
                    />
                  ) : (
                    <ReadValue value={form.zipCode} />
                  )}
                </Field>
              </div>
              <Field label="Country">
                {editMode ? (
                  <input
                    value={form.country}
                    onChange={(e) => set('country', e.target.value)}
                    className={INPUT_CLS}
                  />
                ) : (
                  <ReadValue value={form.country} />
                )}
              </Field>
              <Field label="Tax ID">
                {editMode ? (
                  <input
                    value={form.taxId}
                    onChange={(e) => set('taxId', e.target.value)}
                    placeholder="/ if not applicable"
                    className={INPUT_CLS}
                  />
                ) : (
                  <ReadValue value={form.taxId} />
                )}
              </Field>
            </div>
          </div>

          {/* Right: Contact details */}
          <div className="px-6 py-6">
            <h3 className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <PiPhone className="text-[#b20202]" /> Contact
            </h3>
            <div className="space-y-3">
              <Field label="Phone">
                {editMode ? (
                  <input
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    className={INPUT_CLS}
                  />
                ) : form.phone ? (
                  <a
                    href={`tel:${form.phone}`}
                    className="flex items-center gap-1.5 py-2 text-sm text-gray-800 hover:text-[#b20202]"
                  >
                    <PiPhone className="text-gray-400" /> {form.phone}
                  </a>
                ) : (
                  <ReadValue />
                )}
              </Field>
              <Field label="Mobile">
                {editMode ? (
                  <input
                    value={form.mobile}
                    onChange={(e) => set('mobile', e.target.value)}
                    className={INPUT_CLS}
                  />
                ) : form.mobile ? (
                  <a
                    href={`tel:${form.mobile}`}
                    className="flex items-center gap-1.5 py-2 text-sm text-gray-800 hover:text-[#b20202]"
                  >
                    <PiPhone className="text-gray-400" /> {form.mobile}
                  </a>
                ) : (
                  <ReadValue />
                )}
              </Field>
              <Field label="Email">
                {editMode ? (
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    className={INPUT_CLS}
                  />
                ) : form.email ? (
                  <a
                    href={`mailto:${form.email}`}
                    className="block py-2 text-sm text-[#b20202] hover:underline"
                  >
                    {form.email}
                  </a>
                ) : (
                  <ReadValue />
                )}
              </Field>
              <Field label="Website">
                {editMode ? (
                  <input
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                    placeholder="e.g. https://www.example.com"
                    className={INPUT_CLS}
                  />
                ) : vendor.website ? (
                  <a
                    href={
                      vendor.website.startsWith('http')
                        ? vendor.website
                        : `https://${vendor.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 py-2 text-sm text-[#b20202] hover:underline"
                  >
                    {vendor.website}
                    <PiArrowSquareOut className="text-xs" />
                  </a>
                ) : (
                  <ReadValue />
                )}
              </Field>
              <Field label="Title">
                {editMode ? (
                  <select
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    className={INPUT_CLS}
                  >
                    <option value="">e.g. Mister</option>
                    <option>Mr.</option>
                    <option>Mrs.</option>
                    <option>Ms.</option>
                    <option>Dr.</option>
                    <option>Prof.</option>
                  </select>
                ) : (
                  <ReadValue value={form.title} />
                )}
              </Field>
              <Field label="Tags">
                {editMode ? (
                  <input
                    value={form.tags}
                    onChange={(e) => set('tags', e.target.value)}
                    placeholder='e.g. "B2B", "VIP", "Consulting"'
                    className={INPUT_CLS}
                  />
                ) : (
                  <div className="flex flex-wrap gap-1 py-2">
                    {form.tags ? (
                      form.tags
                        .split(',')
                        .filter(Boolean)
                        .map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {t.trim()}
                          </span>
                        ))
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </div>
                )}
              </Field>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-gray-100">
          <div className="flex gap-1 border-b border-gray-100 bg-gray-50/50 px-4">
            {(
              [
                {
                  id: 'contacts',
                  label: 'Contacts & Addresses',
                  icon: <PiUser />,
                },
                {
                  id: 'sales',
                  label: 'Sales & Purchase',
                  icon: <PiHandshake />,
                },
                { id: 'accounting', label: 'Accounting', icon: <PiBank /> },
                {
                  id: 'notes',
                  label: 'Internal Notes',
                  icon: <PiNotePencil />,
                },
              ] as { id: DetailTab; label: string; icon: React.ReactNode }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3.5 py-3 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'border-[#b20202] text-[#b20202]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <span
                  className={`[&>svg]:h-3.5 [&>svg]:w-3.5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}
                >
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-6 py-5">
            {/* Contacts & Addresses */}
            {activeTab === 'contacts' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">
                      Contacts & Addresses
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-400">
                      People and addresses associated with this vendor
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setContactDraft({ type: 'contact' });
                      setEditingContact(null);
                      setShowContactModal(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#900000]"
                  >
                    <PiPlus /> Add
                  </button>
                </div>
                {contacts.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <PiUser className="text-xl text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        No contacts yet
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        Click Add to create a contact or address entry
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setContactDraft({ type: 'contact' });
                        setEditingContact(null);
                        setShowContactModal(true);
                      }}
                      className="mt-1 flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <PiPlus /> Add a contact
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {contacts.map((c) => (
                      <ContactCard
                        key={c.id}
                        contact={c}
                        onEdit={() => {
                          setContactDraft(c);
                          setEditingContact(c);
                          setShowContactModal(true);
                        }}
                        onDelete={() =>
                          setContacts((prev) =>
                            prev.filter((x) => x.id !== c.id)
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sales & Purchase */}
            {activeTab === 'sales' && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* ── Left column ── */}
                <div className="space-y-4">
                  {/* SALES section */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiHandshake className="text-[#b20202]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Sales
                      </span>
                    </div>
                    <div className="space-y-3 p-4">
                      <Field label="Salesperson">
                        {editMode ? (
                          <input
                            value={form.salesperson}
                            onChange={(e) => set('salesperson', e.target.value)}
                            placeholder="e.g. John Smith"
                            className={INPUT_CLS}
                          />
                        ) : form.salesperson ? (
                          <span className="flex items-center gap-1.5 py-1.5 text-sm text-gray-800">
                            <PiUser className="text-gray-400" />{' '}
                            {form.salesperson}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                      <Field label="Sales Team">
                        {editMode ? (
                          <select
                            value={form.salesTeam}
                            onChange={(e) => set('salesTeam', e.target.value)}
                            className={INPUT_CLS}
                          >
                            <option value="">— none —</option>
                            {SALES_TEAMS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : form.salesTeam ? (
                          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                            {form.salesTeam}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                      <Field label="Payment Terms">
                        {editMode ? (
                          <select
                            value={form.salesPaymentTerms}
                            onChange={(e) =>
                              set('salesPaymentTerms', e.target.value)
                            }
                            className={INPUT_CLS}
                          >
                            <option value="">— none —</option>
                            {PAYMENT_TERMS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        ) : form.salesPaymentTerms ? (
                          <span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {
                              PAYMENT_TERMS.find(
                                (t) => t.value === form.salesPaymentTerms
                              )?.label
                            }
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                      <Field label="Payment Method">
                        {editMode ? (
                          <select
                            value={form.salesPaymentMethod}
                            onChange={(e) =>
                              set('salesPaymentMethod', e.target.value)
                            }
                            className={INPUT_CLS}
                          >
                            <option value="">— none —</option>
                            {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        ) : form.salesPaymentMethod ? (
                          <span className="mt-1 inline-block rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                            {PAYMENT_METHODS[form.salesPaymentMethod] ??
                              form.salesPaymentMethod}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                      <Field label="Pricelist">
                        {editMode ? (
                          <SearchSelect
                            value={form.pricelist}
                            onChange={(v) => set('pricelist', v)}
                            options={availablePricelists}
                            placeholder="— select pricelist —"
                          />
                        ) : form.pricelist ? (
                          <span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {availablePricelists.find(
                              (p) => p.value === form.pricelist
                            )?.label ?? form.pricelist}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                      <Field label="Delivery Method">
                        {editMode ? (
                          <SearchSelect
                            value={form.deliveryMethod}
                            onChange={(v) => set('deliveryMethod', v)}
                            options={DELIVERY_METHODS}
                            placeholder="— select method —"
                          />
                        ) : form.deliveryMethod ? (
                          <span className="mt-1 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                            {DELIVERY_METHODS.find(
                              (d) => d.value === form.deliveryMethod
                            )?.label ?? form.deliveryMethod}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                    </div>
                  </div>

                  {/* POINT OF SALE section */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiBarcode className="text-[#b20202]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Point of Sale
                      </span>
                    </div>
                    <div className="p-4">
                      <Field label="Barcode">
                        {editMode ? (
                          <input
                            value={form.barcode}
                            onChange={(e) => set('barcode', e.target.value)}
                            placeholder="Scan or enter barcode"
                            className={INPUT_CLS}
                          />
                        ) : form.barcode ? (
                          <span className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-700">
                            <PiBarcode /> {form.barcode}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                    </div>
                  </div>

                  {/* MISC section */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiSlidersHorizontal className="text-[#b20202]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Misc
                      </span>
                    </div>
                    <div className="space-y-3 p-4">
                      <Field label="Tags">
                        {editMode ? (
                          <input
                            value={form.tags}
                            onChange={(e) => set('tags', e.target.value)}
                            placeholder="e.g. premium, local, spirits"
                            className={INPUT_CLS}
                          />
                        ) : form.tags ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {form.tags
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                      <Field label="Company ID">
                        {editMode ? (
                          <input
                            value={form.companyId}
                            onChange={(e) => set('companyId', e.target.value)}
                            className={INPUT_CLS}
                          />
                        ) : (
                          <ReadValue value={form.companyId} />
                        )}
                      </Field>
                      <Field label="Reference">
                        {editMode ? (
                          <input
                            value={form.reference}
                            onChange={(e) => set('reference', e.target.value)}
                            placeholder="External vendor reference"
                            className={INPUT_CLS}
                          />
                        ) : (
                          <ReadValue value={form.reference} />
                        )}
                      </Field>
                    </div>
                  </div>
                </div>

                {/* ── Right column ── */}
                <div className="space-y-4">
                  {/* PURCHASE section */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiShoppingCart className="text-[#b20202]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Purchase
                      </span>
                    </div>
                    <div className="space-y-3 p-4">
                      <Field label="Buyer">
                        {editMode ? (
                          <input
                            value={form.buyer}
                            onChange={(e) => set('buyer', e.target.value)}
                            placeholder="e.g. Sarah Okeke"
                            className={INPUT_CLS}
                          />
                        ) : form.buyer ? (
                          <span className="flex items-center gap-1.5 py-1.5 text-sm text-gray-800">
                            <PiUser className="text-gray-400" /> {form.buyer}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                      <Field label="Payment Terms">
                        {editMode ? (
                          <select
                            value={form.purchasePaymentTerms}
                            onChange={(e) =>
                              set('purchasePaymentTerms', e.target.value)
                            }
                            className={INPUT_CLS}
                          >
                            <option value="">— none —</option>
                            {PAYMENT_TERMS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        ) : form.purchasePaymentTerms ? (
                          <span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {
                              PAYMENT_TERMS.find(
                                (t) => t.value === form.purchasePaymentTerms
                              )?.label
                            }
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                      <Field label="Payment Method">
                        {editMode ? (
                          <select
                            value={form.purchasePaymentMethod}
                            onChange={(e) =>
                              set('purchasePaymentMethod', e.target.value)
                            }
                            className={INPUT_CLS}
                          >
                            <option value="">— none —</option>
                            {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        ) : form.purchasePaymentMethod ? (
                          <span className="mt-1 inline-block rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                            {PAYMENT_METHODS[form.purchasePaymentMethod] ??
                              form.purchasePaymentMethod}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>

                      {/* Receipt Reminder — toggle switch */}
                      <div>
                        <label className={LABEL_CLS}>Receipt Reminder</label>
                        {editMode ? (
                          <div className="flex items-center gap-3 py-1">
                            <button
                              type="button"
                              onClick={() =>
                                set('receiptReminder', !form.receiptReminder)
                              }
                              className={`relative h-5 w-9 rounded-full transition-colors focus:outline-none ${form.receiptReminder ? 'bg-[#b20202]' : 'bg-gray-200'}`}
                            >
                              <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${form.receiptReminder ? 'left-4' : 'left-0.5'}`}
                              />
                            </button>
                            <span className="text-sm text-gray-700">
                              Ask confirmation at receipt
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${form.receiptReminder ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                          >
                            {form.receiptReminder ? <PiCheck /> : <PiX />}
                            {form.receiptReminder ? 'Enabled' : 'Disabled'}
                          </span>
                        )}
                      </div>

                      {/* Supplier Currency */}
                      <Field label="Supplier Currency">
                        {editMode ? (
                          <select
                            value={form.supplierCurrency}
                            onChange={(e) =>
                              set('supplierCurrency', e.target.value)
                            }
                            className={INPUT_CLS}
                          >
                            <option value="NGN">NGN – Nigerian Naira</option>
                            <option value="USD">USD – US Dollar</option>
                            <option value="EUR">EUR – Euro</option>
                            <option value="GBP">GBP – British Pound</option>
                            <option value="AED">AED – UAE Dirham</option>
                            <option value="CNY">CNY – Chinese Yuan</option>
                          </select>
                        ) : (
                          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            <PiCurrencyDollar className="text-amber-500" />
                            {form.supplierCurrency || '—'}
                          </span>
                        )}
                      </Field>

                      {/* Lead Time */}
                      <Field label="Lead Time (days)">
                        {editMode ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={form.leadTime}
                              onChange={(e) => set('leadTime', e.target.value)}
                              placeholder="0"
                              className={`${INPUT_CLS} w-24`}
                            />
                            <span className="text-sm text-gray-500">days</span>
                          </div>
                        ) : form.leadTime ? (
                          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                            {form.leadTime}{' '}
                            {Number(form.leadTime) === 1 ? 'day' : 'days'}
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>

                      {/* Min. Order Qty */}
                      <Field label="Min. Order Qty">
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            value={form.minOrderQty}
                            onChange={(e) => set('minOrderQty', e.target.value)}
                            placeholder="0"
                            className={INPUT_CLS}
                          />
                        ) : form.minOrderQty ? (
                          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                            {form.minOrderQty} units min.
                          </span>
                        ) : (
                          <ReadValue />
                        )}
                      </Field>
                    </div>
                  </div>

                  {/* VENDOR PRICELISTS section */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <PiReceipt className="text-[#b20202]" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Vendor Pricelists
                        </span>
                      </div>
                      <Link
                        href={`/purchases/vendors/${id}/pricelists`}
                        className="text-xs text-[#b20202] hover:underline"
                      >
                        Manage →
                      </Link>
                    </div>
                    <div className="p-4">
                      {vendorPricelists.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          No pricelists for this vendor yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {vendorPricelists.slice(0, 3).map((vpl) => (
                            <div
                              key={vpl._id}
                              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {vpl.name}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {vpl.currency} · {vpl.items?.length ?? 0}{' '}
                                  items
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${vpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                              >
                                {vpl.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          ))}
                          {vendorPricelists.length > 3 && (
                            <Link
                              href={`/purchases/vendors/${id}/pricelists`}
                              className="block text-center text-xs text-[#b20202] hover:underline"
                            >
                              +{vendorPricelists.length - 3} more pricelists
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* FISCAL POSITIONS section */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiScales className="text-[#b20202]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Fiscal Positions
                      </span>
                    </div>
                    <div className="p-4">
                      <Field label="Fiscal Position">
                        {editMode ? (
                          <input
                            value={form.fiscalPosition}
                            onChange={(e) =>
                              set('fiscalPosition', e.target.value)
                            }
                            placeholder="e.g. Tax Exempt, Nigeria VAT"
                            className={INPUT_CLS}
                          />
                        ) : (
                          <ReadValue value={form.fiscalPosition} />
                        )}
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Accounting */}
            {activeTab === 'accounting' && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* ── Left column ── */}
                <div className="space-y-4">
                  {/* BANK ACCOUNTS */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <PiBank className="text-[#b20202]" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Bank Accounts
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setBankAccounts((prev) => [
                            ...prev,
                            {
                              id: Date.now().toString(),
                              accountNumber: '',
                              bankName: '',
                            },
                          ])
                        }
                        className="flex items-center gap-1 text-xs font-medium text-[#b20202] hover:underline"
                      >
                        <PiPlus className="text-sm" /> Add a line
                      </button>
                    </div>

                    {bankAccounts.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <PiBank className="text-2xl text-gray-300" />
                        <p className="text-sm text-gray-400">
                          No bank accounts added
                        </p>
                        <button
                          onClick={() =>
                            setBankAccounts((prev) => [
                              ...prev,
                              {
                                id: Date.now().toString(),
                                accountNumber: '',
                                bankName: '',
                              },
                            ])
                          }
                          className="mt-1 flex items-center gap-1 text-xs text-[#b20202] hover:underline"
                        >
                          <PiPlus /> Add first account
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {bankAccounts.map((ba) => (
                          <div
                            key={ba.id}
                            className="group flex items-center gap-3 px-4 py-3"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
                              <PiBank className="text-blue-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              {editMode ? (
                                <div className="flex gap-2">
                                  <input
                                    value={ba.accountNumber}
                                    onChange={(e) =>
                                      setBankAccounts((prev) =>
                                        prev.map((x) =>
                                          x.id === ba.id
                                            ? {
                                                ...x,
                                                accountNumber: e.target.value,
                                              }
                                            : x
                                        )
                                      )
                                    }
                                    placeholder="Account number"
                                    className={INPUT_CLS}
                                  />
                                  <input
                                    value={ba.bankName}
                                    onChange={(e) =>
                                      setBankAccounts((prev) =>
                                        prev.map((x) =>
                                          x.id === ba.id
                                            ? { ...x, bankName: e.target.value }
                                            : x
                                        )
                                      )
                                    }
                                    placeholder="Bank name"
                                    className={INPUT_CLS}
                                  />
                                </div>
                              ) : (
                                <>
                                  <p className="font-mono text-sm font-medium text-gray-800">
                                    {ba.accountNumber || '—'}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {ba.bankName || '—'}
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {!editMode && ba.accountNumber && (
                                <button className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-[#b20202]/30 hover:text-[#b20202]">
                                  <PiArrowFatLineRight className="text-xs" />{' '}
                                  Send Money
                                </button>
                              )}
                              {editMode && (
                                <button
                                  onClick={() =>
                                    setBankAccounts((prev) =>
                                      prev.filter((x) => x.id !== ba.id)
                                    )
                                  }
                                  className="text-gray-300 hover:text-red-500"
                                >
                                  <PiTrash />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* INVOICE FOLLOW-UPS */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiBell className="text-[#b20202]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Invoice Follow-ups
                      </span>
                    </div>
                    <div className="space-y-2 p-4">
                      {(
                        [
                          {
                            value: 'automatic',
                            label: 'Automatic',
                            desc: 'Reminders are sent automatically on the scheduled date without manual action.',
                          },
                          {
                            value: 'manual',
                            label: 'Manual',
                            desc: 'You decide when to send each reminder — full control over follow-up timing.',
                          },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            editMode && set('invoiceRemindersMode', opt.value)
                          }
                          disabled={!editMode}
                          className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                            form.invoiceRemindersMode === opt.value
                              ? 'border-[#b20202]/30 bg-[#b20202]/5'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                          } ${!editMode ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 ${form.invoiceRemindersMode === opt.value ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'}`}
                            />
                            <span
                              className={`text-sm font-medium ${form.invoiceRemindersMode === opt.value ? 'text-[#b20202]' : 'text-gray-700'}`}
                            >
                              {opt.label}
                            </span>
                          </div>
                          <p className="mt-1 pl-5 text-xs text-gray-400">
                            {opt.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Right column ── */}
                <div className="space-y-4">
                  {/* ACCOUNTING ENTRIES */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiReceipt className="text-[#b20202]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Accounting Entries
                      </span>
                    </div>
                    <div className="space-y-3 p-4">
                      <Field label="Account Receivable">
                        {editMode ? (
                          <select
                            value={form.accountReceivable}
                            onChange={(e) =>
                              set('accountReceivable', e.target.value)
                            }
                            className={INPUT_CLS}
                          >
                            <option value="121000 Account Receivable">
                              121000 · Account Receivable
                            </option>
                            <option value="121100 Account Receivable (Trade)">
                              121100 · Account Receivable (Trade)
                            </option>
                            <option value="121200 Account Receivable (Intercompany)">
                              121200 · Account Receivable (Intercompany)
                            </option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-2 py-1.5">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                              {form.accountReceivable.split(' ')[0]}
                            </span>
                            <span className="text-sm text-gray-700">
                              {form.accountReceivable
                                .split(' ')
                                .slice(1)
                                .join(' ')}
                            </span>
                          </div>
                        )}
                      </Field>
                      <Field label="Account Payable">
                        {editMode ? (
                          <select
                            value={form.accountPayable}
                            onChange={(e) =>
                              set('accountPayable', e.target.value)
                            }
                            className={INPUT_CLS}
                          >
                            <option value="211000 Account Payable">
                              211000 · Account Payable
                            </option>
                            <option value="211100 Account Payable (Trade)">
                              211100 · Account Payable (Trade)
                            </option>
                            <option value="211200 Account Payable (Intercompany)">
                              211200 · Account Payable (Intercompany)
                            </option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-2 py-1.5">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                              {form.accountPayable.split(' ')[0]}
                            </span>
                            <span className="text-sm text-gray-700">
                              {form.accountPayable
                                .split(' ')
                                .slice(1)
                                .join(' ')}
                            </span>
                          </div>
                        )}
                      </Field>
                    </div>
                  </div>

                  {/* AUTOMATION */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiLightning className="text-[#b20202]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Automation
                      </span>
                    </div>
                    <div className="p-4">
                      <label className={LABEL_CLS}>Auto-Post Bills</label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          {
                            value: 'Never',
                            label: 'Never',
                            desc: 'Always manual',
                          },
                          {
                            value: 'Ask after 3 validations without edits',
                            label: 'Ask',
                            desc: 'After 3 validations',
                          },
                          {
                            value: 'Always',
                            label: 'Always',
                            desc: 'Post automatically',
                          },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              editMode && set('autoPostBills', opt.value)
                            }
                            disabled={!editMode}
                            className={`rounded-lg border px-3 py-2.5 text-center transition-colors ${
                              form.autoPostBills === opt.value
                                ? 'border-[#b20202]/30 bg-[#b20202]/5 text-[#b20202]'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                            } ${!editMode ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <p className="text-xs font-semibold">{opt.label}</p>
                            <p className="mt-0.5 text-[10px] leading-tight opacity-70">
                              {opt.desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CREDIT & RECEIVABLE */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                      <PiChartLineUp className="text-[#b20202]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Credit & Receivable
                      </span>
                    </div>
                    <div className="space-y-4 p-4">
                      {/* Outstanding snapshot */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-400">
                            Outstanding Balance
                          </p>
                          <p className="mt-1 text-lg font-bold text-gray-800">
                            {totalSpend > 0
                              ? `₦ ${totalSpend.toLocaleString()}`
                              : '₦ 0'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-400">Total Bills</p>
                          <p className="mt-1 text-lg font-bold text-gray-800">
                            {billCount}
                          </p>
                        </div>
                      </div>

                      {/* Partner credit limit toggle */}
                      <div>
                        <div className="flex items-center justify-between">
                          <label className={LABEL_CLS}>
                            Partner Credit Limit
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              editMode &&
                              set('partnerLimit', !form.partnerLimit)
                            }
                            disabled={!editMode}
                            className={`relative h-5 w-9 rounded-full transition-colors focus:outline-none ${form.partnerLimit ? 'bg-[#b20202]' : 'bg-gray-200'} ${!editMode ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${form.partnerLimit ? 'left-4' : 'left-0.5'}`}
                            />
                          </button>
                        </div>
                        {form.partnerLimit && (
                          <div className="mt-2">
                            {editMode ? (
                              <input
                                value={form.creditLimitAmount}
                                onChange={(e) =>
                                  set('creditLimitAmount', e.target.value)
                                }
                                placeholder="e.g. 500000"
                                type="number"
                                min="0"
                                className={INPUT_CLS}
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-800">
                                ₦{' '}
                                {form.creditLimitAmount
                                  ? Number(
                                      form.creditLimitAmount
                                    ).toLocaleString()
                                  : '0'}
                              </p>
                            )}
                          </div>
                        )}
                        {!form.partnerLimit && (
                          <p className="mt-1 text-xs text-gray-400">
                            Enable to set a credit limit for this vendor
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Internal Notes */}
            {activeTab === 'notes' && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* ── Notes card ── */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                    <PiNotePencil className="text-[#b20202]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Internal Notes
                    </span>
                  </div>
                  <div className="p-4">
                    {editMode ? (
                      <div className="relative">
                        <textarea
                          value={form.notes}
                          onChange={(e) => set('notes', e.target.value)}
                          rows={10}
                          maxLength={2000}
                          placeholder="Add private notes about this vendor — visible only to your team…"
                          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed text-gray-800 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                        />
                        <span className="absolute bottom-3 right-3 text-[10px] text-gray-300">
                          {form.notes.length}/2000
                        </span>
                      </div>
                    ) : form.notes ? (
                      <div className="min-h-[120px]">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                          {form.notes}
                        </p>
                        <p className="mt-3 text-[10px] text-gray-300">
                          {form.notes.length} characters
                        </p>
                      </div>
                    ) : (
                      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                        <PiFileText className="text-3xl text-gray-200" />
                        <p className="text-sm text-gray-400">No notes yet</p>
                        <button
                          onClick={() => setEditMode(true)}
                          className="text-xs text-[#b20202] hover:underline"
                        >
                          Add a note
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Warnings card ── */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                    <PiWarning className="text-[#b20202]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Warnings
                    </span>
                  </div>
                  <div className="px-4 pb-2 pt-3">
                    <p className="mb-4 text-xs text-gray-400">
                      These warnings appear when team members create documents
                      for this vendor.
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          key: 'warningSalesOrder' as const,
                          label: 'Sales Order',
                          icon: <PiShoppingBag />,
                        },
                        {
                          key: 'warningInvoice' as const,
                          label: 'Invoice',
                          icon: <PiReceipt />,
                        },
                        {
                          key: 'warningPurchaseOrder' as const,
                          label: 'Purchase Order',
                          icon: <PiShoppingCart />,
                        },
                        {
                          key: 'warningPicking' as const,
                          label: 'Picking',
                          icon: <PiTruck />,
                        },
                      ].map(({ key, label, icon }) => {
                        const val = form[key];
                        return (
                          <div
                            key={key}
                            className={`rounded-xl border p-3 transition-colors ${val === 'block' ? 'border-red-200 bg-red-50' : val === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}
                          >
                            <div className="mb-2.5 flex items-center gap-2">
                              <span
                                className={`text-base ${val === 'block' ? 'text-red-500' : val === 'warning' ? 'text-amber-500' : 'text-gray-400'}`}
                              >
                                {icon}
                              </span>
                              <span className="text-sm font-medium text-gray-700">
                                {label}
                              </span>
                              {val === 'block' && (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                                  <PiProhibit /> Blocked
                                </span>
                              )}
                              {val === 'warning' && (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  <PiWarning /> Warning
                                </span>
                              )}
                              {!val && (
                                <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-400">
                                  None
                                </span>
                              )}
                            </div>
                            {editMode && (
                              <div className="flex gap-1.5">
                                {[
                                  {
                                    v: '',
                                    label: 'None',
                                    cls:
                                      val === ''
                                        ? 'bg-gray-200 text-gray-700'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                                  },
                                  {
                                    v: 'warning',
                                    label: '⚠ Warn',
                                    cls:
                                      val === 'warning'
                                        ? 'bg-amber-200 text-amber-800'
                                        : 'bg-gray-100 text-gray-500 hover:bg-amber-100',
                                  },
                                  {
                                    v: 'block',
                                    label: '⛔ Block',
                                    cls:
                                      val === 'block'
                                        ? 'bg-red-200 text-red-800'
                                        : 'bg-gray-100 text-gray-500 hover:bg-red-100',
                                  },
                                ].map((opt) => (
                                  <button
                                    key={opt.v}
                                    type="button"
                                    onClick={() => set(key, opt.v)}
                                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${opt.cls}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create / Edit Contact Modal */}
        {showContactModal && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowContactModal(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">
                      {editingContact ? 'Edit Contact' : 'Create Contact'}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {CONTACT_TYPE_META[contactDraft.type ?? 'contact']?.label}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowContactModal(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <PiX className="text-lg" />
                  </button>
                </div>

                {/* Type selector — horizontal pill tabs */}
                <div className="border-b border-gray-100 px-6 py-3">
                  <div className="flex flex-wrap gap-2">
                    {(
                      Object.entries(CONTACT_TYPE_META) as [
                        ContactType,
                        { label: string; cls: string },
                      ][]
                    ).map(([val, meta]) => (
                      <button
                        key={val}
                        onClick={() =>
                          setContactDraft((d) => ({ ...d, type: val }))
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          (contactDraft.type ?? 'contact') === val
                            ? meta.cls + ' ring-2 ring-current ring-offset-1'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="space-y-4 overflow-y-auto px-6 py-5"
                  style={{ maxHeight: '55vh' }}
                >
                  {/* Name + Email row */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Name *">
                      <input
                        value={contactDraft.name ?? ''}
                        onChange={(e) =>
                          setContactDraft((d) => ({
                            ...d,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Full name"
                        className={INPUT_CLS}
                        autoFocus
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        value={contactDraft.email ?? ''}
                        onChange={(e) =>
                          setContactDraft((d) => ({
                            ...d,
                            email: e.target.value,
                          }))
                        }
                        placeholder="email@example.com"
                        className={INPUT_CLS}
                      />
                    </Field>
                  </div>

                  {/* Phone + Mobile row */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Phone">
                      <input
                        value={contactDraft.phone ?? ''}
                        onChange={(e) =>
                          setContactDraft((d) => ({
                            ...d,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="+234 800 000 0000"
                        className={INPUT_CLS}
                      />
                    </Field>
                    <Field label="Mobile">
                      <input
                        value={contactDraft.mobile ?? ''}
                        onChange={(e) =>
                          setContactDraft((d) => ({
                            ...d,
                            mobile: e.target.value,
                          }))
                        }
                        placeholder="+234 800 000 0000"
                        className={INPUT_CLS}
                      />
                    </Field>
                  </div>

                  {/* Address section */}
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Address
                    </p>
                    <div className="space-y-3">
                      <Field label="Street">
                        <input
                          value={contactDraft.street ?? ''}
                          onChange={(e) =>
                            setContactDraft((d) => ({
                              ...d,
                              street: e.target.value,
                            }))
                          }
                          placeholder="Street address"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="City">
                          <input
                            value={contactDraft.city ?? ''}
                            onChange={(e) =>
                              setContactDraft((d) => ({
                                ...d,
                                city: e.target.value,
                              }))
                            }
                            className={INPUT_CLS}
                          />
                        </Field>
                        <Field label="State">
                          <input
                            value={contactDraft.state ?? ''}
                            onChange={(e) =>
                              setContactDraft((d) => ({
                                ...d,
                                state: e.target.value,
                              }))
                            }
                            className={INPUT_CLS}
                          />
                        </Field>
                        <Field label="ZIP">
                          <input
                            value={contactDraft.zip ?? ''}
                            onChange={(e) =>
                              setContactDraft((d) => ({
                                ...d,
                                zip: e.target.value,
                              }))
                            }
                            className={INPUT_CLS}
                          />
                        </Field>
                      </div>
                      <Field label="Country">
                        <input
                          value={contactDraft.country ?? ''}
                          onChange={(e) =>
                            setContactDraft((d) => ({
                              ...d,
                              country: e.target.value,
                            }))
                          }
                          placeholder="e.g. Nigeria"
                          className={INPUT_CLS}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Notes */}
                  <Field label="Notes">
                    <textarea
                      value={contactDraft.notes ?? ''}
                      onChange={(e) =>
                        setContactDraft((d) => ({
                          ...d,
                          notes: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Any additional notes..."
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
                  <button
                    onClick={() => setShowContactModal(false)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => {
                      saveContact();
                      setContactDraft({ type: 'contact' });
                      setEditingContact(null);
                    }}
                    className="rounded-lg border border-[#b20202]/30 bg-[#b20202]/5 px-4 py-2 text-sm font-medium text-[#b20202] hover:bg-[#b20202]/10"
                  >
                    Save & New
                  </button>
                  <button
                    onClick={() => {
                      saveContact();
                      setShowContactModal(false);
                    }}
                    className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-medium text-white hover:bg-[#900000]"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent activity — always rendered */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* ── Recent Purchase Orders ── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <PiShoppingCart className="text-lg text-[#b20202]" />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Purchase Orders
                </p>
                <p className="text-xs text-gray-400">Last 5 · all time</p>
              </div>
            </div>
            <Link
              href={`/purchases?vendor=${id}`}
              className="text-xs font-medium text-[#b20202] hover:underline"
            >
              View all ({poCount}) →
            </Link>
          </div>

          {recentPos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <PiShoppingCart className="text-4xl text-gray-200" />
              <p className="text-sm text-gray-400">No purchase orders yet</p>
              <Link
                href="/purchases/new"
                className="text-xs font-medium text-[#b20202] hover:underline"
              >
                Create first PO →
              </Link>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {recentPos.map((po: any) => {
                  const total =
                    po.totalAmount ??
                    po.total ??
                    (po.items ?? []).reduce(
                      (s: number, i: any) =>
                        s + (i.totalCost ?? i.packPrice * i.packQty ?? 0),
                      0
                    );
                  const date =
                    po.confirmationDate ?? po.orderDate ?? po.createdAt;
                  const statusCls =
                    PO_STATUS_CLS[po.status] ?? 'bg-gray-100 text-gray-500';
                  return (
                    <Link
                      key={po._id}
                      href={`/purchases/${po._id}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-semibold text-gray-800 group-hover:text-[#b20202]">
                          {po.poNumber ??
                            po.orderNumber ??
                            po._id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {date
                            ? new Date(date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                          {po.items?.length
                            ? ` · ${po.items.length} ${po.items.length === 1 ? 'item' : 'items'}`
                            : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusCls}`}
                      >
                        {po.status}
                      </span>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-800">
                          {po.currency ?? 'NGN'}{' '}
                          {Number(total).toLocaleString()}
                        </p>
                      </div>
                      <PiArrowRight className="shrink-0 text-gray-300 transition-colors group-hover:text-[#b20202]" />
                    </Link>
                  );
                })}
              </div>
              {poCount > 5 && (
                <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                  <Link
                    href={`/purchases?vendor=${id}`}
                    className="text-xs text-[#b20202] hover:underline"
                  >
                    +{poCount - 5} more purchase orders →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Recent Vendor Bills ── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <PiReceipt className="text-lg text-[#b20202]" />
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Vendor Bills
                </p>
                <p className="text-xs text-gray-400">Last 5 · all time</p>
              </div>
            </div>
            <Link
              href={`/purchases/bills?vendor=${id}`}
              className="text-xs font-medium text-[#b20202] hover:underline"
            >
              View all ({billCount}) →
            </Link>
          </div>

          {recentBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <PiReceipt className="text-4xl text-gray-200" />
              <p className="text-sm text-gray-400">No bills recorded yet</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {recentBills.map((bill: any) => {
                  const isOverdue =
                    bill.status !== 'paid' &&
                    bill.dueDate &&
                    new Date(bill.dueDate) < new Date();
                  const statusKey = isOverdue ? 'overdue' : bill.status;
                  const statusCls =
                    BILL_STATUS_CLS[statusKey] ?? 'bg-gray-100 text-gray-500';
                  const statusLabel = isOverdue ? 'Overdue' : bill.status;
                  return (
                    <Link
                      key={bill._id}
                      href={`/purchases/bills/${bill._id}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-semibold text-gray-800 group-hover:text-[#b20202]">
                          {bill.billNumber ?? bill._id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {bill.billDate
                            ? new Date(bill.billDate).toLocaleDateString(
                                'en-GB',
                                {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                }
                              )
                            : '—'}
                          {bill.dueDate && (
                            <span
                              className={
                                isOverdue
                                  ? 'ml-1.5 font-medium text-red-500'
                                  : 'ml-1.5'
                              }
                            >
                              · Due{' '}
                              {new Date(bill.dueDate).toLocaleDateString(
                                'en-GB',
                                { day: 'numeric', month: 'short' }
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusCls}`}
                      >
                        {statusLabel}
                      </span>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-800">
                          {bill.currency ?? 'NGN'}{' '}
                          {Number(bill.totalAmount ?? 0).toLocaleString()}
                        </p>
                        {bill.amountDue > 0 && bill.status !== 'paid' && (
                          <p className="text-xs text-red-500">
                            {bill.currency ?? 'NGN'}{' '}
                            {Number(bill.amountDue).toLocaleString()} due
                          </p>
                        )}
                      </div>
                      <PiArrowRight className="shrink-0 text-gray-300 transition-colors group-hover:text-[#b20202]" />
                    </Link>
                  );
                })}
              </div>
              {billCount > 5 && (
                <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                  <Link
                    href={`/purchases/bills?vendor=${id}`}
                    className="text-xs text-[#b20202] hover:underline"
                  >
                    +{billCount - 5} more vendor bills →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
