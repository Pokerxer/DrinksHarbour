'use client';

import type { EnquiryType } from '@/lib/commercialPages';
import { trackCommercialEnquiry } from '@/lib/commercialEnquiry';

export default function EnquiryLink({ href, type, label = 'Enquire on WhatsApp' }: { href: string; type: EnquiryType; label?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer"
    onClick={() => { try { trackCommercialEnquiry(type); } catch { /* Contact remains available if analytics fails. */ } }}
    className="mt-6 inline-flex w-full min-h-12 items-center justify-center rounded-full bg-[#7c1d1d] px-6 py-3 text-sm font-bold text-white hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1d1d]">
    {label} <span className="sr-only">(opens a new tab)</span>
  </a>;
}
