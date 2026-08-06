'use client';
import { useParams } from 'next/navigation';
import ReviewerForm from '@/app/shared/appraisals/reviewer-form';

export default function AppraisalReviewPage() {
  const { feedbackId } = useParams<{ feedbackId: string }>();
  return <ReviewerForm feedbackId={feedbackId} />;
}
