'use client';
import Availability from './availability';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { venueLocalToInstant, venueWallTime } from 'commerce-core';
import { submitVenueRequest } from '@/lib/venue/client';
import { PiSpinner } from 'react-icons/pi';
import {
  locationPath,
  type VenueLocation,
  type Reservation,
} from '@/lib/venue/types';

const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800';
type FieldErrors = { wall?: string; party?: string; name?: string; phone?: string };

export default function RequestForm({ venue }: { venue: VenueLocation }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const search = useSearchParams();
  const [wall, setWall] = useState(
    search.get('at') ||
      venueWallTime(new Date(Date.now() + 2 * 3600000), venue.timezone),
  );
  const [party, setParty] = useState(Number(search.get('party')) || 2);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [request, setRequest] = useState<Reservation | null>(null);
  const wallRef = useRef<HTMLInputElement>(null);
  const partyRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const path = locationPath(venue);
  const returnPath = `${path}/reserve?${new URLSearchParams({ at: wall, party: String(party) })}`;

  const validate = (field: 'wall' | 'party' | 'name' | 'phone', value = { wall, party, name, phone }): string | undefined => {
    if (field === 'wall') {
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value.wall) ? undefined : 'Choose a date and time for your visit.';
    }
    if (field === 'party') {
      return Number.isInteger(value.party) && value.party >= 1 && value.party <= 100
        ? undefined
        : 'Party size must be between 1 and 100 guests.';
    }
    if (field === 'name') {
      return (value.name ?? `${user?.firstName || ''} ${user?.lastName || ''}`).trim().length > 0
        ? undefined
        : 'Enter the name your table is for.';
    }
    return (value.phone ?? (user?.phoneNumber || user?.phone || '')).trim().length >= 7
      ? undefined
      : 'Enter a phone number the venue can call (at least 7 digits).';
  };
  const onBlurField = (field: keyof FieldErrors) => {
    const message = validate(field);
    setFieldErrors((previous) => ({ ...previous, [field]: message }));
  };
  const refs = { wall: wallRef, party: partyRef, name: nameRef, phone: phoneRef };
  const focusFirstInvalid = (errors: FieldErrors) => {
    const first = (['wall', 'party', 'name', 'phone'] as const).find((field) => errors[field]);
    if (first) refs[first].current?.focus();
  };
  return (
    <section className="space-y-6 text-stone-900">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-800">Plan your visit</p>
      <h1 className="font-[var(--font-kavoon)] text-3xl font-normal sm:text-4xl">Request a table · {venue.name}</h1>
      <p className="max-w-2xl leading-7 text-stone-600">
        A request does not guarantee a table. Staff will review your request. No
        deposit is collected when sending this request. Any later deposit or minimum-spend terms require your review.
      </p>
      <p className="inline-flex rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">All times below are in {venue.timezone}.</p>
      {request ? (
        <div role="status" className="space-y-4 rounded-2xl border border-green-200 bg-green-50 p-6 text-green-950">
          <h2 className="text-2xl font-bold">{request.statusLabel}</h2>
          <p className="break-all">Reference: {request.reference}</p>
          <Link
            href={`/my-account/reservations/${request.reference}`}
            className={`inline-flex min-h-11 items-center underline underline-offset-4 ${focus} focus-visible:ring-offset-2`}
          >
            View request status
          </Link>
        </div>
      ) : (
        <form
          className="max-w-2xl space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7 [&_label.block]:text-sm [&_label.block]:font-semibold [&_input:not([type=checkbox])]:mt-1 [&_input:not([type=checkbox])]:min-h-12 [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-xl [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-stone-300 [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:p-3 [&_input:not([type=checkbox])]:text-base [&_input:not([type=checkbox])]:text-stone-900 [&_input:not([type=checkbox]):focus-visible]:outline-none [&_input:not([type=checkbox]):focus-visible]:ring-2 [&_input:not([type=checkbox]):focus-visible]:ring-red-800"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !user) return;
            const values = { wall, party, name, phone };
            const nextErrors: FieldErrors = {
              wall: validate('wall', values),
              party: validate('party', values),
              name: validate('name', values),
              phone: validate('phone', values),
            };
            setFieldErrors(nextErrors);
            if (Object.values(nextErrors).some(Boolean)) {
              focusFirstInvalid(nextErrors);
              return;
            }
            setBusy(true);
            setError('');
            try {
              const input = {
                guest: {
                  name: name ?? `${user.firstName} ${user.lastName}`.trim(),
                  phone: phone ?? (user.phoneNumber || user.phone || ''),
                },
                partySize: party,
                bookingAt: venueLocalToInstant(wall, venue.timezone),
              };
              setRequest(
                await submitVenueRequest<Reservation>(
                  venue.tenant.slug,
                  venue.slug,
                  user._id,
                  input,
                ),
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Unable to send request',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 p-4 text-stone-900"
            >
              We could not send this request: {error}. Check the fields below, or
              press Send again after fixing them.
            </p>
          )}
          <label className="block">
            Requested date and time
            <input
              ref={wallRef}
              type="datetime-local"
              required
              value={wall}
              aria-invalid={!!fieldErrors.wall || undefined}
              aria-describedby={fieldErrors.wall ? 'wall-help' : undefined}
              onBlur={() => onBlurField('wall')}
              onChange={(e) => setWall(e.target.value)}
            />
          </label>
          <p id="wall-help" className="mt-1 text-xs leading-6 text-stone-600">Pick a time within the venue&apos;s opening hours for {venue.timezone}.</p>
          {fieldErrors.wall && <p role="alert" className="text-sm font-medium text-red-800">{fieldErrors.wall}</p>}
          <label className="block">
            Party size
            <input
              ref={partyRef}
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              step={1}
              required
              aria-invalid={!!fieldErrors.party || undefined}
              aria-describedby={fieldErrors.party ? 'party-help' : undefined}
              onBlur={() => onBlurField('party')}
              value={party}
              onChange={(e) => setParty(Number(e.target.value))}
            />
          </label>
          <p id="party-help" className="mt-1 text-xs leading-6 text-stone-600">Between 1 and 100 guests. Very large groups may need a separate agreement with the venue.</p>
          {fieldErrors.party && <p role="alert" className="text-sm font-medium text-red-800">{fieldErrors.party}</p>}
          <Availability slug={venue.tenant.slug} locationSlug={venue.slug} wall={wall} timezone={venue.timezone} partySize={party}/>
          {!isLoading && !isAuthenticated ? (
            <div className="space-y-2">
              <p className="text-sm leading-6 text-stone-600">You are previewing this form. Sign in to send the request without losing your date and party size.</p>
              <Link
                className={`inline-flex min-h-12 items-center rounded-xl bg-red-800 px-5 py-3 font-semibold text-white transition hover:bg-red-900 ${focus} focus-visible:ring-offset-2`}
                href={`/login?redirect=${encodeURIComponent(returnPath)}`}
              >
                Sign in to send your request
              </Link>
            </div>
          ) : (
            <>
              <label className="block">
                Guest name
                <input
                  ref={nameRef}
                  required
                  autoComplete="name"
                  maxLength={120}
                  aria-invalid={!!fieldErrors.name || undefined}
                  onBlur={() => onBlurField('name')}
                  value={
                    name ??
                    `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
                  }
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {fieldErrors.name && <p role="alert" className="text-sm font-medium text-red-800">{fieldErrors.name}</p>}
              <label className="block">
                Phone number
                <input
                  ref={phoneRef}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  maxLength={40}
                  aria-invalid={!!fieldErrors.phone || undefined}
                  onBlur={() => onBlurField('phone')}
                  value={phone ?? (user?.phoneNumber || user?.phone || '')}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              {fieldErrors.phone && <p role="alert" className="text-sm font-medium text-red-800">{fieldErrors.phone}</p>}
              <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <h2 className="font-semibold">Visit policies</h2>
                <p className="whitespace-pre-wrap text-sm leading-7 text-stone-600">{venue.policies}</p>
              </div>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6 text-stone-700">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-red-800"
                  required
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />{' '}
                I have read the policies and understand this request awaits
                venue confirmation.
              </label>
              <button
                disabled={busy || isLoading || !agreed}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-800 px-5 py-3 font-semibold text-white transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50 ${focus} focus-visible:ring-offset-2 sm:w-auto w-full`}
              >
                {busy && <PiSpinner size={20} aria-hidden="true" className="motion-safe:animate-spin" />}
                {busy ? 'Sending request…' : 'Send table request'}
              </button>
            </>
          )}
        </form>
      )}
      <Link href={path} className={`inline-flex min-h-11 items-center underline underline-offset-4 hover:text-red-800 ${focus} focus-visible:ring-offset-2`}>
        Back to location and menu
      </Link>
    </section>
  );
}
