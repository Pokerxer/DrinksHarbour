'use client';

// The public clock — `/kiosk/<token>`.
//
// WHY THIS IS A NEW TOP-LEVEL ROUTE AND NOT AN EXCLUSION
// -----------------------------------------------------
// `src/middleware.ts` gates by an EXPLICIT PATH LIST (`config.matcher`), and
// `/employees/:path*` is on it — which covers the in-app kiosk at
// `/employees/attendance/kiosk`. A page that must render logged out therefore
// has to live outside that matcher, and the matcher is a list of what IS gated,
// so the way out is a path that is not on it rather than a hole punched in one
// that is.
//
// Un-gating `/employees` would have been the short way and is the wrong one: it
// would make the entire employee namespace public, including the list of staff
// and the HR profiles. The comment above `isUnder()` in that file is about
// exactly this class of mistake.
//
// The token in the URL is the credential. It names the device, the device names
// the tenant, and the tenant is what every lookup behind the clock is scoped
// by — the two jobs a manager's JWT used to do. It is revocable from Settings,
// and until it resolves this page knows nothing about which shop it is in.
//
// This route is deliberately NOT indexed: it is one shop's counter screen, and
// a search engine holding the URL is a copy of the credential.

import { use } from 'react';
import AttendanceKioskPage from '@/app/shared/employees/attendance-kiosk-page';

export default function PublicKioskPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  // Decoded, because the token rides in a path segment. base64url has nothing
  // that needs escaping, but a token pasted from a mail client can arrive
  // percent-encoded anyway, and a token that does not match byte for byte is
  // simply an unpaired kiosk with no explanation.
  return <AttendanceKioskPage kioskToken={decodeURIComponent(token)} />;
}
