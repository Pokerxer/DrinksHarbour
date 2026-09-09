import { PiWhatsappLogo } from 'react-icons/pi';
import { WHATSAPP_URL } from '../WhatsApp/whatsappLink';

export default function WhatsAppNavLink() {
  return (
    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
      aria-label="Chat on WhatsApp (opens in a new tab)"
      className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700">
      <PiWhatsappLogo size={20} aria-hidden="true" />
      <span className="text-[9px] font-medium leading-none sm:text-[10px]">WhatsApp</span>
      <span aria-hidden="true" className="h-1 w-1" />
    </a>
  );
}
