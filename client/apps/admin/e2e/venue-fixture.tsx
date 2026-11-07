// Isolated browser harness for the production component; API responses are intercepted by tests.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import VenueCheckout from '../src/app/shared/venue/venue-checkout';
import VenueMenu from '../src/app/shared/venue/venue-menu';
import BookingSeat from '../src/app/shared/venue/booking-seat';
function Fixture() {
  const [seated, setSeated] = useState(false);
  if (new URLSearchParams(location.search).has('menu')) return <VenueMenu token="test-only-token" sessionId="visit" />;
  return new URLSearchParams(location.search).has('booking') && !seated
    ? <BookingSeat token="test-only-token" bookingId="booking" onSeated={async () => setSeated(true)} />
    : <VenueCheckout token="test-only-token" sessionId="visit" />;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
