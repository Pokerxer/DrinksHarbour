import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import EventOccurrences from './event-occurrences';
import type { VenueLocation } from '@/lib/venue/types';

afterEach(() => { cleanup(); });

const venue = (events: VenueLocation['events']): VenueLocation => ({
  tenant: { id: 't1', slug: 'venue', name: 'Venue' },
  locationId: 'l1',
  version: 1,
  slug: 'main',
  name: 'Main lounge',
  types: ['lounge'],
  timezone: 'Africa/Lagos',
  description: '',
  address: 'Abuja',
  hours: [],
  exceptions: [],
  policies: '',
  bookingMode: 'request',
  retailAvailable: false,
  events,
});

it('lists published occurrences with admission terms and request-only availability language', () => {
  render(<EventOccurrences venue={venue({ items: [{
    eventSlug: 'afro-night',
    name: 'Afro Night',
    occurrenceDate: '2026-11-06',
    startAt: '2026-11-06T22:00:00.000Z',
    endAt: '2026-11-07T02:00:00.000Z',
    minimumAge: 18,
    admissionTerms: '18+ with valid ID at the door.',
    availability: { status: 'inquire', message: 'Capacity is limited and entry is arranged with the venue directly. Availability may change; age and admission terms apply at the door.' },
  }] })} />);
  expect(screen.getByText('Afro Night on Friday, 6 November 2026')).toBeTruthy();
  expect(screen.getByText('18+ with valid ID at the door.')).toBeTruthy();
  expect(screen.getByText(/Availability may change/)).toBeTruthy();
  expect(screen.getByText(/no booking or payment happens on this page/i)).toBeTruthy();
});

it('shows an empty state without promising any ordering or payment', () => {
  render(<EventOccurrences venue={venue(undefined)} />);
  expect(screen.getByText(/No upcoming events have been published/)).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByText(/never takes bookings or payments/i)).toBeTruthy();
});
