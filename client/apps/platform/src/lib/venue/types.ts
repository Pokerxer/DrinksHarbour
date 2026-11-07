export type VenueLocation = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    logo?: string;
    city?: string;
  };
  locationId: string;
  version: number;
  slug: string;
  name: string;
  types: string[];
  timezone: string;
  description: string;
  address: string;
  hours: { day: number; opens: string; closes: string; overnight?: boolean }[];
  exceptions: {
    date: string;
    closed: boolean;
    opens?: string;
    closes?: string;
    overnight?: boolean;
  }[];
  policies: string;
  publicPhone?: string;
  photos?: { url: string; alt: string }[];
  bookingMode: 'request' | 'disabled';
  retailAvailable: boolean;
  events?: { items: PublicEventOccurrence[] };
  menu?: {
    schemaVersion?:2;
    categories?:{id:string;sectionId:string;parentId:string|null;name:string;sortOrder:number}[];
    sections: {
      id: string;
      name: string;
      items: {
        categoryId?:string;display?:string;
        subProductId: string;
        sizeId: string;
        name: string;
        sizeLabel: string;
        unitPriceMinor: number;
        taxMinor: number;
        currency: string;
        alcoholic: boolean;
        abv: number;
        available: boolean;
      }[];
    }[];
  };
};
export type PublicEventOccurrence = {
  eventSlug: string;
  name: string;
  occurrenceDate: string;
  startAt: string;
  endAt: string;
  minimumAge?: number;
  admissionTerms: string;
  availability: { status: string; message: string };
};
export type BookingPayment = {state:string;policyVersion:number;currency:string;depositMinor:number;minimumMinor?:number;minimumTerms?:string;eligibility?:string;excludedSubProductIds?:string[];shortfallClassification?:string|null;shortfallTaxRate?:number|null;termsAccepted?:boolean;deadline:string|null;cancellationTerms:string;noShowTerms:string;excessCreditTerms:string;collectionEnabled:boolean;receivedMinor?:number;appliedCreditMinor?:number;unappliedCreditMinor?:number;refundedMinor?:number};
export type Reservation = {
  payment?: BookingPayment|null;
  id: string;
  reference: string;
  status: string;
  statusLabel: string;
  requestState: string;
  version: number;
  bookingAt: string;
  partySize: number;
  guest: { name: string; phone: string };
  locationId: string;
  serviceSessionId: string | null;
  policy: {
    timezone: string;
    policies: string;
    locationName: string;
    venueName: string;
  };
};
export const locationPath = (venue: VenueLocation) =>
  `/venues/${encodeURIComponent(venue.tenant.slug)}/locations/${encodeURIComponent(venue.slug)}`;
