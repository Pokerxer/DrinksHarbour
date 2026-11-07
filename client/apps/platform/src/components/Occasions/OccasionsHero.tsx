import Link from 'next/link';
import { PiArrowDownBold, PiArrowUpRightBold } from 'react-icons/pi';
import { fraunces } from '@/app/fonts';
import GlasswareIllustration from './GlasswareIllustration';

export default function OccasionsHero() {
  return <header className="overflow-hidden bg-[#351014] text-white">
    <div className="mx-auto max-w-7xl px-5 pb-12 pt-7 sm:px-8 lg:pb-16">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-white/65"><Link href="/" className="py-2 hover:text-white">Home</Link><span aria-hidden="true">/</span><span className="text-white">Occasions</span></nav>
      <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#e4c894]"><span className="h-px w-8 bg-[#d5b26b]" />The occasion edit</p>
          <h1 className={`${fraunces.className} mt-5 max-w-2xl text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.06] tracking-tight`}>Drinks for every<br className="hidden sm:block" /> occasion <em className="text-[#e4c894]">in Nigeria.</em></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">Big celebrations. Small gatherings. Thoughtful gifts. Choose an occasion, build your bottle list or attach one, then send your requirements to our team for a reviewed plan by email or WhatsApp.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#occasion-chat" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#351014] hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Send your requirements <PiArrowDownBold aria-hidden="true" /></a>
            <a href="#occasion-planner" className="inline-flex min-h-12 items-center gap-3 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Build your brief <PiArrowUpRightBold aria-hidden="true" /></a>
          </div>
          <p className="mt-6 text-xs leading-5 text-white/55">Compare bottle sizes, seller offers and delivery before you order. Alcohol is for adults 18+.</p>
        </div>
        <div className="relative mx-auto hidden w-full max-w-md sm:block" aria-hidden="true">
          <div className="absolute inset-6 rounded-[50%] border border-[#d5b26b]/20" />
          <GlasswareIllustration />
          <p className="text-center text-[10px] uppercase tracking-[0.26em] text-[#e4c894]">Good company. A considered bottle list.</p>
        </div>
      </div>
    </div>
  </header>;
}
