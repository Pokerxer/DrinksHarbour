'use client';

import * as Icon from 'react-icons/pi';

/**
 * Star rating display. Renders the 1–5 average as filled / half / empty stars
 * and rounds to the nearest half (the API rounds averages to 1 decimal).
 */
export default function RatingStars({ value, size = 14 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${clamped.toFixed(1)} out of 5`} role="img">
      {[1, 2, 3, 4, 5].map((star) => {
        if (clamped >= star - 0.25) {
          return <Icon.PiStarFill key={star} size={size} className="text-amber-500" aria-hidden="true" />;
        }
        if (clamped >= star - 0.75) {
          return <Icon.PiStarHalfFill key={star} size={size} className="text-amber-500" aria-hidden="true" />;
        }
        return <Icon.PiStar key={star} size={size} className="text-gray-300" aria-hidden="true" />;
      })}
    </span>
  );
}
