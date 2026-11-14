import Image from 'next/image';
import Link from 'next/link';
import { PiArrowDown, PiArrowUpRight } from 'react-icons/pi';
import { fraunces } from '@/app/fonts';
import type { CommercialPage } from '@/lib/commercialPages';

export const weddingHeroImage = '/images/wedding-drinks-abuja.webp';

export default function WeddingHero({ page }: { page: CommercialPage }) {
  return <header className="border-b border-[#d5dbd1] bg-[#f6f5ed] text-[#17392e]">
    <div className="mx-auto grid max-w-7xl items-stretch px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
      <div className="pb-9 pt-7 lg:pb-16">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-stone-600">
          <Link className="underline underline-offset-4" href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link className="underline underline-offset-4" href="/occasions">Occasions</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{page.label}</span>
        </nav>
        <h1 className={`${fraunces.className} mt-8 max-w-xl text-[clamp(2.7rem,5.2vw,4.5rem)] font-medium leading-[1.05] tracking-tight lg:mt-12`}>{page.heading}</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-stone-700 sm:text-lg">{page.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#shop-wedding-drinks" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#17392e] px-5 py-3 text-sm font-bold text-white hover:bg-[#215342] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            Shop wedding drinks <PiArrowDown aria-hidden />
          </a>
          <a href="#occasion-planner" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#9aad9a] px-5 py-3 text-sm font-bold hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            Send your wedding brief <PiArrowUpRight aria-hidden />
          </a>
        </div>
      </div>
      <div className="relative mb-6 aspect-[3/2] overflow-hidden rounded-t-[5rem] rounded-b-md sm:rounded-t-[7rem] lg:mb-0 lg:mt-7 lg:aspect-auto lg:rounded-b-none">
        <Image src={weddingHeroImage} alt="" fill sizes="(min-width: 1024px) 48vw, 100vw" className="object-cover" preload />
      </div>
    </div>
  </header>;
}
