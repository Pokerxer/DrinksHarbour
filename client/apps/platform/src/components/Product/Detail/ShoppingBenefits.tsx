import { DELIVERY_COPY } from '@/lib/deliveryCopy';
import Link from 'next/link';
import {
  PiTruck,
  PiShieldCheck,
  PiPackage,
  PiCertificate,
  PiArrowUpRight,
} from 'react-icons/pi';

const benefits = [
  {
    title: 'Free delivery',
    description: DELIVERY_COPY.fct,
    detail: DELIVERY_COPY.elsewhere,
    icon: PiTruck,
    colors: 'border-green-100 bg-green-50',
    iconColors: 'bg-green-100 text-green-700',
    href: '/shipping-info',
  },
  {
    title: 'Secure payment',
    description: 'Pay online securely',
    icon: PiShieldCheck,
    colors: 'border-blue-100 bg-blue-50',
    iconColors: 'bg-blue-100 text-blue-700',
  },
  {
    title: 'Order updates',
    description: 'Track your order progress',
    icon: PiPackage,
    colors: 'border-orange-100 bg-orange-50',
    iconColors: 'bg-orange-100 text-orange-700',
    href: '/order-tracking',
  },
  {
    title: 'Authentic drinks',
    description: 'From approved sellers',
    href: '/authenticity-guarantee',
    icon: PiCertificate,
    colors: 'border-purple-100 bg-purple-50',
    iconColors: 'bg-purple-100 text-purple-700',
  },
];

export default function ShoppingBenefits() {
  return (
    <section
      aria-label="Shopping benefits"
      className="border-t border-gray-100 py-5"
    >
      <ul className="grid grid-cols-2 gap-3">
        {benefits.map(
          ({ title, description, detail, icon: Icon, colors, iconColors, href }) => {
            const content = (
              <>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconColors}`}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold leading-5 text-gray-900">
                    {title}
                    {href && (
                      <PiArrowUpRight
                        size={13}
                        aria-hidden="true"
                        className="shrink-0 text-gray-400"
                      />
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-gray-600">
                    {description}
                  </span>
                  {detail && (
                    <span className="block text-xs leading-5 text-gray-500">
                      {detail}
                    </span>
                  )}
                </span>
              </>
            );
            const style = `flex h-full flex-col items-start gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-3 ${colors}`;
            return (
              <li key={title}>
                {href ? (
                  <Link
                    href={href}
                    className={`${style} transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className={style}>{content}</div>
                )}
              </li>
            );
          }
        )}
      </ul>
    </section>
  );
}
