'use client';
import { useParams } from 'next/navigation';
import EmployeeDetail from '@/app/shared/employees/employee-detail';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <EmployeeDetail employeeId={id} />;
}
