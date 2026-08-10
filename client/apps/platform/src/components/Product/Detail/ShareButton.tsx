'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Icon from 'react-icons/pi';
import ShareSheet from './ShareSheet';

interface ShareButtonProps {
  /** Product name — used in the share text and as the aria-label. */
  name: string;
  /** Short product description, appended to the share text (truncated). */
  description?: string;
  /** Canonical URL to share. Defaults to the current page URL. */
  url?: string;
  /** Extra classes for the trigger button (defaults to the action-row style). */
  className?: string;
}

/**
 * "Share this product" trigger. Renders the action-row button and owns the
 * sheet's open state + focus restoration; the sheet itself lives in
 * ShareSheet (channels, native share, copy link).
 */
export default function ShareButton({ name, description, url, className = '' }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Return focus to the trigger button whenever the sheet closes. Using a
  // useEffect keyed on `open` avoids the race between requestAnimationFrame
  // and AnimatePresence exit animations that would sometimes land focus on
  // <body> instead.
  useEffect(() => {
    if (!open && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Share ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          className ||
          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium transition-all'
        }
      >
        <Icon.PiShareNetwork size={18} />
        Share
      </button>

      <ShareSheet open={open} name={name} description={description} url={url} onClose={close} />
    </>
  );
}