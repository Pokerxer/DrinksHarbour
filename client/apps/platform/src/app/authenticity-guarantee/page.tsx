import Link from 'next/link';
import { PiSealCheckBold, PiPackageBold, PiEnvelopeBold, PiShieldCheckBold, PiBuildingsBold, PiStorefrontBold, PiMagnifyingGlassBold, PiArrowRightBold, PiArrowDownBold, PiTruckBold, PiStarFill } from 'react-icons/pi';
import { fraunces } from '@/app/fonts';
import { guideMetadata } from '@/components/CommerceGuides/GuideMetadata';
import GuideStructuredData from '@/components/CommerceGuides/GuideStructuredData';

const title = 'Authenticity Guarantee & Bottle Checks in Nigeria';
const description = 'Why buy from DrinksHarbour: every seller is a registered business we review and approve and badge as Verified, sourced through authorised distributors, and rated by verified customers. Plus bottle checks before you buy and on delivery.';
export const metadata = guideMetadata('/authenticity-guarantee', title, description);

const heroPattern = 'repeating-linear-gradient(135deg, rgba(215,178,107,0.12) 0px, rgba(215,178,107,0.12) 1px, transparent 1px, transparent 9px)';

const reasons = [
  {
    icon: PiShieldCheckBold,
    title: "We don't onboard everyone",
    text: "Anyone can open a Facebook page and call it a wine shop. A seller on DrinksHarbour must be a registered business that passes our review and is approved by our team before their store goes live. Sellers who don't meet the bar never appear on the site.",
  },
  {
    icon: PiBuildingsBold,
    title: 'Stock comes from authorised distributors',
    text: 'Our sellers are required to buy their bottles from registered, authorised distribution companies — not open-market resellers. Where a bottle originally comes from is the single biggest defence against fake drinks, and it is non-negotiable here.',
  },
  {
    icon: PiStorefrontBold,
    title: "You always know who's selling",
    text: 'Every listing shows the seller behind it, and every seller has a public store on DrinksHarbour. No anonymous accounts, no mystery stock, no disappearing sellers.',
  },
  {
    icon: PiMagnifyingGlassBold,
    title: 'Clear details before you pay',
    text: 'Brand, size, origin, ABV and the exact offer are shown before checkout. If anything is unclear or missing, ask us first — we would rather answer than have you guess.',
  },
  {
    icon: PiSealCheckBold,
    title: 'Check the Verified badge',
    text: 'Every approved seller store carries a Verified badge — issued by DrinksHarbour only after the business passes our review, and never bought or self-claimed. If a store shows it, that store is one of ours. Check it before you buy.',
  },
  {
    icon: PiStarFill,
    title: 'Ratings from real buyers',
    text: 'Customers rate sellers after their orders arrive, and those ratings are public — on the store page and in the vendor directory. Only verified purchases count, and our team moderates every review, so the stars reflect real experiences.',
  },
];

const sourcingChain = [
  { icon: PiBuildingsBold, label: 'Registered distributor', caption: 'Bottles enter Nigeria through authorised distribution companies, not roadside repackaged stock.' },
  { icon: PiStorefrontBold, label: 'Approved seller', caption: 'A registered, reviewed business — badged Verified and rated by its buyers — that we can remove if it breaks the sourcing rules.' },
  { icon: PiTruckBold, label: 'Your door', caption: 'Delivered intact, with the order details you can compare against the bottle.' },
];

const onboardingSteps = [
  { title: 'Apply with real business details', text: 'A seller registers with their registered business, address and contact information. Anonymous applications go nowhere.' },
  { title: 'We review the business', text: 'Our team checks the business behind the application before anything goes live — registration details, premises and the people running it.' },
  { title: 'We check the sourcing', text: 'Sellers show where their stock comes from. We expect bottles bought from authorised distribution companies, and we can ask for proof at any time — even after launch.' },
  { title: 'Approval, then the Verified badge', text: 'Only an approved seller gets the Verified badge, a store and listings on the marketplace. Approval is ongoing, not a one-time badge: a seller that breaks the sourcing rules loses both the badge and the store.' },
];

export default function AuthenticityPage() {
  return (
    <article className="bg-[#fcfaf8] text-gray-900">
      <GuideStructuredData path="/authenticity-guarantee" name={title} description={description} />
      <header className="overflow-hidden bg-[#351014] text-white" style={{ backgroundImage: heroPattern }}>
        <div className="container mx-auto max-w-5xl px-4 pb-12 pt-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-white/65"><Link href="/" className="py-2 underline-offset-4 hover:text-white hover:underline">Home</Link><span aria-hidden="true">/</span><span className="text-white">Authenticity guarantee</span></nav>
          <p className="mt-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#e4c894]"><span className="h-px w-8 bg-[#d5b26b]" aria-hidden="true" />Know your bottle</p>
          <h1 className={`${fraunces.className} mt-4 max-w-3xl text-4xl font-medium leading-[1.08] sm:text-5xl`}>The authenticity guarantee</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">Fake drinks are a real problem in Nigeria, and they enter the market in one place: the supply chain. So that is where we start. Every bottle on DrinksHarbour travels one route — from authorised distributors, through sellers we have vetted, approved and badged as Verified, to your door. Check the badge, check the ratings, and know the route. Here is how it works.</p>
        </div>
      </header>
      <div className="container mx-auto max-w-5xl px-4">
        <section className="mt-12">
          <h2 className={`${fraunces.className} text-3xl font-medium`}>Why buy from DrinksHarbour</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {reasons.map(({ icon: Icon, title: reasonTitle, text }) => (
              <section key={reasonTitle} className="rounded-2xl border border-[#7c1d1d]/10 bg-white p-6 shadow-[0_8px_40px_-24px_rgba(53,16,20,0.28)] sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f7e9db] text-[#7c1d1d]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                  <h3 className="text-xl font-bold leading-snug">{reasonTitle}</h3>
                </div>
                <p className="mt-4 leading-7 text-gray-700">{text}</p>
              </section>
            ))}
          </div>
        </section>
        <section className="mt-10 overflow-hidden rounded-2xl bg-[#351014] p-6 text-white sm:p-8" style={{ backgroundImage: heroPattern }}>
          <h2 className={`${fraunces.className} text-2xl font-medium sm:text-3xl`}>Every bottle takes one route</h2>
          <p className="mt-3 max-w-3xl leading-7 text-white/75">A bottle is only as genuine as the chain it passed through. We allow no shortcuts in ours:</p>
          <ol className="mt-7 grid gap-4 md:grid-cols-3">
            {sourcingChain.map(({ icon: Icon, label, caption }, index) => (
              <li key={label} className="relative rounded-2xl bg-white/5 p-5 ring-1 ring-[#d5b26b]/30">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d5b26b]/15 text-[#e4c894]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e4c894]">Step {index + 1}</span>
                </div>
                <p className="mt-3 font-bold">{label}</p>
                <p className="mt-2 text-sm leading-6 text-white/70">{caption}</p>
                {index < sourcingChain.length - 1 && (
                  <>
                    <PiArrowRightBold className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[#d5b26b] md:block" aria-hidden="true" />
                    <PiArrowDownBold className="absolute -bottom-4 left-1/2 h-5 w-5 -translate-x-1/2 text-[#d5b26b] md:hidden" aria-hidden="true" />
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
        <section className="mt-12">
          <h2 className={`${fraunces.className} text-3xl font-medium`}>How a seller gets on DrinksHarbour</h2>
          <p className="mt-3 max-w-3xl leading-7 text-gray-700">This is the full path. There is no faster one, and that is the point.</p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2">
            {onboardingSteps.map(({ title: stepTitle, text }, index) => (
              <li key={stepTitle} className="flex gap-4 rounded-2xl border border-[#163a30]/10 bg-white p-6 shadow-[0_8px_40px_-24px_rgba(22,58,48,0.28)]">
                <span className={`${fraunces.className} shrink-0 text-3xl font-medium text-[#d5b26b]`} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-bold">{stepTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
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
          <p className="mt-4 max-w-3xl leading-7 text-white/80">Avoid consuming a drink if you have concerns about it. Contact support promptly with your order reference, the product name, the seller and photos of the bottle, seal, label and packaging. Share those details privately with support. A sourcing claim is only as good as what we do when it is challenged — so we treat every report as a serious one, and a seller that fails it loses the store.</p>
          <p className="mt-3 max-w-3xl leading-7 text-white/80">Our <Link href="/returns" className="font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">returns policy</Link> explains eligibility, evidence and the process for approved returns and refunds. Do not discard the item or send it back before receiving instructions.</p>
          <Link href="/contact" className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#163a30] hover:bg-[#f7e9db] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><PiEnvelopeBold aria-hidden="true" />Contact support about a bottle</Link>
        </section>
        <section className="mt-10 pb-12">
          <h2 className="text-2xl font-bold">Clear information, without guesswork</h2>
          <p className="mt-4 max-w-3xl leading-7 text-gray-700">A product listing, review or badge does not replace the details of the bottle you receive. Ask for clarification whenever product or seller information is incomplete. We do not describe a bottle as independently laboratory-tested or brand-certified unless that evidence is supplied for it — what we do guarantee is the route it took to reach us: vetted sellers, authorised distribution, and a team that answers when something looks wrong.</p>
          <nav aria-label="Buying and support information" className="mt-6 flex flex-wrap gap-x-6 gap-y-3 font-semibold text-[#7c1d1d] underline underline-offset-4">
            <Link href="/shop">Compare bottles and seller offers</Link><Link href="/vendors">Browse seller stores</Link><Link href="/shipping-info">Delivery information</Link><Link href="/faqs">Shopping FAQs</Link>
          </nav>
        </section>
      </div>
    </article>
  );
}
