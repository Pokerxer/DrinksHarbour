'use client';

import { motion } from 'framer-motion';
import {
  PiEnvelopeSimpleBold,
  PiPhoneBold,
  PiFileTextBold,
  PiTrayBold,
} from 'react-icons/pi';
import { formatJoined, signupSummary } from './cart-meta';
import type { AdminSignupRow } from '@/services/adminCart.service';

/**
 * A new customer who has not built a cart.
 *
 * No expand, no lines — the point of the row is that there is nothing to
 * expand. Same five columns as CartTableRow so the table stays visually square
 * when the two row types are interleaved.
 *
 * Always "worth chasing": an empty basket on a fresh signup is precisely the
 * share of the funnel this view exists to surface, so the Quote button gets the
 * filled treatment unconditionally (CartTableRow earns it via isFollowUpWorthy).
 *
 * The "No cart yet" copy is deliberately generic — it must never imply another
 * store is involved. A shopper whose only cart holds other tenants' lines is
 * returned by the server as a cart row with `skippedCount`, never as a signup.
 */
export default function SignupTableRow({
  signup,
  index,
  onCreateQuotation,
}: {
  signup: AdminSignupRow;
  index: number;
  onCreateQuotation: (signup: AdminSignupRow) => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="border-b border-muted transition-colors hover:bg-gray-50"
    >
      {/* Shopper */}
      <td className="px-5 py-4">
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-gray-900">
            {signup.user.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-400">
            {signup.user.email || signup.user.phone || 'No contact on file'}
          </span>
        </span>
      </td>

      {/* Contents */}
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
          <PiTrayBold className="h-3.5 w-3.5" />
          {signupSummary()}
        </span>
      </td>

      {/* Value */}
      <td className="px-5 py-4 text-sm text-gray-400">—</td>

      {/* Joined */}
      <td className="px-5 py-4">
        <span className="text-xs font-medium text-gray-500">Joined</span>
        <span className="mt-0.5 block text-xs text-gray-400">
          {formatJoined(signup.joinedAt)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {signup.user.email && (
            <a
              href={`mailto:${signup.user.email}`}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title={`Email ${signup.user.email}`}
              aria-label={`Email ${signup.user.name}`}
            >
              <PiEnvelopeSimpleBold className="h-4 w-4" />
            </a>
          )}
          {signup.user.phone && (
            <a
              href={`tel:${signup.user.phone}`}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title={`Call ${signup.user.phone}`}
              aria-label={`Call ${signup.user.name}`}
            >
              <PiPhoneBold className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => onCreateQuotation(signup)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <PiFileTextBold className="h-3.5 w-3.5" />
            Quote
          </button>
        </div>
      </td>
    </motion.tr>
  );
}