'use client';
import { useParams } from 'next/navigation';
import AppraisalDetail from '@/app/shared/appraisals/appraisal-detail';

export default function AppraisalDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <AppraisalDetail id={id} />;
}
