'use client';

import { use } from 'react';
import AttendanceHistoryPage from '@/app/shared/employees/attendance-history-page';

// `/kiosk` is a static segment, so it still wins over this dynamic one.
export default function EmployeeAttendancePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = use(params);
  return <AttendanceHistoryPage employeeId={employeeId} />;
}
