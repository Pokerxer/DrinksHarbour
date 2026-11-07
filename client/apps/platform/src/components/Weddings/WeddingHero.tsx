import Link from 'next/link';
import { PiArrowDownBold, PiFlowerTulipThin } from 'react-icons/pi';
import { fraunces } from '@/app/fonts';

export default function WeddingHero() {
  return <header className="border-b border-rose-100 bg-white">
    <div className="mx-auto max-w-7xl px-5 pb-12 pt-7 sm:px-8 lg:pb-16">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-gray-600"><Link className="py-2 hover:underline" href="/">Home</Link><i aria-hidden="true">/</i><Link className="py-2 hover:underline" href="/occasions">Occasions</Link><i aria-hidden="true">/</i><strong className="font-medium text-[#7c1d1d]">Weddings</strong></nav>
      <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7c1d1d]">The wedding edit · DrinksHarbour</p>
          <h1 className={`${fraunces.className} mt-5 max-w-2xl text-[clamp(2.5rem,4.8vw,4rem)] font-medium leading-[1.08] tracking-tight text-[#351014]`}>Wedding drinks in Nigeria,<br className="hidden sm:block" /> <em className="text-[#7c1d1d]">with you in mind.</em></h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-gray-600 sm:text-lg">From the first toast to a table full of familiar favourites. Choose your bottles, share the details of your day, then send your requirements to our team. We’ll check availability and reply by email or WhatsApp.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#wedding-list" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#7c1d1d] px-6 py-3 text-sm font-bold text-white hover:bg-[#571419]">Build your drinks list <PiArrowDownBold aria-hidden="true" /></a><a href="#occasion-planner" className="inline-flex min-h-12 items-center rounded-full border border-rose-200 px-6 py-3 text-sm font-semibold text-[#7c1d1d] hover:bg-rose-50">Prepare a wedding enquiry</a></div>
          <p className="mt-5 text-xs leading-6 text-gray-500">Your menu. Your guests. Your budget. Alcoholic orders are for adults 18+.</p>
        </div>
        <div className="rounded-t-[8rem] rounded-b-2xl bg-[#351014] px-7 py-10 text-center text-[#f7e9db] sm:px-10" aria-label="A wedding reception planning note">
          <div className="rounded-t-[6rem] rounded-b-lg border border-[#d5b26b]/35 px-5 py-8">
            <PiFlowerTulipThin className="mx-auto h-12 w-12 text-[#d5b26b]" aria-hidden="true" />
            <p className="mt-5 text-[10px] uppercase tracking-[0.28em] text-[#e4c894]">Reception notes</p>
            <p className={`${fraunces.className} mt-4 text-3xl leading-tight sm:text-4xl`}>A toast to<br />your kind of day.</p>
            <div className="mx-auto my-6 h-px w-12 bg-[#d5b26b]/50" />
            <p className="text-xs leading-7 text-white/75">Something for the toast.<br />Something for the table.<br />Something for everyone.</p>
          </div>
        </div>
      </div>
    </div>
  </header>;
}
