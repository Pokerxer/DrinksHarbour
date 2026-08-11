'use client';

// Gated by the `/employees/:path*` matcher in middleware.ts, like everything
// else under /employees. Only the kiosk the screens themselves open lives
// outside it, at /kiosk/<token>.
import KioskDevicesPage from '@/app/shared/employees/kiosk-devices-page';

export default function AttendanceDevicesPage() {
  return <KioskDevicesPage />;
}
