'use client';
import { useParams } from 'next/navigation';
import AppraisalNominateForm from '@/app/shared/appraisals/appraisal-nominate-form';

// Deliberately does not call `getAppraisal` (or anything that does) — the
// subject is 403'd on `GET /api/appraisals/:id` at every state before
// `released`, and `nominating` is always before `released`. This route is
// fed exclusively by `AppraisalNominateForm`'s own `getNomination` /
// `getEligiblePeers` calls, mirroring how `reviews/[feedbackId]/page.tsx`
// hands off to `ReviewerForm` without touching the appraisal endpoint.
export default function AppraisalNominatePage() {
  const { id } = useParams<{ id: string }>();
  return <AppraisalNominateForm appraisalId={id} />;
}
