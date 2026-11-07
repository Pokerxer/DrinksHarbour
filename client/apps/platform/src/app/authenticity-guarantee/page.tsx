import Link from 'next/link';
import { PiSealCheckBold, PiPackageBold, PiEnvelopeBold, PiArrowUpRightBold } from 'react-icons/pi';
import { fraunces } from '@/app/fonts';
import { guideMetadata } from '@/components/CommerceGuides/GuideMetadata';
import GuideStructuredData from '@/components/CommerceGuides/GuideStructuredData';

const title = 'Authenticity & Bottle Checks in Nigeria';
const description = 'Buy with clearer bottle information. Check seller, label and packaging details, learn what to keep on delivery, and contact DrinksHarbour about authenticity concerns.';
export const metadata = guideMetadata('/authenticity-guarantee', title, description);

const heroPattern = 'repeating-linear-gradient(135deg, rgba(215,178,107,0.12) 0px, rgba(215,178,107,0.12) 1px, transparent 1px, transparent 9px)';

export default function AuthenticityPage() {
  return (
    <article className="bg-[#fcfaf8] text-gray-900">
      <GuideStructuredData path="/authenticity-guarantee" name={title} description={description} />
      <header className="overflow-hidden bg-[#351014] text-white" style={{ backgroundImage: heroPattern }}>
        <div className="container mx-auto max-w-5xl px-4 pb-12 pt-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-white/65"><Link href="/" className="py-2 underline-offset-4 hover:text-white hover:underline">Home</Link><span aria-hidden="true">/</span><span className="text-white">Authenticity &amp; bottle checks</span></nav>
          <p className="mt-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#e4c894]"><span className="h-px w-8 bg-[#d5b26b]" aria-hidden="true" />Know your bottle</p>
          <h1 className={`${fraunces.className} mt-4 max-w-3xl text-4xl font-medium leading-[1.08] sm:text-5xl`}>Authenticity and bottle checks</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">Our commitment is to sell original drinks through approved sellers. Use the product details and seller information to make an informed choice, and contact DrinksHarbour if a delivered bottle raises a concern.</p>
        </div>
      </header>
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-[#7c1d1d]/10 bg-white p-6 shadow-[0_8px_40px_-24px_rgba(53,16,20,0.28)] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f7e9db] text-[#7c1d1d]"><PiSealCheckBold className="h-6 w-6" aria-hidden="true" /></span>
              <h2 className="text-2xl font-bold">Before you buy</h2>
            </div>
            <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-gray-700">
              <li>Match the brand, expression, bottle size, origin and ABV where listed. Similar-looking labels can describe different editions.</li>
              <li>Check the selected seller and current offer. Ask support about missing label or packaging information before paying.</li>
              <li>Do not assume a gift box, importer detail or special edition from a generic product image. Confirm what the exact offer includes.</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-[#163a30]/10 bg-white p-6 shadow-[0_8px_40px_-24px_rgba(22,58,48,0.28)] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#163a30]/10 text-[#163a30]"><PiPackageBold className="h-6 w-6" aria-hidden="true" /></span>
              <h2 className="text-2xl font-bold">When your order arrives</h2>
            </div>
            <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-gray-700">
              <li>Compare the delivered bottle, size and quantity with your order confirmation.</li>
              <li>Check the packaging, closure and label for damage or a mismatch. Keep clear photos of anything that concerns you.</li>
              <li>Retain the bottle, packaging and order reference so support can investigate. Visual checks alone cannot establish authenticity.</li>
            </ul>
          </section>
        </div>
        <section className="mt-6 overflow-hidden rounded-2xl bg-[#163a30] p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold">If something is wrong</h2>
          <p className="mt-4 max-w-3xl leading-7 text-white/80">Avoid consuming a drink if you have concerns about it. Contact support promptly with your order reference, the product name, the seller and photos of the bottle, seal, label and packaging. Share those details privately with support.</p>
          <p className="mt-3 max-w-3xl leading-7 text-white/80">Our <Link href="/returns" className="font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">returns policy</Link> explains eligibility, evidence and the process for approved returns and refunds. Do not discard the item or send it back before receiving instructions.</p>
          <Link href="/contact" className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#163a30] hover:bg-[#f7e9db] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><PiEnvelopeBold aria-hidden="true" />Contact support about a bottle</Link>
        </section>
        <section className="mt-10 pb-12">
          <h2 className="text-2xl font-bold">Clear information, without guesswork</h2>
          <p className="mt-4 max-w-3xl leading-7 text-gray-700">A product listing, review or badge does not replace the details of the bottle you receive. Ask for clarification whenever product or seller information is incomplete. We do not describe a bottle as independently laboratory-tested or brand-certified unless that evidence is supplied for it.</p>
          <nav aria-label="Buying and support information" className="mt-6 flex flex-wrap gap-x-6 gap-y-3 font-semibold text-[#7c1d1d] underline underline-offset-4">
            <Link href="/shop">Compare bottles and seller offers</Link><Link href="/vendors">Browse seller stores</Link><Link href="/shipping-info">Delivery information</Link><Link href="/faqs">Shopping FAQs</Link>
          </nav>
        </section>
      </div>
    </article>
  );
}
