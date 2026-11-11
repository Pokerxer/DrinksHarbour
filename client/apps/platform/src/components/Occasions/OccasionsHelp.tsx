import { ELSEWHERE_DELIVERY_WINDOW } from '@/lib/deliveryCopy';
import Link from 'next/link';
import { PiTruckBold, PiSealCheckBold, PiScalesBold, PiArrowUpRightBold } from 'react-icons/pi';

const help = [
  { Icon: PiScalesBold, title: 'Compare the same bottle', text: 'Match the label, size and pack count. Check seller offers and the final order total before paying.', href: '/shop', label: 'Browse the drinks shop' },
  { Icon: PiTruckBold, title: 'Leave room for delivery', text: `Same-day delivery is available for eligible Abuja orders. Delivery elsewhere in Nigeria takes ${ELSEWHERE_DELIVERY_WINDOW}.`, href: '/shipping-info', label: 'Check delivery details' },
  { Icon: PiSealCheckBold, title: 'Know what you are buying', text: 'Review bottle and seller details, ask about missing information, and keep your order reference.', href: '/authenticity-guarantee', label: 'Bottle checks & support' },
];

export default function OccasionsHelp() {
  return <>
    <section className="border-y border-gray-200 bg-white" aria-labelledby="occasion-details">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><h2 id="occasion-details" className="text-2xl font-bold tracking-tight text-gray-950">The little details that matter.</h2>
        <div className="mt-7 grid gap-8 md:grid-cols-3">{help.map(({ Icon, title, text, href, label }) => <div key={title}>
          <Icon className="h-6 w-6 text-[#7c1d1d]" aria-hidden="true" /><h3 className="mt-4 text-base font-bold text-gray-900">{title}</h3><p className="mt-2 text-sm leading-6 text-gray-600">{text}</p><Link href={href} className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-[#7c1d1d] hover:underline">{label}<PiArrowUpRightBold aria-hidden="true" /></Link>
        </div>)}</div>
      </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_1.7fr]" aria-labelledby="occasion-questions">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c1d1d]">A few useful answers</p><h2 id="occasion-questions" className="mt-3 text-2xl font-bold tracking-tight">Before you start.</h2><p className="mt-3 text-sm leading-6 text-gray-600">Planning around a deadline? Check the <Link href="/delivery/abuja" className="font-semibold underline">Abuja</Link> or <Link href="/delivery/lagos" className="font-semibold underline">Lagos</Link> guide before ordering.</p></div>
      <div className="divide-y divide-gray-200 border-y border-gray-200">
        <details className="py-5"><summary className="cursor-pointer text-sm font-semibold text-gray-900">Does my enquiry reserve drinks or book delivery?</summary><p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">No. It starts a conversation with our team. Confirm the exact bottles, stock, prices and available delivery options before placing your order.</p></details>
        <details className="py-5"><summary className="cursor-pointer text-sm font-semibold text-gray-900">Can you include gift packaging or event extras?</summary><p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">Tell us what you have in mind in your brief. Gift boxes, wrapping, messages, chilling, ice, glassware and serving services are not automatically included and need separate confirmation.</p></details>
        <details className="py-5"><summary className="cursor-pointer text-sm font-semibold text-gray-900">What about guests who do not drink alcohol?</summary><p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">Include their preferences in your brief and <Link className="font-semibold text-[#7c1d1d] underline" href="/shop?category=non-alcoholic">browse non-alcoholic choices</Link>. Check each product’s exact label and ABV. Alcoholic drinks are available only to adults aged 18 and over.</p></details>
      </div>
    </section>
  </>;
}
