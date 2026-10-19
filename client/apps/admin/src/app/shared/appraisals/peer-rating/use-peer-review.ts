'use client';
import { useEffect, useRef, useState } from 'react';
import {
  savePeerRatings,
  submitPeerRatings,
  type PeerReview,
} from '@/services/peerAppraisal.service';
export default function usePeerReview(
  cycleId: string,
  review: PeerReview,
  onSubmitted: () => void
) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(review.ratings.map((r) => [r.subject, r.rating]))
  );
  const [revision, setRevision] = useState(review.revision);
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(Boolean(review.submittedAt));
  const lock = useRef(false);
  const readOnly =
    submitted ||
    Boolean(review.submittedAt) ||
    review.status !== 'collecting' ||
    review.isAppraiser === false;
  const count = review.colleagues.filter(
    (c) => values[c.employee] !== undefined
  ).length;
  const complete =
    review.colleagues.length > 0 && count === review.colleagues.length;
  useEffect(() => {
    if (!dirty || readOnly) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, readOnly]);
  function choose(employee: string, rating: number) {
    if (readOnly || lock.current) return;
    setValues((v) => ({ ...v, [employee]: rating }));
    setDirty(true);
    setMessage('');
    setError('');
  }
  async function persist(submit: boolean) {
    if (lock.current || readOnly || (submit && !complete)) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    const ratings = review.colleagues
      .filter((c) => values[c.employee] !== undefined)
      .map((c) => ({ subject: c.employee, rating: values[c.employee] }));
    try {
      const saved = await (submit ? submitPeerRatings : savePeerRatings)(
        cycleId,
        ratings,
        revision
      );
      setRevision(saved.revision);
      setDirty(false);
      if (submit) {
        setSubmitted(true);
        onSubmitted();
      } else setMessage('Draft saved');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not save your ratings. Try again.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    values,
    busy,
    dirty,
    message,
    error,
    readOnly,
    submitted,
    count,
    complete,
    choose,
    persist,
  };
}
