import Link from 'next/link';
import { PiWine } from 'react-icons/pi';
import { money, offerHref, offerIdentity, type Offer } from './offers';
import { useOfferImpression } from './useOfferImpression';
import styles from './merchandising.module.css';

export default function OfferRow({ offer, source, detail, children }: {
  offer: Offer;
  source: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  const ref = useOfferImpression<HTMLDivElement>(source, offerIdentity(offer));
  const photo = offer.product.primaryImage?.url || offer.product.images?.[0]?.url;
  return (
    <div ref={ref} className={`${styles.row} ${styles.reveal}`}>
      <div className={styles.photo} aria-hidden="true">
        {photo ? <img src={photo} alt="" loading="lazy" width="44" height="56" /> : <PiWine size={21} />}
      </div>
      <div className="min-w-0">
        <Link className={`${styles.control} break-words text-sm font-semibold text-gray-900 hover:underline`} href={offerHref(offer)}>
          {offer.product.name}
        </Link>
        <p className="mt-0.5 text-xs text-gray-600">
          {offer.size.displayName || offer.size.size} · {offer.seller.tenant.name}
        </p>
        <p className="mt-1 text-sm font-bold tabular-nums text-[#781934]">{money(offer.price)}</p>
        {detail && <p className="mt-1 text-xs text-gray-600">{detail}</p>}
      </div>
      {children && <div className={styles.rowAction}>{children}</div>}
    </div>
  );
}
