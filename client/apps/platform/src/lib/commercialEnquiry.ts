'use client';

import { gtagEvent } from '@/lib/gtag';
import type { EnquiryType } from '@/lib/commercialPages';

/** A contact-link click is intent, not proof that a message or order was sent. */
export function trackCommercialEnquiry(type: EnquiryType): void {
  gtagEvent('commercial_enquiry_click', { enquiry_type: type, contact_method: 'whatsapp' });
}

/** Call only after the contact API accepts the message. Never include its content. */
export function trackContactLead(subject: string): void {
  const allowed = ['order', 'delivery', 'product', 'vendor', 'payment', 'returns', 'other'];
  try {
    gtagEvent('generate_lead', { lead_type: 'contact', contact_subject: allowed.includes(subject) ? subject : 'other' });
  } catch {
    // A failed analytics tag must not turn an accepted enquiry into a form error.
  }
}
