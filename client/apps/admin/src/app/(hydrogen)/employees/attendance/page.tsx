'use client';

import { Suspense } from 'react';
import AttendanceLogPage from '@/app/shared/employees/attendance-log-page';

export default function AttendancePage() {
  return (
    <Suspense>
      <AttendanceLogPage />
    </Suspense>
  );
}
