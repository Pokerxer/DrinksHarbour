const phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2347048004020';
const message = encodeURIComponent('Hi DrinksHarbour! I need help with ');

export const WHATSAPP_URL = `https://wa.me/${phone}?text=${message}`;
