'use client';

import * as Icon from 'react-icons/pi';
import { buildWhatsAppUrl } from '@/components/WhatsApp/whatsappLink';

type OrderWhatsAppButtonProps = {
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
  currencySymbol: string;
  seller?: string;
  packRateActive?: boolean;
  disabled?: boolean;
};

const ngn = (value: number, symbol: string): string =>
  `${symbol}${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

/**
 * "Order on WhatsApp" CTA — the cart-free path to checkout. Builds a wa.me link
 * prefilled with the exact product, size, quantity, seller and estimated total
 * the customer has configured, so the shop rep has everything needed to confirm
 * and fulfil without a back-and-forth. Disabled until a valid size is in stock,
 * matching the Add to Cart button's own guards.
 */
export default function OrderWhatsAppButton({
  productName,
  size,
  quantity,
  unitPrice,
  total,
  currencySymbol,
  seller,
  packRateActive = false,
  disabled = false,
}: OrderWhatsAppButtonProps) {
  const lines = [
    'Hello DrinksHarbour! I would like to place an order:',
    '',
    `• Product: ${productName}`,
    `• Size: ${size}`,
    `• Quantity: ${quantity}`,
    ...(packRateActive ? ['• Pack rate: yes'] : []),
    `• Unit price: ${ngn(unitPrice, currencySymbol)}`,
    `• Estimated total: ${ngn(total, currencySymbol)}`,
    ...(seller ? [`• Sold by: ${seller}`] : []),
    '',
    'Please confirm availability and delivery details.',
  ];

  const href = buildWhatsAppUrl(lines.join('\n'));

  const label = disabled ? 'Select a Size to order' : 'Order on WhatsApp';

  const baseClasses =
    'w-full py-4 px-6 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 sm:gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700';

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${baseClasses} bg-green-50 text-green-300 cursor-not-allowed`}
      >
        <Icon.PiWhatsappLogo size={20} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Order on WhatsApp (opens in a new tab)"
      className={`${baseClasses} bg-[#25D366] text-white shadow-lg shadow-green-500/30 hover:bg-[#1ebe5b] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
    >
      <Icon.PiWhatsappLogo size={20} />
      <span>Order on WhatsApp</span>
    </a>
  );
}