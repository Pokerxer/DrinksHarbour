'use client';

import { PiEye, PiEyeSlash } from 'react-icons/pi';
import type { FeedbackKind } from '@/services/appraisal.service';

/**
 * Maps each role token the server sends to human-readable copy, disambiguated
 * by the reviewer's `kind` (e.g. 'employee' means "you" on a self-assessment
 * but "the person you're reviewing" on a peer/manager review). The list always
 * comes from the payload — never hardcoded per-kind — so this stays correct
 * if the server adds roles.
 */
const KNOWN_ROLE_PHRASES: Record<string, (kind: FeedbackKind) => string> = {
  manager: (kind) => {
    if (kind === 'self') return 'your manager';
    if (kind === 'manager') return 'you';
    return "the manager of the person you're reviewing";
  },
  hr: () => 'HR',
  employee: (kind) => (kind === 'self' ? 'you' : "the person you're reviewing"),
};

function roleLabel(token: string, kind: FeedbackKind): string {
  return KNOWN_ROLE_PHRASES[token]?.(kind) ?? token;
}

function formatRoleList(tokens: string[], kind: FeedbackKind): string {
  const phrases = tokens.map((t) => roleLabel(t, kind));
  if (phrases.length === 0) return '';
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
}

/**
 * Disclosure banner shown at the top of the form so the reviewer knows exactly
 * who will see their name BEFORE they start writing — calibrating candour is
 * impossible after the fact. All copy is derived from the server's `namedTo` /
 * `anonymousTo` lists, never hardcoded per-kind.
 */
export default function ReviewDisclosureBanner({
  namedTo,
  anonymousTo,
  withheldFrom = [],
  kind,
}: {
  namedTo: string[];
  anonymousTo: string[];
  /**
   * Who does not receive this feedback AT ALL — a stronger claim than
   * `anonymousTo`, and the one that applies to peers now. Defaulted so an
   * older cached payload without the key still renders.
   */
  withheldFrom?: string[];
  kind: FeedbackKind;
}) {
  const hasNamed = namedTo.length > 0;
  const hasAnonymous = anonymousTo.length > 0;
  const hasWithheld = withheldFrom.length > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50/40 p-5">
      {/* Decorative corner accent */}
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-100/40 blur-xl" />

      <div className="relative flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <PiEye className="h-4.5 w-4.5 text-amber-700" />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-amber-900">
            Who will see your name on this
          </p>
          {hasNamed && (
            <div className="flex items-start gap-2 text-[13px] text-amber-800">
              <PiEye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p>
                Your name <span className="font-semibold">is visible</span> to:{' '}
                {formatRoleList(namedTo, kind)}.
              </p>
            </div>
          )}
          {/* Deliberately stronger wording than the anonymity line below, and
              shown first. "Anonymous" invites the reader to picture their words
              reaching the subject with the name filed off — which is what makes
              a peer write something unfalsifiably vague. The truth is better
              for both sides: the subject never receives this row, so the
              specifics that make feedback useful are safe to write down. */}
          {hasWithheld && (
            <div className="flex items-start gap-2 text-[13px] text-amber-800">
              <PiEyeSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p>
                <span className="font-semibold">
                  {formatRoleList(withheldFrom, kind)} will not see this at all
                </span>{' '}
                — not your name, and not what you wrote. It is read by the
                people above, who use it to write the summary.
              </p>
            </div>
          )}
          {hasAnonymous ? (
            <div className="flex items-start gap-2 text-[13px] text-amber-800">
              <PiEyeSlash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p>
                Your name is <span className="font-semibold">not shown</span>{' '}
                to: {formatRoleList(anonymousTo, kind)}.
              </p>
            </div>
          ) : (
            hasNamed &&
            !hasWithheld && (
              <div className="flex items-start gap-2 text-[13px] text-amber-800">
                <PiEye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <p>
                  Nobody sees this anonymously — everyone listed above will see
                  it&rsquo;s from you.
                </p>
              </div>
            )
          )}
          {!hasNamed && !hasAnonymous && !hasWithheld && (
            <p className="text-[13px] text-amber-700">
              No one has been configured to see this feedback yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
