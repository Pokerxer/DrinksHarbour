'use client';

import { useId } from 'react';
import { PiGift, PiCheck } from 'react-icons/pi';
import { useGiftPackaging } from '@/components/Checkout/CheckoutGiftSection';
import { GIFT_MESSAGE_MAX } from '@/lib/giftCheckout';
import { gtagEvent } from '@/lib/gtag';
import { money } from './offers';
import styles from './merchandising.module.css';

function GiftFields({ message, onMessage, id }: { message: string; onMessage: (value: string) => void; id: string }) {
  const packaging = useGiftPackaging();
  return (
    <div id={id} className={`${styles.reveal} ${styles.ticket} mt-4 space-y-3`}>
      <label className="block text-sm font-semibold">
        Gift message <span className="font-normal text-gray-600">(optional)</span>
        <textarea rows={3} maxLength={GIFT_MESSAGE_MAX} value={message} onChange={event => onMessage(event.target.value)}
          className={`${styles.control} mt-1 block w-full rounded-xl border border-[#ead9df] bg-white px-3 py-2 text-sm font-normal`}
          placeholder="Write a note for the recipient" />
      </label>
      {(packaging.price !== null || packaging.inCart) && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#ead9df] bg-white p-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[#781934]" checked={packaging.inCart}
            onChange={event => {
              packaging.setRequested(event.target.checked);
              gtagEvent('merchandising_select', { source: 'gift_wrapping', selected: event.target.checked });
            }} />
          <span className="flex-1 font-semibold">Gift wrapping</span>
          {packaging.price !== null && <span className="font-semibold tabular-nums">{money(packaging.price)}</span>}
        </label>
      )}
      {packaging.status === 'loading' && <p role="status" className="text-xs text-gray-600">Checking gift wrapping…</p>}
      {packaging.status === 'unavailable' && !packaging.inCart &&
        <p className="text-xs text-gray-600">Gift wrapping is currently unavailable.</p>}
      <p className="text-xs text-gray-600">Add recipient and delivery details at checkout.</p>
    </div>
  );
}

export default function CartGiftOptions({ enabled, message, onToggle, onMessage }: {
  enabled: boolean;
  message: string;
  onToggle: () => void;
  onMessage: (value: string) => void;
}) {
  const id = useId();
  return (
    <section aria-label="Gift options" className={`${styles.panel} my-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`${styles.title} flex items-center gap-2`}><PiGift aria-hidden /> Make it a gift</h2>
        <button type="button" aria-expanded={enabled} aria-controls={enabled ? id : undefined} className={styles.button}
          onClick={onToggle}>{enabled ? <><PiCheck aria-hidden /> Remove gift options</> : 'Add gift options'}</button>
      </div>
      {enabled && <GiftFields id={id} message={message} onMessage={onMessage} />}
    </section>
  );
}
