// client/apps/platform/src/components/Merchandising/SponsoredBadge.tsx
'use client';

import React from 'react';

/**
 * Mandatory paid-placement disclosure (Task 10, Global Constraints): a paid
 * placement never renders without this chip. Muted, uppercase, tracked —
 * visually quiet but always legible.
 */
const SponsoredBadge: React.FC = () => (
  <span
    className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
  >
    Sponsored
  </span>
);

export default SponsoredBadge;
