import * as Icon from 'react-icons/pi';
import type { StatusConfig, NotificationSettings } from './_types';

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending:    { color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200', icon: Icon.PiClockBold },
  confirmed:  { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: Icon.PiCheckCircleBold },
  processing: { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Icon.PiPackageBold },
  shipped:    { color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', icon: Icon.PiTruckBold },
  delivered:  { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: Icon.PiCheckCircleBold },
  cancelled:  { color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: Icon.PiXCircleBold },
};

export const ORDERS_PAGE_SIZE = 10;

export const ORDER_STATUSES = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export const NG_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River',
  'Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano',
  'Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo',
  'Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
];

export const NAV_ITEMS = [
  { icon: Icon.PiSquaresFourBold, label: 'Overview',        href: '/my-account' },
  { icon: Icon.PiPackageBold,     label: 'My Orders',       href: '/my-account/orders' },
  { icon: Icon.PiWalletBold,      label: 'Wallet',          href: '/my-account/wallet' },
  { icon: Icon.PiGiftBold,        label: 'Gift Cards',      href: '/my-account/gift-cards' },
  { icon: Icon.PiStarBold,        label: 'Corks & Points',  href: '/my-account/loyalty' },
  { icon: Icon.PiHeartBold,       label: 'Wishlist',        href: '/wishlist' },
  { icon: Icon.PiMapPinBold,      label: 'Addresses',       href: '/my-account/addresses' },
  { icon: Icon.PiCreditCardBold,  label: 'Payment Methods', href: '/my-account/payment-methods' },
  { icon: Icon.PiBellBold,        label: 'Notifications',   href: '/my-account/notifications' },
  { icon: Icon.PiShieldBold,      label: 'Security',        href: '/my-account/security' },
];

export const PAYMENT_METHODS = [
  {
    id: 'card',
    icon: Icon.PiCreditCardBold,
    label: 'Debit / Credit Card',
    description: 'Visa, Mastercard, and Verve cards accepted. Payments are processed securely via Korapay.',
    badge: 'Recommended' as string | null,
    badgeColor: 'bg-red-700 text-white',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'transfer',
    icon: Icon.PiBankBold,
    label: 'Bank Transfer',
    description: 'Transfer directly from any Nigerian bank. Your order is confirmed once payment is verified.',
    badge: null,
    color: 'bg-green-50 text-green-700',
  },
  {
    id: 'ussd',
    icon: Icon.PiDeviceMobileBold,
    label: 'USSD',
    description: "Pay with *737#, *919#, or your bank's USSD code — no internet required.",
    badge: null,
    color: 'bg-purple-50 text-purple-700',
  },
  {
    id: 'korapay',
    icon: Icon.PiShieldCheckBold,
    label: 'Korapay Checkout',
    description: 'Use the Korapay secure checkout for a one-click payment experience.',
    badge: null,
    color: 'bg-amber-50 text-amber-700',
  },
  {
    id: 'paystack',
    icon: Icon.PiShieldCheckBold,
    label: 'Paystack Checkout',
    description: 'Paystack checkout is not available yet.',
    badge: 'Coming soon' as string | null,
    badgeColor: 'bg-amber-100 text-amber-700',
    color: 'bg-stone-100 text-stone-500',
  },
];

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  orderUpdates:  true,
  promotions:    true,
  newArrivals:   false,
  newsletter:    true,
  email:         true,
  sms:           true,
  push:          false,
  whatsapp:      true,
};

export const inputCls = 'w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all';

export const labelCls = 'text-xs font-semibold text-stone-600 mb-1.5 block';
