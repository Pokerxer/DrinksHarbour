'use client';
import { useParams } from 'next/navigation';
import CycleDetail from '@/app/shared/appraisals/peer-rating/cycle-entry';

export default function AppraisalCycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <CycleDetail id={id} />;
}
