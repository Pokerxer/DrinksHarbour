'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { posApi } from '@/app/shared/point-of-sale/api';
import type { POSSettings, POSShop } from '@/app/shared/point-of-sale/types';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { PurchaseSettings } from '@/services/purchaseOrder.service';
import toast from 'react-hot-toast';
import {
  PiStorefront,
  PiGear,
  PiMagnifyingGlass,
  PiFloppyDisk,
  PiArrowCounterClockwise,
  PiReceipt,
  PiStar,
  PiPercent,
  PiClock,
  PiCreditCard,
  PiBank,
  PiPlus,
  PiTrash,
  PiTag,
  PiDevices,
  PiPackage,
  PiChefHat,
  PiX,
  PiUser,
  PiShoppingBag,
  PiShieldCheck,
  PiCurrencyDollar,
  PiArrowUUpLeft,
  PiWarning,
} from 'react-icons/pi';

// ── helpers ───────────────────────────────────────────────────────────────────

function objDirty<T extends object>(a: T, b: T) {
  return JSON.stringify(a) !== JSON.stringify(b);
}
function arrDirty(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort());
}

// ── types ─────────────────────────────────────────────────────────────────────

type PosState = {
  isBarRestaurant: boolean;
  autoValidateOrder: boolean;
  cashRounding: boolean;
  maxDifferenceEnabled: boolean;
  tipsEnabled: boolean;
  loginWithEmployees: boolean;
  largeScrollbars: boolean;
  shareOpenOrders: boolean;
  hidePictures: boolean;
  showProductImages: boolean;
  showCategoryImages: boolean;
  restrictCategories: boolean;
  showMarginsAndCosts: boolean;
  sortCartByCategory: boolean;
  flexiblePricelists: boolean;
  priceControl: boolean;
  productPriceDisplay: 'tax_excluded' | 'tax_included';
  lineDiscounts: boolean;
  globalDiscounts: boolean;
  promotionsEnabled: boolean;
  allowOverselling: boolean;
  maxDiscountPct: number;
  requireOpeningCash: boolean;
  loyaltyEnabled: boolean;
  loyaltyPointsPerNaira: number;
  loyaltyPointsValue: number;
  loyaltyMaxRedemptionPct: number;
  receiptHeader: string;
  receiptFooter: string;
  showTaxOnReceipt: boolean;
  taxRate: number;
  autoPrintReceipt: boolean;
  receiptCopies: number;
  smsReceiptEnabled: boolean;
  selfServiceInvoicing: boolean;
  basicReceipt: boolean;
  whatsappReceiptEnabled: boolean;
  eposPrinter: boolean;
  customerDisplay: boolean;
  iotBox: boolean;
  preparationPrinters: boolean;
  preparationDisplay: boolean;
  internalNotes: boolean;
  allowShipLater: boolean;
  barcodes: boolean;
  // Customers
  requireCustomer: boolean;
  showLoyaltyBalanceAtCheckout: boolean;
  customerPhoneSearch: boolean;
  // Order management
  allowOrderNotes: boolean;
  holdOrders: boolean;
  splitPayments: boolean;
  minimumOrderAmount: number;
  // Refunds & returns
  allowRefunds: boolean;
  refundWindowDays: number;
  requireManagerApprovalForRefund: boolean;
  defaultRestockOnRefund: boolean;
  // Security
  sessionTimeoutMins: number;
  requirePINOnUnlock: boolean;
  requireManagerPINForDiscount: boolean;
  // Currency
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  decimalPlaces: number;
  // Receipt extras
  showCashierName: boolean;
  showOrderNumber: boolean;
  receiptNumberPrefix: string;
};

type BankAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

const D_POS: PosState = {
  isBarRestaurant: false,
  autoValidateOrder: false,
  cashRounding: false,
  maxDifferenceEnabled: false,
  tipsEnabled: false,
  loginWithEmployees: false,
  largeScrollbars: false,
  shareOpenOrders: false,
  hidePictures: false,
  showProductImages: true,
  showCategoryImages: true,
  restrictCategories: false,
  showMarginsAndCosts: false,
  sortCartByCategory: false,
  flexiblePricelists: false,
  priceControl: false,
  productPriceDisplay: 'tax_included',
  lineDiscounts: true,
  globalDiscounts: false,
  promotionsEnabled: true,
  allowOverselling: false,
  maxDiscountPct: 100,
  requireOpeningCash: false,
  loyaltyEnabled: false,
  loyaltyPointsPerNaira: 0.01,
  loyaltyPointsValue: 1,
  loyaltyMaxRedemptionPct: 50,
  receiptHeader: '',
  receiptFooter: '',
  showTaxOnReceipt: false,
  taxRate: 7.5,
  autoPrintReceipt: false,
  receiptCopies: 1,
  smsReceiptEnabled: false,
  selfServiceInvoicing: false,
  basicReceipt: false,
  whatsappReceiptEnabled: false,
  eposPrinter: false,
  customerDisplay: false,
  iotBox: false,
  preparationPrinters: false,
  preparationDisplay: false,
  internalNotes: false,
  allowShipLater: false,
  barcodes: false,
  requireCustomer: false,
  showLoyaltyBalanceAtCheckout: true,
  customerPhoneSearch: true,
  allowOrderNotes: true,
  holdOrders: false,
  splitPayments: false,
  minimumOrderAmount: 0,
  allowRefunds: true,
  refundWindowDays: 30,
  requireManagerApprovalForRefund: false,
  defaultRestockOnRefund: true,
  sessionTimeoutMins: 0,
  requirePINOnUnlock: true,
  requireManagerPINForDiscount: false,
  currencySymbol: '₦',
  currencyPosition: 'before',
  decimalPlaces: 2,
  showCashierName: true,
  showOrderNumber: true,
  receiptNumberPrefix: '',
};

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card / POS' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'mobile_money', label: 'Mobile Money' },
];

const PAYMENT_TERMINALS = [
  {
    id: 'adyen',
    label: 'Adyen',
    sub: 'Accept payments with an Adyen payment terminal',
  },
  {
    id: 'stripe',
    label: 'Stripe',
    sub: 'Accept payments with a Stripe payment terminal',
  },
  {
    id: 'six',
    label: 'Six',
    sub: 'Accept payments with a Six payment terminal',
  },
  {
    id: 'viva_wallet',
    label: 'Viva Wallet',
    sub: 'Accept payments via Viva Wallet — terminal or tap on phone',
  },
  {
    id: 'paytm',
    label: 'PaytM',
    sub: 'Accept payments with a PaytM payment terminal',
  },
  {
    id: 'razorpay',
    label: 'Razorpay',
    sub: 'Accept payments with a Razorpay payment terminal',
  },
  {
    id: 'mercado_pago',
    label: 'Mercado Pago',
    sub: 'Accept payments with Mercado Pago on a terminal',
  },
];

// ── primitive components ──────────────────────────────────────────────────────

function Cb({
  checked,
  onChange,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
        checked ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300 bg-white'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {checked && (
        <svg
          width="10"
          height="8"
          viewBox="0 0 10 8"
          fill="none"
          className="pointer-events-none"
        >
          <path
            d="M1 4l2.5 2.5L9 1"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

function Sk({ w = 'w-full', h = 'h-5' }: { w?: string; h?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-100 ${w} ${h}`} />;
}

function SectionCard({
  id,
  icon,
  title,
  note,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#b20202]/10 text-[#b20202]">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {note && <span className="ml-auto text-xs text-gray-400">{note}</span>}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function CbRow({
  label,
  sub,
  checked,
  onChange,
  indent,
  disabled,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  indent?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div
      className={`flex cursor-pointer select-none items-center justify-between gap-6 py-3.5 pr-6 transition-colors ${
        indent
          ? 'bg-gray-50/60 pl-14 hover:bg-gray-100/70'
          : 'pl-6 hover:bg-gray-50'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <p className="text-[13.5px] text-gray-800">{label}</p>
        {sub && (
          <p className="mt-0.5 text-xs leading-snug text-gray-400">{sub}</p>
        )}
      </label>
      <Cb id={id} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Row({
  label,
  sub,
  children,
  indent,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-6 py-3.5 pr-6 ${
        indent ? 'bg-gray-50/60 pl-14' : 'pl-6'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[13.5px] text-gray-800">{label}</p>
        {sub && (
          <p className="mt-0.5 text-xs leading-snug text-gray-400">{sub}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-colors focus-within:border-[#b20202] focus-within:ring-2 focus-within:ring-[#b20202]/20">
      {prefix && (
        <span className="flex select-none items-center border-r border-gray-100 bg-gray-50 px-3 text-sm font-medium text-gray-500">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 bg-transparent px-3 py-1.5 text-right text-sm text-gray-900 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && (
        <span className="flex select-none items-center border-l border-gray-100 bg-gray-50 px-3 text-xs font-medium text-gray-400">
          {suffix}
        </span>
      )}
    </div>
  );
}

function TextRow({
  label,
  sub,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  sub?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 pl-6 pr-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] text-gray-800">{label}</p>
        {sub && (
          <p className="mt-0.5 text-xs leading-snug text-gray-400">{sub}</p>
        )}
      </div>
      <div className="relative w-full max-w-xs shrink-0">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 pb-6 pt-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
        />
        {maxLength && (
          <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] tabular-nums text-gray-300">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

function RadioRow({
  label,
  sub,
  name,
  value,
  checked,
  onChange,
}: {
  label: string;
  sub?: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div
      className="flex cursor-pointer items-center gap-3 bg-gray-50/60 py-3 pl-14 pr-6 hover:bg-gray-100/70"
      onClick={() => onChange(value)}
    >
      <div
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
          checked ? 'border-[#b20202]' : 'border-gray-300 bg-white'
        }`}
      >
        <input
          id={id}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          className="sr-only"
        />
        {checked && <div className="h-2 w-2 rounded-full bg-[#b20202]" />}
      </div>
      <label htmlFor={id} className="cursor-pointer">
        <p className="text-[13.5px] text-gray-800">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      </label>
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-300 transition-colors focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

function BankRow({
  account,
  onRemove,
  onChange,
}: {
  account: BankAccount;
  onRemove: () => void;
  onChange: (f: keyof BankAccount, v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2.5 px-6 py-2.5">
      {(
        [
          ['bankName', 'Bank name', 'text'],
          ['accountNumber', 'Account number', 'text'],
          ['accountName', 'Account name (optional)', 'text'],
        ] as [keyof BankAccount, string, string][]
      ).map(([field, ph]) => (
        <input
          key={field}
          value={account[field]}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={ph}
          className={INPUT_CLS}
        />
      ))}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <PiTrash size={15} />
      </button>
    </div>
  );
}

function TextInput({
  label,
  sub,
  value,
  onChange,
  placeholder,
  maxLength,
  width = 'w-44',
  indent,
}: {
  label: string;
  sub?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  width?: string;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-6 py-3.5 pr-6 ${
        indent ? 'bg-gray-50/60 pl-14' : 'pl-6'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[13.5px] text-gray-800">{label}</p>
        {sub && (
          <p className="mt-0.5 text-xs leading-snug text-gray-400">{sub}</p>
        )}
      </div>
      <div className="relative shrink-0">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`${width} rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20`}
        />
        {maxLength && value.length > 0 && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-gray-300">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Custom Dropdown ───────────────────────────────────────────────────────────

function Dropdown({
  value,
  onChange,
  options,
  width = 'w-56',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative shrink-0 ${width}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-1.5 text-left text-sm shadow-sm transition-all ${
          open
            ? 'border-[#b20202] ring-2 ring-[#b20202]/20'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className="truncate text-gray-900">
          {selected?.label ?? value}
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          className={`shrink-0 text-gray-400 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        >
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors ${
                  active
                    ? 'bg-[#b20202]/5 font-medium text-[#b20202]'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{o.label}</span>
                {active && (
                  <svg
                    width="12"
                    height="10"
                    viewBox="0 0 12 10"
                    fill="none"
                    className="shrink-0"
                  >
                    <path
                      d="M1 5l3.5 3.5L11 1"
                      stroke="#b20202"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SelectRow({
  label,
  sub,
  value,
  onChange,
  options,
  indent,
}: {
  label: string;
  sub?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-6 py-3.5 pr-6 ${
        indent ? 'bg-gray-50/60 pl-14' : 'pl-6'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[13.5px] text-gray-800">{label}</p>
        {sub && (
          <p className="mt-0.5 text-xs leading-snug text-gray-400">{sub}</p>
        )}
      </div>
      <Dropdown value={value} onChange={onChange} options={options} />
    </div>
  );
}

// ── sidebar data ──────────────────────────────────────────────────────────────

const MODULES = [
  { id: 'general', label: 'General Settings', icon: <PiGear size={16} /> },
  {
    id: 'point_of_sale',
    label: 'Point of Sale',
    icon: <PiStorefront size={16} />,
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: <PiShoppingBag size={16} />,
  },
] as const;

type ModuleId = (typeof MODULES)[number]['id'];

const POS_ANCHORS = [
  {
    id: 'pos_shops',
    label: 'Shops',
    icon: <PiStorefront size={12} />,
  },
  {
    id: 'pos_restaurant',
    label: 'Restaurant Mode',
    icon: <PiStorefront size={12} />,
  },
  { id: 'pos_payment', label: 'Payment', icon: <PiCreditCard size={12} /> },
  { id: 'pos_interface', label: 'POS Interface', icon: <PiGear size={12} /> },
  {
    id: 'pos_categories',
    label: 'Product & Categories',
    icon: <PiTag size={12} />,
  },
  { id: 'pos_pricing', label: 'Pricing', icon: <PiPercent size={12} /> },
  { id: 'pos_sales', label: 'Sales', icon: <PiPercent size={12} /> },
  { id: 'pos_sessions', label: 'Sessions', icon: <PiClock size={12} /> },
  { id: 'pos_loyalty', label: 'Loyalty Programme', icon: <PiStar size={12} /> },
  {
    id: 'pos_receipt',
    label: 'Bills & Receipts',
    icon: <PiReceipt size={12} />,
  },
  {
    id: 'pos_terminals',
    label: 'Payment Terminals',
    icon: <PiCreditCard size={12} />,
  },
  {
    id: 'pos_devices',
    label: 'Connected Devices',
    icon: <PiDevices size={12} />,
  },
  { id: 'pos_prep', label: 'Preparation', icon: <PiChefHat size={12} /> },
  { id: 'pos_inventory', label: 'Inventory', icon: <PiPackage size={12} /> },
  { id: 'pos_customers', label: 'Customers', icon: <PiUser size={12} /> },
  {
    id: 'pos_orders',
    label: 'Order Management',
    icon: <PiShoppingBag size={12} />,
  },
  {
    id: 'pos_refunds',
    label: 'Refunds & Returns',
    icon: <PiArrowUUpLeft size={12} />,
  },
  { id: 'pos_security', label: 'Security', icon: <PiShieldCheck size={12} /> },
  {
    id: 'pos_currency',
    label: 'Currency',
    icon: <PiCurrencyDollar size={12} />,
  },
  { id: 'pos_banks', label: 'Bank Accounts', icon: <PiBank size={12} /> },
];

const PURCHASE_ANCHORS = [
  {
    id: 'purch_orders',
    label: 'Orders & Approval',
    icon: <PiShoppingBag size={12} />,
  },
  { id: 'purch_billing', label: 'Billing', icon: <PiReceipt size={12} /> },
  {
    id: 'purch_defaults',
    label: 'Defaults',
    icon: <PiCurrencyDollar size={12} />,
  },
];

const D_PURCH: PurchaseSettings = {
  requirePOApproval: true,
  lockConfirmedOrders: false,
  defaultBillControlPolicy: 'received',
  rfqValidityDays: 30,
  defaultCurrency: 'NGN',
  defaultLeadTimeDays: 7,
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [activeModule, setActiveModule] = useState<ModuleId>('point_of_sale');
  const [activeAnchor, setActiveAnchor] = useState('');
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<PosState>(D_POS);
  const [savedPos, setSavedPos] = useState<PosState>(D_POS);
  const [methods, setMethods] = useState<string[]>([
    'cash',
    'card',
    'bank_transfer',
    'mobile_money',
  ]);
  const [savedMethods, setSavedMethods] = useState<string[]>([
    'cash',
    'card',
    'bank_transfer',
    'mobile_money',
  ]);
  const [terminals, setTerminals] = useState<string[]>([]);
  const [savedTerminals, setSavedTerminals] = useState<string[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [savedBanks, setSavedBanks] = useState<BankAccount[]>([]);
  const [purch, setPurch] = useState<PurchaseSettings>(D_PURCH);
  const [savedPurch, setSavedPurch] = useState<PurchaseSettings>(D_PURCH);
  const [shops, setShops] = useState<POSShop[]>([]);
  const [shopForm, setShopForm] = useState({
    name: '',
    mode: 'retail' as 'retail' | 'wholesale',
    color: '#b20202',
    description: '',
  });
  const [shopFormOpen, setShopFormOpen] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const dirty =
    objDirty(pos, savedPos) ||
    arrDirty(methods, savedMethods) ||
    arrDirty(terminals, savedTerminals) ||
    JSON.stringify(banks) !== JSON.stringify(savedBanks) ||
    objDirty(purch, savedPurch);

  // ── intersection observer for sidebar active anchor ───────────────────────
  useEffect(() => {
    if (activeModule !== 'point_of_sale' && activeModule !== 'purchases')
      return;
    const anchors =
      activeModule === 'purchases' ? PURCHASE_ANCHORS : POS_ANCHORS;
    const ids = anchors.map((a) => a.id);
    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // pick the topmost visible
          const top = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          setActiveAnchor(top.target.id);
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );
    els.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, [activeModule, loading]);

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [settingsRes, banksRes, shopsRes, purchRes] = await Promise.all([
          posApi.getPOSSettings(token),
          posApi.getBankAccounts(token),
          posApi.listShops(token).catch(() => ({ shops: [] })),
          purchaseOrderService.getPurchaseSettings(token).catch(() => null),
        ]);
        if (purchRes?.data?.purchaseSettings) {
          const p = { ...D_PURCH, ...purchRes.data.purchaseSettings };
          setPurch(p);
          setSavedPurch({ ...p });
        }
        const s = settingsRes.posSettings ?? {};
        const loaded: PosState = {
          isBarRestaurant: s.isBarRestaurant ?? false,
          autoValidateOrder: s.autoValidateOrder ?? false,
          cashRounding: s.cashRounding ?? false,
          maxDifferenceEnabled: s.maxDifferenceEnabled ?? false,
          tipsEnabled: s.tipsEnabled ?? false,
          loginWithEmployees: s.loginWithEmployees ?? false,
          largeScrollbars: s.largeScrollbars ?? false,
          shareOpenOrders: s.shareOpenOrders ?? false,
          hidePictures: s.hidePictures ?? false,
          showProductImages: s.showProductImages ?? true,
          showCategoryImages: s.showCategoryImages ?? true,
          restrictCategories: s.restrictCategories ?? false,
          showMarginsAndCosts: s.showMarginsAndCosts ?? false,
          sortCartByCategory: s.sortCartByCategory ?? false,
          flexiblePricelists: s.flexiblePricelists ?? false,
          priceControl: s.priceControl ?? false,
          productPriceDisplay:
            (s.productPriceDisplay as PosState['productPriceDisplay']) ??
            'tax_included',
          lineDiscounts: s.lineDiscounts ?? true,
          globalDiscounts: s.globalDiscounts ?? false,
          promotionsEnabled: s.promotionsEnabled ?? true,
          allowOverselling: s.allowOverselling ?? false,
          maxDiscountPct: s.maxDiscountPct ?? 100,
          requireOpeningCash: s.requireOpeningCash ?? false,
          loyaltyEnabled: s.loyaltyEnabled ?? false,
          loyaltyPointsPerNaira: s.loyaltyPointsPerNaira ?? 0.01,
          loyaltyPointsValue: s.loyaltyPointsValue ?? 1,
          loyaltyMaxRedemptionPct: s.loyaltyMaxRedemptionPct ?? 50,
          receiptHeader: s.receiptHeader ?? '',
          receiptFooter: s.receiptFooter ?? '',
          showTaxOnReceipt: s.showTaxOnReceipt ?? false,
          taxRate: s.taxRate ?? 7.5,
          autoPrintReceipt: s.autoPrintReceipt ?? false,
          receiptCopies: s.receiptCopies ?? 1,
          smsReceiptEnabled: s.smsReceiptEnabled ?? false,
          selfServiceInvoicing: s.selfServiceInvoicing ?? false,
          basicReceipt: s.basicReceipt ?? false,
          whatsappReceiptEnabled: s.whatsappReceiptEnabled ?? false,
          eposPrinter: s.eposPrinter ?? false,
          customerDisplay: s.customerDisplay ?? false,
          iotBox: s.iotBox ?? false,
          preparationPrinters: s.preparationPrinters ?? false,
          preparationDisplay: s.preparationDisplay ?? false,
          internalNotes: s.internalNotes ?? false,
          allowShipLater: s.allowShipLater ?? false,
          barcodes: s.barcodes ?? false,
          requireCustomer: s.requireCustomer ?? false,
          showLoyaltyBalanceAtCheckout: s.showLoyaltyBalanceAtCheckout ?? true,
          customerPhoneSearch: s.customerPhoneSearch ?? true,
          allowOrderNotes: s.allowOrderNotes ?? true,
          holdOrders: s.holdOrders ?? false,
          splitPayments: s.splitPayments ?? false,
          minimumOrderAmount: s.minimumOrderAmount ?? 0,
          allowRefunds: s.allowRefunds ?? true,
          refundWindowDays: s.refundWindowDays ?? 30,
          requireManagerApprovalForRefund:
            s.requireManagerApprovalForRefund ?? false,
          defaultRestockOnRefund: s.defaultRestockOnRefund ?? true,
          sessionTimeoutMins: s.sessionTimeoutMins ?? 0,
          requirePINOnUnlock: s.requirePINOnUnlock ?? true,
          requireManagerPINForDiscount: s.requireManagerPINForDiscount ?? false,
          currencySymbol: s.currencySymbol ?? '₦',
          currencyPosition:
            (s.currencyPosition as PosState['currencyPosition']) ?? 'before',
          decimalPlaces: s.decimalPlaces ?? 2,
          showCashierName: s.showCashierName ?? true,
          showOrderNumber: s.showOrderNumber ?? true,
          receiptNumberPrefix: s.receiptNumberPrefix ?? '',
        };
        setPos(loaded);
        setSavedPos({ ...loaded });

        const m = s.enabledPaymentMethods ?? [
          'cash',
          'card',
          'bank_transfer',
          'mobile_money',
        ];
        setMethods(m);
        setSavedMethods([...m]);

        const t = s.enabledPaymentTerminals ?? [];
        setTerminals(t);
        setSavedTerminals([...t]);

        const b = (banksRes.bankAccounts ?? []).map((a) => ({
          bankName: a.bankName ?? '',
          accountNumber: a.accountNumber ?? '',
          accountName: a.accountName ?? '',
        }));
        setBanks(b);
        setSavedBanks(b.map((x) => ({ ...x })));
        setShops(shopsRes.shops ?? []);
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Sync the active module with the URL hash, including back/forward
  // navigation and external links like /settings#purchases
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '') as ModuleId;
      if (MODULES.some((m) => m.id === hash)) setActiveModule(hash);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // ── save / discard ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!token || !dirty) return;
    setSaving(true);
    try {
      const posSettings: POSSettings = {
        ...pos,
        enabledPaymentMethods: methods,
        enabledPaymentTerminals: terminals,
      };
      await posApi.updatePOSSettings(token, posSettings);
      await posApi.updateBankAccounts(token, banks);
      if (objDirty(purch, savedPurch)) {
        await purchaseOrderService.updatePurchaseSettings(token, purch);
        setSavedPurch({ ...purch });
      }
      setSavedPos({ ...pos });
      setSavedMethods([...methods]);
      setSavedTerminals([...terminals]);
      setSavedBanks(banks.map((b) => ({ ...b })));
      toast.success('Settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setPos({ ...savedPos });
    setMethods([...savedMethods]);
    setTerminals([...savedTerminals]);
    setBanks(savedBanks.map((b) => ({ ...b })));
    setPurch({ ...savedPurch });
  }

  function setPurchField<K extends keyof PurchaseSettings>(
    k: K,
    v: PurchaseSettings[K]
  ) {
    setPurch((p) => ({ ...p, [k]: v }));
  }

  function setField<K extends keyof PosState>(k: K, v: PosState[K]) {
    setPos((p) => ({ ...p, [k]: v }));
  }

  function toggleTerminal(id: string) {
    setTerminals((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addBank() {
    setBanks((prev) => [
      ...prev,
      { bankName: '', accountNumber: '', accountName: '' },
    ]);
  }
  function removeBank(i: number) {
    setBanks((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateBank(i: number, field: keyof BankAccount, value: string) {
    setBanks((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b))
    );
  }

  async function handleCreateShop(e: React.FormEvent) {
    e.preventDefault();
    if (!shopForm.name.trim()) {
      setShopError('Name is required');
      return;
    }
    setShopSaving(true);
    setShopError('');
    try {
      const { shop } = await posApi.createShop(token, shopForm);
      setShops((prev) => [...prev, shop]);
      setShopForm({
        name: '',
        mode: 'retail',
        color: '#b20202',
        description: '',
      });
      setShopFormOpen(false);
      toast.success('Shop created');
    } catch (err: unknown) {
      setShopError(
        err instanceof Error ? err.message : 'Failed to create shop'
      );
    } finally {
      setShopSaving(false);
    }
  }

  async function handleDeleteShop(shopId: string) {
    try {
      await posApi.deleteShop(token, shopId);
      setShops((prev) => prev.filter((s) => s._id !== shopId));
      toast.success('Shop removed');
    } catch {
      toast.error('Failed to remove shop');
    }
  }

  function selectModule(id: ModuleId) {
    setActiveModule(id);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function scrollTo(anchor: string) {
    document
      .getElementById(anchor)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const q = search.toLowerCase();
  function vis(...terms: string[]) {
    return !q || terms.some((t) => t.toLowerCase().includes(q));
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="sticky top-0 h-screen w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
        <div className="px-3 pb-2 pt-5">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Modules
          </p>
          {MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => selectModule(m.id)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-all ${
                activeModule === m.id
                  ? 'bg-[#b20202]/8 font-semibold text-[#b20202]'
                  : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                  activeModule === m.id
                    ? 'bg-[#b20202]/15 text-[#b20202]'
                    : 'text-gray-400'
                }`}
              >
                {m.icon}
              </span>
              {m.label}
            </button>
          ))}
        </div>

        {(activeModule === 'point_of_sale' || activeModule === 'purchases') && (
          <div className="mt-3 border-t border-gray-100 px-3 pb-6 pt-4">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Jump to
            </p>
            {(activeModule === 'purchases'
              ? PURCHASE_ANCHORS
              : POS_ANCHORS
            ).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => scrollTo(a.id)}
                className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  activeAnchor === a.id
                    ? 'bg-[#b20202]/8 font-medium text-[#b20202]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <span
                  className={`shrink-0 transition-colors ${
                    activeAnchor === a.id ? 'text-[#b20202]' : 'text-gray-300'
                  }`}
                >
                  {a.icon}
                </span>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-200">
            <PiMagnifyingGlass size={15} className="shrink-0 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings…"
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <PiX size={14} />
              </button>
            )}
          </div>
          {dirty && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <PiArrowCounterClockwise size={14} />
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9a0202] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PiFloppyDisk size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Page heading */}
        <div className="border-b border-gray-100 bg-white px-8 py-5">
          <div className="flex items-center gap-3">
            <h1 className="text-[17px] font-semibold text-gray-900">
              {activeModule === 'general'
                ? 'General Settings'
                : activeModule === 'purchases'
                  ? 'Purchases'
                  : 'Point of Sale'}
            </h1>
            {dirty && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            )}
          </div>
          {activeModule === 'point_of_sale' && (
            <p className="mt-0.5 text-xs text-gray-400">
              Configure your POS terminals, payment methods, and customer
              experience.
            </p>
          )}
          {activeModule === 'purchases' && (
            <p className="mt-0.5 text-xs text-gray-400">
              Configure approval, billing, and defaults for the purchase
              workflow.
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeModule === 'general' && (
            <div className="px-8 py-10 text-sm text-gray-400">
              General settings will appear here.
            </div>
          )}

          {activeModule === 'purchases' && !loading && (
            <div className="mx-auto max-w-3xl space-y-3 px-6 py-6">
              {vis('purchase order approval confirm lock rfq quotation') && (
                <SectionCard
                  id="purch_orders"
                  icon={<PiShoppingBag size={16} />}
                  title="Orders & Approval"
                >
                  <CbRow
                    label="Require PO approval"
                    sub="New purchase orders must be approved before they can be confirmed. Turn off to let admins confirm directly."
                    checked={purch.requirePOApproval}
                    onChange={(v) => setPurchField('requirePOApproval', v)}
                  />
                  <CbRow
                    label="Lock orders on confirmation"
                    sub="Automatically lock confirmed purchase orders against further edits."
                    checked={purch.lockConfirmedOrders}
                    onChange={(v) => setPurchField('lockConfirmedOrders', v)}
                  />
                  <Row
                    label="Quotation validity"
                    sub="Default expiry window for new RFQs. Set 0 to disable."
                  >
                    <NumInput
                      value={purch.rfqValidityDays}
                      onChange={(v) =>
                        setPurchField(
                          'rfqValidityDays',
                          Math.min(365, Math.max(0, Math.round(v)))
                        )
                      }
                      min={0}
                      max={365}
                      suffix="days"
                    />
                  </Row>
                  <Row
                    label="Default lead time"
                    sub="Expected days from order to delivery, used as the default on agreement lines."
                  >
                    <NumInput
                      value={purch.defaultLeadTimeDays}
                      onChange={(v) =>
                        setPurchField(
                          'defaultLeadTimeDays',
                          Math.min(365, Math.max(0, Math.round(v)))
                        )
                      }
                      min={0}
                      max={365}
                      suffix="days"
                    />
                  </Row>
                </SectionCard>
              )}

              {vis('bill billing control policy ordered received') && (
                <SectionCard
                  id="purch_billing"
                  icon={<PiReceipt size={16} />}
                  title="Billing"
                >
                  <Row
                    label="Bill control policy"
                    sub="Default quantities used when creating a vendor bill from a PO. Can be overridden per bill."
                  >
                    <span />
                  </Row>
                  <RadioRow
                    label="Received quantities"
                    sub="Bill only what has actually been received"
                    name="purch_bill_policy"
                    value="received"
                    checked={purch.defaultBillControlPolicy === 'received'}
                    onChange={() =>
                      setPurchField('defaultBillControlPolicy', 'received')
                    }
                  />
                  <RadioRow
                    label="Ordered quantities"
                    sub="Bill the full ordered quantities, even before receipt"
                    name="purch_bill_policy"
                    value="ordered"
                    checked={purch.defaultBillControlPolicy === 'ordered'}
                    onChange={() =>
                      setPurchField('defaultBillControlPolicy', 'ordered')
                    }
                  />
                </SectionCard>
              )}

              {vis('currency naira dollar default') && (
                <SectionCard
                  id="purch_defaults"
                  icon={<PiCurrencyDollar size={16} />}
                  title="Defaults"
                >
                  <Row
                    label="Default currency"
                    sub="Pre-selected currency for new purchase orders and agreements."
                  >
                    <select
                      value={purch.defaultCurrency}
                      onChange={(e) =>
                        setPurchField('defaultCurrency', e.target.value)
                      }
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                    >
                      {['NGN', 'USD', 'EUR', 'GBP'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Row>
                </SectionCard>
              )}
            </div>
          )}

          {activeModule === 'point_of_sale' &&
            (loading ? (
              <div className="mx-auto max-w-3xl space-y-3 px-6 py-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
                      <Sk w="w-8" h="h-8" />
                      <Sk w="w-40" h="h-4" />
                    </div>
                    {Array.from({ length: 2 }).map((_, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between px-6 py-3.5"
                      >
                        <div className="space-y-1.5">
                          <Sk w="w-52" h="h-3.5" />
                          <Sk w="w-72" h="h-3" />
                        </div>
                        <Sk w="w-4" h="h-4" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-3 px-6 py-6">
                {/* ── Shops ──────────────────────────────────────────────── */}
                {vis('shop retail wholesale terminal create new') && (
                  <SectionCard
                    id="pos_shops"
                    icon={<PiStorefront size={16} />}
                    title="Shops"
                    note="Each shop is an independent POS terminal. Retail and Wholesale are built-in."
                  >
                    {/* Built-in shops */}
                    <div className="px-6 pb-2 pt-1">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Built-in
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            name: 'RETAIL',
                            mode: 'retail',
                            color: '#f97316',
                            desc: 'Front-counter sales',
                          },
                          {
                            name: 'WHOLESALE',
                            mode: 'wholesale',
                            color: '#0ea5e9',
                            desc: 'Bulk & account orders',
                          },
                        ].map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ background: s.color }}
                            />
                            <div>
                              <p className="text-xs font-bold text-gray-700">
                                {s.name}
                              </p>
                              <p className="text-[11px] capitalize text-gray-400">
                                {s.mode} · {s.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Custom shops */}
                    {shops.length > 0 && (
                      <div className="px-6 pb-2 pt-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          Custom
                        </p>
                        <div className="space-y-2">
                          {shops.map((shop) => (
                            <div
                              key={shop._id}
                              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3"
                            >
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ background: shop.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase text-gray-700">
                                  {shop.name}
                                </p>
                                <p className="text-[11px] capitalize text-gray-400">
                                  {shop.mode} ·{' '}
                                  {shop.description || 'No description'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteShop(shop._id)}
                                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <PiTrash className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Create form toggle */}
                    <div className="border-t border-gray-50 px-6 py-4">
                      {!shopFormOpen ? (
                        <button
                          type="button"
                          onClick={() => setShopFormOpen(true)}
                          className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-[#b20202] transition-colors hover:border-[#b20202] hover:bg-[#fef2f2]"
                        >
                          <PiPlus className="h-4 w-4" />
                          New Shop
                        </button>
                      ) : (
                        <form
                          onSubmit={handleCreateShop}
                          className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">
                              Create Shop
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setShopFormOpen(false);
                                setShopError('');
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <PiX className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Name
                              </label>
                              <input
                                value={shopForm.name}
                                onChange={(e) =>
                                  setShopForm((f) => ({
                                    ...f,
                                    name: e.target.value,
                                  }))
                                }
                                placeholder="e.g. DRIVE-THRU"
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Type
                              </label>
                              <div className="flex gap-2">
                                {(['retail', 'wholesale'] as const).map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() =>
                                      setShopForm((f) => ({ ...f, mode: m }))
                                    }
                                    className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-colors ${
                                      shopForm.mode === m
                                        ? 'border-[#b20202] bg-white text-[#b20202]'
                                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                    }`}
                                  >
                                    {m}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Color
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={shopForm.color}
                                  onChange={(e) =>
                                    setShopForm((f) => ({
                                      ...f,
                                      color: e.target.value,
                                    }))
                                  }
                                  className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                                />
                                <span className="font-mono text-xs text-gray-500">
                                  {shopForm.color}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-600">
                                Description{' '}
                                <span className="font-normal text-gray-400">
                                  (optional)
                                </span>
                              </label>
                              <input
                                value={shopForm.description}
                                onChange={(e) =>
                                  setShopForm((f) => ({
                                    ...f,
                                    description: e.target.value,
                                  }))
                                }
                                placeholder="Short description"
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                              />
                            </div>
                          </div>

                          {shopError && (
                            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                              {shopError}
                            </p>
                          )}

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShopFormOpen(false);
                                setShopError('');
                              }}
                              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={shopSaving || !shopForm.name.trim()}
                              className="rounded-lg bg-[#b20202] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9a0101] disabled:opacity-50"
                            >
                              {shopSaving ? 'Creating…' : 'Create'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* Restaurant Mode */}
                {vis('restaurant bar mode table kitchen') && (
                  <SectionCard
                    id="pos_restaurant"
                    icon={<PiStorefront size={16} />}
                    title="Restaurant Mode"
                  >
                    <CbRow
                      label="Bar / Restaurant"
                      sub="Enable table management and kitchen order tickets"
                      checked={pos.isBarRestaurant}
                      onChange={(v) => setField('isBarRestaurant', v)}
                    />
                  </SectionCard>
                )}

                {/* Payment */}
                {vis('payment validate round tips cash card transfer') && (
                  <SectionCard
                    id="pos_payment"
                    icon={<PiCreditCard size={16} />}
                    title="Payment"
                  >
                    <CbRow
                      label="Auto-validate orders"
                      sub="Skip the payment confirmation step"
                      checked={pos.autoValidateOrder}
                      onChange={(v) => setField('autoValidateOrder', v)}
                    />
                    <CbRow
                      label="Cash rounding"
                      sub="Round totals to the nearest denomination"
                      checked={pos.cashRounding}
                      onChange={(v) => setField('cashRounding', v)}
                    />
                    <CbRow
                      label="Maximum difference"
                      sub="Allow closing a session with a small cash discrepancy"
                      checked={pos.maxDifferenceEnabled}
                      onChange={(v) => setField('maxDifferenceEnabled', v)}
                    />
                    <CbRow
                      label="Tips"
                      sub="Allow cashiers to add a tip at the payment screen"
                      checked={pos.tipsEnabled}
                      onChange={(v) => setField('tipsEnabled', v)}
                    />
                    <div className="py-4 pl-6 pr-6">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Accepted payment methods
                      </p>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
                        {PAYMENT_METHODS.map((m) => {
                          const on = methods.includes(m.id);
                          return (
                            <div
                              key={m.id}
                              className="flex cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50"
                              onClick={() =>
                                setMethods((prev) =>
                                  on
                                    ? prev.filter((x) => x !== m.id)
                                    : [...prev, m.id]
                                )
                              }
                            >
                              <span className="text-[13.5px] text-gray-800">
                                {m.label}
                              </span>
                              <Cb checked={on} onChange={() => {}} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </SectionCard>
                )}

                {/* POS Interface */}
                {vis(
                  'interface login employees scrollbar orders pictures images'
                ) && (
                  <SectionCard
                    id="pos_interface"
                    icon={<PiGear size={16} />}
                    title="POS Interface"
                  >
                    <CbRow
                      label="Log in with employees"
                      sub="Staff select their name and enter a PIN before selling"
                      checked={pos.loginWithEmployees}
                      onChange={(v) => setField('loginWithEmployees', v)}
                    />
                    <CbRow
                      label="Large scrollbars"
                      sub="Improve navigation on imprecise industrial touchscreens"
                      checked={pos.largeScrollbars}
                      onChange={(v) => setField('largeScrollbars', v)}
                    />
                    <CbRow
                      label="Share open orders"
                      sub="Allow all terminals to access each other's active orders"
                      checked={pos.shareOpenOrders}
                      onChange={(v) => setField('shareOpenOrders', v)}
                    />
                    <CbRow
                      label="Hide pictures in POS"
                      sub="Self-ordering interfaces are not impacted"
                      checked={pos.hidePictures}
                      onChange={(v) => setField('hidePictures', v)}
                    />
                    {!pos.hidePictures && (
                      <>
                        <CbRow
                          label="Show product images"
                          checked={pos.showProductImages}
                          onChange={(v) => setField('showProductImages', v)}
                          indent
                        />
                        <CbRow
                          label="Show category images"
                          checked={pos.showCategoryImages}
                          onChange={(v) => setField('showCategoryImages', v)}
                          indent
                        />
                      </>
                    )}
                  </SectionCard>
                )}

                {/* Product & POS Categories */}
                {vis('product categories restrict margins costs sort cart') && (
                  <SectionCard
                    id="pos_categories"
                    icon={<PiTag size={16} />}
                    title="Product & POS Categories"
                  >
                    <CbRow
                      label="Restrict categories"
                      sub="Pick which product POS categories are available"
                      checked={pos.restrictCategories}
                      onChange={(v) => setField('restrictCategories', v)}
                    />
                    <CbRow
                      label="Show margins & costs"
                      sub="Display margin and cost information on products"
                      checked={pos.showMarginsAndCosts}
                      onChange={(v) => setField('showMarginsAndCosts', v)}
                    />
                    <CbRow
                      label="Sort cart by category"
                      sub="Group items in the cart according to their category"
                      checked={pos.sortCartByCategory}
                      onChange={(v) => setField('sortCartByCategory', v)}
                    />
                  </SectionCard>
                )}

                {/* Pricing */}
                {vis(
                  'pricing pricelist price control discount promotions coupons loyalty'
                ) && (
                  <SectionCard
                    id="pos_pricing"
                    icon={<PiPercent size={16} />}
                    title="Pricing"
                  >
                    <CbRow
                      label="Flexible pricelists"
                      sub="Set multiple prices per product — automated discounts, etc."
                      checked={pos.flexiblePricelists}
                      onChange={(v) => setField('flexiblePricelists', v)}
                    />
                    <CbRow
                      label="Price control"
                      sub="Restrict price modification to managers only"
                      checked={pos.priceControl}
                      onChange={(v) => setField('priceControl', v)}
                    />
                    <Row
                      label="Product prices"
                      sub="How product prices are shown on receipts"
                    >
                      <span />
                    </Row>
                    <RadioRow
                      label="Tax-excluded price"
                      name="productPriceDisplay"
                      value="tax_excluded"
                      checked={pos.productPriceDisplay === 'tax_excluded'}
                      onChange={(v) =>
                        setField(
                          'productPriceDisplay',
                          v as PosState['productPriceDisplay']
                        )
                      }
                    />
                    <RadioRow
                      label="Tax-included price"
                      name="productPriceDisplay"
                      value="tax_included"
                      checked={pos.productPriceDisplay === 'tax_included'}
                      onChange={(v) =>
                        setField(
                          'productPriceDisplay',
                          v as PosState['productPriceDisplay']
                        )
                      }
                    />
                    <CbRow
                      label="Line discounts"
                      sub="Allow cashiers to set a discount per order line"
                      checked={pos.lineDiscounts}
                      onChange={(v) => setField('lineDiscounts', v)}
                    />
                    <CbRow
                      label="Global discounts"
                      sub="Adds a button to apply a single discount to the whole order"
                      checked={pos.globalDiscounts}
                      onChange={(v) => setField('globalDiscounts', v)}
                    />
                    <CbRow
                      label="Promotions, Coupons & Loyalty programme"
                      sub="Manage promotions that grant customers discounts or gifts"
                      checked={pos.promotionsEnabled}
                      onChange={(v) => setField('promotionsEnabled', v)}
                    />
                  </SectionCard>
                )}

                {/* Sales */}
                {vis('sales oversell discount maximum') && (
                  <SectionCard
                    id="pos_sales"
                    icon={<PiPercent size={16} />}
                    title="Sales"
                  >
                    <CbRow
                      label="Allow overselling"
                      sub="Sell items even when stock is zero or insufficient"
                      checked={pos.allowOverselling}
                      onChange={(v) => setField('allowOverselling', v)}
                    />
                    <Row
                      label="Maximum discount"
                      sub="Highest discount a cashier can apply on any line"
                    >
                      <NumInput
                        value={pos.maxDiscountPct}
                        onChange={(v) => setField('maxDiscountPct', v)}
                        min={0}
                        max={100}
                        suffix="%"
                      />
                    </Row>
                  </SectionCard>
                )}

                {/* Sessions */}
                {vis('session opening cash') && (
                  <SectionCard
                    id="pos_sessions"
                    icon={<PiClock size={16} />}
                    title="Sessions"
                  >
                    <CbRow
                      label="Require opening cash"
                      sub="Cashier must declare cash on hand before opening a session"
                      checked={pos.requireOpeningCash}
                      onChange={(v) => setField('requireOpeningCash', v)}
                    />
                  </SectionCard>
                )}

                {/* Loyalty */}
                {vis('loyalty points reward redeem') && (
                  <SectionCard
                    id="pos_loyalty"
                    icon={<PiStar size={16} />}
                    title="Loyalty Programme"
                  >
                    <CbRow
                      label="Enable loyalty programme"
                      sub="Customers earn and redeem points on every purchase"
                      checked={pos.loyaltyEnabled}
                      onChange={(v) => setField('loyaltyEnabled', v)}
                    />
                    {pos.loyaltyEnabled && (
                      <>
                        <Row
                          label="Points earned per ₦1"
                          sub="Loyalty points credited per naira spent"
                          indent
                        >
                          <NumInput
                            value={pos.loyaltyPointsPerNaira}
                            onChange={(v) =>
                              setField('loyaltyPointsPerNaira', v)
                            }
                            min={0.001}
                            step={0.001}
                            suffix="pts"
                          />
                        </Row>
                        <Row
                          label="Point value"
                          sub="Naira equivalent of one redeemed point"
                          indent
                        >
                          <NumInput
                            value={pos.loyaltyPointsValue}
                            onChange={(v) => setField('loyaltyPointsValue', v)}
                            min={0.01}
                            step={0.01}
                            prefix="₦"
                          />
                        </Row>
                        <Row
                          label="Max redemption"
                          sub="Max % of order total payable with loyalty points"
                          indent
                        >
                          <NumInput
                            value={pos.loyaltyMaxRedemptionPct}
                            onChange={(v) =>
                              setField('loyaltyMaxRedemptionPct', v)
                            }
                            min={0}
                            max={100}
                            suffix="%"
                          />
                        </Row>
                      </>
                    )}
                  </SectionCard>
                )}

                {/* Bills & Receipts */}
                {vis(
                  'receipt header footer tax print sms whatsapp invoice basic bills'
                ) && (
                  <SectionCard
                    id="pos_receipt"
                    icon={<PiReceipt size={16} />}
                    title="Bills & Receipts"
                  >
                    <TextRow
                      label="Header text"
                      sub="Printed at the top of every receipt"
                      value={pos.receiptHeader}
                      onChange={(v) => setField('receiptHeader', v)}
                      placeholder="e.g. Thank you for shopping with us!"
                      maxLength={200}
                    />
                    <TextRow
                      label="Footer text"
                      sub="Printed at the bottom of every receipt"
                      value={pos.receiptFooter}
                      onChange={(v) => setField('receiptFooter', v)}
                      placeholder="e.g. Goods sold are not returnable."
                      maxLength={200}
                    />
                    <CbRow
                      label="Automatic receipt printing"
                      sub="Print receipts automatically once payment is registered"
                      checked={pos.autoPrintReceipt}
                      onChange={(v) => setField('autoPrintReceipt', v)}
                    />
                    {pos.autoPrintReceipt && (
                      <Row
                        label="Receipt copies"
                        sub="Number of copies to print per order"
                        indent
                      >
                        <NumInput
                          value={pos.receiptCopies}
                          onChange={(v) => setField('receiptCopies', v)}
                          min={1}
                          max={5}
                          suffix="copies"
                        />
                      </Row>
                    )}
                    <CbRow
                      label="Show tax on receipt"
                      sub="Display the tax amount as a separate line on receipts"
                      checked={pos.showTaxOnReceipt}
                      onChange={(v) => setField('showTaxOnReceipt', v)}
                    />
                    {pos.showTaxOnReceipt && (
                      <Row
                        label="Tax rate"
                        sub="VAT / tax percentage applied to all orders"
                        indent
                      >
                        <NumInput
                          value={pos.taxRate}
                          onChange={(v) => setField('taxRate', v)}
                          min={0}
                          max={100}
                          step={0.5}
                          suffix="%"
                        />
                      </Row>
                    )}
                    <CbRow
                      label="SMS enabled"
                      sub="Send text receipt via SMS after payment"
                      checked={pos.smsReceiptEnabled}
                      onChange={(v) => setField('smsReceiptEnabled', v)}
                    />
                    <CbRow
                      label="WhatsApp enabled"
                      sub="Send receipts via WhatsApp after payment"
                      checked={pos.whatsappReceiptEnabled}
                      onChange={(v) => setField('whatsappReceiptEnabled', v)}
                    />
                    <CbRow
                      label="Self-service invoicing"
                      sub="Include invoice request info on the receipt so customers can get their invoice anytime"
                      checked={pos.selfServiceInvoicing}
                      onChange={(v) => setField('selfServiceInvoicing', v)}
                    />
                    <CbRow
                      label="Basic receipt"
                      sub="Print a basic ticket without prices — can be used as a gift receipt"
                      checked={pos.basicReceipt}
                      onChange={(v) => setField('basicReceipt', v)}
                    />
                    <CbRow
                      label="Show cashier name"
                      sub="Print the cashier's name on each receipt"
                      checked={pos.showCashierName}
                      onChange={(v) => setField('showCashierName', v)}
                    />
                    <CbRow
                      label="Show order number"
                      sub="Print the order reference number on receipts"
                      checked={pos.showOrderNumber}
                      onChange={(v) => setField('showOrderNumber', v)}
                    />
                    <TextInput
                      label="Receipt number prefix"
                      sub='Prepended to every order number on the receipt (e.g. "INV-")'
                      value={pos.receiptNumberPrefix}
                      onChange={(v) => setField('receiptNumberPrefix', v)}
                      placeholder="e.g. INV-"
                      maxLength={10}
                      width="w-32"
                    />
                  </SectionCard>
                )}

                {/* Payment Terminals */}
                {vis(
                  'payment terminal adyen stripe viva wallet paytm razorpay mercado'
                ) && (
                  <SectionCard
                    id="pos_terminals"
                    icon={<PiCreditCard size={16} />}
                    title="Payment Terminals"
                    note="Common to all POS terminals"
                  >
                    <div className="grid grid-cols-2 divide-x divide-gray-50">
                      {PAYMENT_TERMINALS.map((t) => (
                        <CbRow
                          key={t.id}
                          label={t.label}
                          sub={t.sub}
                          checked={terminals.includes(t.id)}
                          onChange={() => toggleTerminal(t.id)}
                        />
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Connected Devices */}
                {vis(
                  'connected devices epos printer customer display iot box'
                ) && (
                  <SectionCard
                    id="pos_devices"
                    icon={<PiDevices size={16} />}
                    title="Connected Devices"
                  >
                    <CbRow
                      label="ePOS Printer"
                      sub="Connect a receipt printer to your POS without an IoT Box"
                      checked={pos.eposPrinter}
                      onChange={(v) => setField('eposPrinter', v)}
                    />
                    <CbRow
                      label="Customer Display"
                      sub="Show checkout to customers through a second screen"
                      checked={pos.customerDisplay}
                      onChange={(v) => setField('customerDisplay', v)}
                    />
                    <CbRow
                      label="IoT Box"
                      sub="Connect printers, scanners, and scales using an IoT Box"
                      checked={pos.iotBox}
                      onChange={(v) => setField('iotBox', v)}
                    />
                  </SectionCard>
                )}

                {/* Preparation */}
                {vis('preparation kitchen bar printer display notes') && (
                  <SectionCard
                    id="pos_prep"
                    icon={<PiChefHat size={16} />}
                    title="Preparation"
                  >
                    <CbRow
                      label="Preparation printers"
                      sub="Print orders at the kitchen, bar, or other preparation stations"
                      checked={pos.preparationPrinters}
                      onChange={(v) => setField('preparationPrinters', v)}
                    />
                    <CbRow
                      label="Preparation display"
                      sub="Display pending orders on a kitchen or preparation screen"
                      checked={pos.preparationDisplay}
                      onChange={(v) => setField('preparationDisplay', v)}
                    />
                    <CbRow
                      label="Internal notes"
                      sub="Allow cashiers to add preparation notes on order lines for the kitchen"
                      checked={pos.internalNotes}
                      onChange={(v) => setField('internalNotes', v)}
                    />
                  </SectionCard>
                )}

                {/* Inventory */}
                {vis('inventory ship later barcode scan') && (
                  <SectionCard
                    id="pos_inventory"
                    icon={<PiPackage size={16} />}
                    title="Inventory"
                  >
                    <CbRow
                      label="Allow ship later"
                      sub="Sell products and arrange delivery later"
                      checked={pos.allowShipLater}
                      onChange={(v) => setField('allowShipLater', v)}
                    />
                    <CbRow
                      label="Barcodes"
                      sub="Use barcodes to scan products and customer loyalty cards"
                      checked={pos.barcodes}
                      onChange={(v) => setField('barcodes', v)}
                    />
                  </SectionCard>
                )}

                {/* Customers */}
                {vis('customer require phone search loyalty balance') && (
                  <SectionCard
                    id="pos_customers"
                    icon={<PiUser size={16} />}
                    title="Customers"
                  >
                    <CbRow
                      label="Require customer on sale"
                      sub="A customer must be selected or created before checkout can proceed"
                      checked={pos.requireCustomer}
                      onChange={(v) => setField('requireCustomer', v)}
                    />
                    <CbRow
                      label="Search customers by phone"
                      sub="Allow cashiers to look up customers using their phone number"
                      checked={pos.customerPhoneSearch}
                      onChange={(v) => setField('customerPhoneSearch', v)}
                    />
                    <CbRow
                      label="Show loyalty balance at checkout"
                      sub="Display the customer's current points balance on the payment screen"
                      checked={pos.showLoyaltyBalanceAtCheckout}
                      onChange={(v) =>
                        setField('showLoyaltyBalanceAtCheckout', v)
                      }
                    />
                  </SectionCard>
                )}

                {/* Order Management */}
                {vis('order notes hold split payment minimum amount') && (
                  <SectionCard
                    id="pos_orders"
                    icon={<PiShoppingBag size={16} />}
                    title="Order Management"
                  >
                    <CbRow
                      label="Order notes"
                      sub="Allow cashiers to add a note to the entire order"
                      checked={pos.allowOrderNotes}
                      onChange={(v) => setField('allowOrderNotes', v)}
                    />
                    <CbRow
                      label="Hold orders"
                      sub="Allow cashiers to park an order and start a new one"
                      checked={pos.holdOrders}
                      onChange={(v) => setField('holdOrders', v)}
                    />
                    <CbRow
                      label="Split payments"
                      sub="Let customers pay an order using more than one payment method"
                      checked={pos.splitPayments}
                      onChange={(v) => setField('splitPayments', v)}
                    />
                    <Row
                      label="Minimum order amount"
                      sub="Orders below this value cannot be checked out (0 = no minimum)"
                    >
                      <NumInput
                        value={pos.minimumOrderAmount}
                        onChange={(v) => setField('minimumOrderAmount', v)}
                        min={0}
                        step={100}
                        prefix="₦"
                      />
                    </Row>
                  </SectionCard>
                )}

                {/* Refunds & Returns */}
                {vis('refund return restock window manager approval') && (
                  <SectionCard
                    id="pos_refunds"
                    icon={<PiArrowUUpLeft size={16} />}
                    title="Refunds & Returns"
                  >
                    <CbRow
                      label="Allow refunds"
                      sub="Enable cashiers to process refunds from the POS terminal"
                      checked={pos.allowRefunds}
                      onChange={(v) => setField('allowRefunds', v)}
                    />
                    {pos.allowRefunds && (
                      <>
                        <Row
                          label="Refund window"
                          sub="Number of days after a sale that a refund can be issued (0 = unlimited)"
                          indent
                        >
                          <NumInput
                            value={pos.refundWindowDays}
                            onChange={(v) => setField('refundWindowDays', v)}
                            min={0}
                            max={365}
                            suffix="days"
                          />
                        </Row>
                        <CbRow
                          label="Require manager approval"
                          sub="A manager must enter their PIN before any refund is processed"
                          checked={pos.requireManagerApprovalForRefund}
                          onChange={(v) =>
                            setField('requireManagerApprovalForRefund', v)
                          }
                          indent
                        />
                        <CbRow
                          label="Restock items by default"
                          sub="Automatically return items to inventory when a refund is created"
                          checked={pos.defaultRestockOnRefund}
                          onChange={(v) =>
                            setField('defaultRestockOnRefund', v)
                          }
                          indent
                        />
                      </>
                    )}
                  </SectionCard>
                )}

                {/* Security */}
                {vis('security pin lock timeout unlock manager discount') && (
                  <SectionCard
                    id="pos_security"
                    icon={<PiShieldCheck size={16} />}
                    title="Security"
                  >
                    <Row
                      label="Auto-lock after inactivity"
                      sub="Lock the POS screen after this many minutes idle (0 = never)"
                    >
                      <NumInput
                        value={pos.sessionTimeoutMins}
                        onChange={(v) => setField('sessionTimeoutMins', v)}
                        min={0}
                        max={120}
                        suffix="min"
                      />
                    </Row>
                    <CbRow
                      label="Require PIN to unlock"
                      sub="Staff must enter their PIN to resume after the screen locks"
                      checked={pos.requirePINOnUnlock}
                      onChange={(v) => setField('requirePINOnUnlock', v)}
                    />
                    <CbRow
                      label="Manager PIN for large discounts"
                      sub="Require a manager PIN when a discount exceeds the maximum threshold"
                      checked={pos.requireManagerPINForDiscount}
                      onChange={(v) =>
                        setField('requireManagerPINForDiscount', v)
                      }
                    />
                  </SectionCard>
                )}

                {/* Currency */}
                {vis('currency symbol decimal places format position') && (
                  <SectionCard
                    id="pos_currency"
                    icon={<PiCurrencyDollar size={16} />}
                    title="Currency & Number Format"
                  >
                    <TextInput
                      label="Currency symbol"
                      sub="Symbol displayed next to every price (e.g. ₦, $, €)"
                      value={pos.currencySymbol}
                      onChange={(v) => setField('currencySymbol', v)}
                      placeholder="₦"
                      maxLength={4}
                      width="w-20"
                    />
                    <SelectRow
                      label="Symbol position"
                      sub="Whether the symbol appears before or after the amount"
                      value={pos.currencyPosition}
                      onChange={(v) =>
                        setField(
                          'currencyPosition',
                          v as PosState['currencyPosition']
                        )
                      }
                      options={[
                        { value: 'before', label: 'Before amount  (₦ 1,000)' },
                        { value: 'after', label: 'After amount  (1,000 ₦)' },
                      ]}
                    />
                    <SelectRow
                      label="Decimal places"
                      sub="Number of decimal places shown on prices and totals"
                      value={String(pos.decimalPlaces)}
                      onChange={(v) =>
                        setField(
                          'decimalPlaces',
                          Number(v) as PosState['decimalPlaces']
                        )
                      }
                      options={[
                        { value: '0', label: '0  (1,000)' },
                        { value: '1', label: '1  (1,000.0)' },
                        { value: '2', label: '2  (1,000.00)' },
                      ]}
                    />
                  </SectionCard>
                )}

                {/* Bank Accounts */}
                {vis('bank account transfer') && (
                  <SectionCard
                    id="pos_banks"
                    icon={<PiBank size={16} />}
                    title="Bank Accounts"
                  >
                    {banks.length > 0 && (
                      <>
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2.5 border-b border-gray-50 px-6 py-2.5">
                          {[
                            'Bank name',
                            'Account number',
                            'Account name',
                            '',
                          ].map((h) => (
                            <p
                              key={h}
                              className="text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                            >
                              {h}
                            </p>
                          ))}
                        </div>
                        {banks.map((b, i) => (
                          <BankRow
                            key={i}
                            account={b}
                            onRemove={() => removeBank(i)}
                            onChange={(f, v) => updateBank(i, f, v)}
                          />
                        ))}
                      </>
                    )}
                    {banks.length === 0 && (
                      <p className="px-6 py-4 text-sm text-gray-400">
                        No bank accounts added yet.
                      </p>
                    )}
                    <div className="border-t border-gray-50 px-6 py-3">
                      <button
                        type="button"
                        onClick={addBank}
                        className="flex items-center gap-1.5 text-sm font-medium text-[#b20202] transition-colors hover:text-[#9a0202]"
                      >
                        <PiPlus size={14} />
                        Add bank account
                      </button>
                    </div>
                  </SectionCard>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
