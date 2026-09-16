const phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2347048004020';
const message = encodeURIComponent('Hi DrinksHarbour! I need help with ');

export const WHATSAPP_URL = `https://wa.me/${phone}?text=${message}`;

/** Build a wa.me link with a fully-encoded message (e.g. a product order). */
export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}