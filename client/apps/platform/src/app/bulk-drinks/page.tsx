import Link from 'next/link';
import { PiListChecksBold, PiPackageBold, PiTruckBold, PiChatCircleDotsBold, PiArrowUpRightBold } from 'react-icons/pi';
import { bulkPage } from '@/lib/commercialPages';
import CommercialGuide from '@/components/CommerceGuides/CommercialGuide';
import { guideMetadata } from '@/components/CommerceGuides/GuideMetadata';

export const metadata = guideMetadata(bulkPage.path, bulkPage.title, bulkPage.description);

const steps = [
  { Icon: PiListChecksBold, title: 'List what you need', text: 'Write down the bottles, bottle sizes and quantities you have in mind. Include water and non-alcoholic choices so the plan covers every person in the room.', href: '/shop', label: 'Browse the drinks shop' },
  { Icon: PiPackageBold, title: 'Compare packs, not just prices', text: 'Open each product and read the pack details before comparing costs. When quantity pricing is available, its purchase panel shows the tiers you can select.', href: '/occasions/weddings', label: 'Occasion planning guidance' },
  { Icon: PiTruckBold, title: 'Confirm stock and delivery', text: 'Send your list with the delivery city and required date. Our team checks availability across selected sellers and the delivery options with you before you pay.', href: '/shipping-info', label: 'Delivery fees & timings' },
];

const packPattern = 'repeating-linear-gradient(135deg, rgba(53,16,20,0.05) 0px, rgba(53,16,20,0.05) 1px, transparent 1px, transparent 8px)';

export default function BulkDrinksPage() {
  return (
    <CommercialGuide page={bulkPage}>
      <section aria-labelledby="bulk-steps-heading" className="container mx-auto px-4 pt-10">
        <div className="max-w-2xl">
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#7c1d1d]"><span className="h-px w-8 bg-[#d5b26b]" aria-hidden="true" />How a bulk order works</p>
          <h2 id="bulk-steps-heading" className="mt-3 text-3xl font-bold tracking-tight">From your list to the delivery point.</h2>
          <p className="mt-3 leading-7 text-gray-700">A bulk drinks order is a normal order with bigger quantities and more detail in the brief. Work through these three steps and share the result with our team.</p>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(({ Icon, title, text, href, label }, index) => (
            <li key={title}>
              <div className="flex h-full flex-col rounded-2xl border border-[#7c1d1d]/10 bg-white p-6 shadow-[0_8px_40px_-24px_rgba(53,16,20,0.28)]" style={{ backgroundImage: packPattern }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#351014] text-xs font-bold text-[#e4c894]" aria-hidden="true">{index + 1}</span>
                  <Icon className="h-6 w-6 text-[#7c1d1d]" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-bold text-[#351014]">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-7 text-gray-700">{text}</p>
                <Link href={href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#7c1d1d] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7c1d1d]">{label}<PiArrowUpRightBold aria-hidden="true" /></Link>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-2xl bg-[#163a30] p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <PiChatCircleDotsBold className="mt-1 h-7 w-7 shrink-0 text-[#e4c894]" aria-hidden="true" />
              <div>
                <h3 className="text-xl font-semibold">Prefer to talk the quantities through first?</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Start in the occasions planner: choose the bottles or drink categories, add your guest count and budget, then send the same list for a bulk review by our team.</p>
              </div>
            </div>
            <Link href="/occasions/weddings" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#351014] hover:bg-[#f7e9db] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Build your drinks list<PiArrowUpRightBold aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </CommercialGuide>
  );
}
