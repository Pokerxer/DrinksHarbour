'use client';
import { useEffect, useRef, useState } from 'react';
import {
  fetchExamination,
  startExamination,
  saveExamAnswers,
  submitExamAnswers,
  type OwnExamination,
} from '@/services/examination.service';
import useExamClock from './use-exam-clock';
export default function useEmployeeExam(cycleId: string) {
  const [exam, setExam] = useState<OwnExamination | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [saved, setSaved] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const current = useRef(exam),
    selected = useRef(answers),
    lock = useRef(false);
  const active = useRef(true),
    expiryRequested = useRef(false),
    savedKey = useRef('');
  current.current = exam;
  selected.current = answers;
  const remaining = useExamClock(exam),
    expired = remaining === 0;
  function accept(data: OwnExamination) {
    setExam(data);
    current.current = data;
    const next = Object.fromEntries(
      (data.answers ?? []).map((a) => [a.question, a.option])
    );
    setAnswers(next);
    selected.current = next;
    savedKey.current = JSON.stringify(
      (data.questions ?? [])
        .filter((q) => next[q.question] !== undefined)
        .map((q) => ({ question: q.question, option: next[q.question] }))
    );
    setSaved(true);
  }
  useEffect(() => {
    active.current = true;
    let cancelled = false;
    setExam(null);
    setError('');
    expiryRequested.current = false;
    fetchExamination(cycleId)
      .then((data) => {
        if (!cancelled) accept(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : 'Could not load examination.'
          );
      });
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [cycleId, reload]);
  function choose(question: string, option: number) {
    setAnswers((a) => ({ ...a, [question]: option }));
    setSaved(false);
    setError('');
    setMessage('');
  }
  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await startExamination(cycleId);
      if (active.current) accept(data);
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error ? e.message : 'Could not start examination.'
        );
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function persist(submit: boolean) {
    const data = current.current;
    if (
      lock.current ||
      !data ||
      data.submittedAt ||
      data.status !== 'collecting' ||
      expired
    )
      return;
    const payload = (data.questions ?? [])
      .filter((q) => selected.current[q.question] !== undefined)
      .map((q) => ({
        question: q.question,
        option: selected.current[q.question],
      }));
    if (submit && payload.length !== data.questions?.length) return;
    setSubmitting(submit);
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await (submit ? submitExamAnswers : saveExamAnswers)(
        cycleId,
        payload,
        data.revision ?? 0
      );
      if (!active.current) return;
      setExam((old) => (old ? { ...old, ...response } : old));
      if (response.submittedAt) {
        accept({ ...data, ...response });
        setMessage(
          response.timedOut
            ? 'Time expired. Saved answers were marked.'
            : 'Examination submitted'
        );
      } else {
        savedKey.current = JSON.stringify(payload);
        const latest = (data.questions ?? [])
          .filter((q) => selected.current[q.question] !== undefined)
          .map((q) => ({
            question: q.question,
            option: selected.current[q.question],
          }));
        setSaved(JSON.stringify(latest) === savedKey.current);
        setMessage('Examination draft saved');
      }
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error ? e.message : 'Could not save examination.'
        );
    } finally {
      lock.current = false;
      if (active.current) {
        setBusy(false);
        setSubmitting(false);
      }
    }
  }
  async function finalize() {
    if (lock.current) return;
    expiryRequested.current = true;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await fetchExamination(cycleId);
      if (active.current) {
        if (data.submittedAt) accept(data);
        else {
          setExam(data);
          expiryRequested.current = false;
        }
      }
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Could not load the final score. Retry finalization.'
        );
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (
      !exam?.durationMinutes ||
      !exam.startedAt ||
      exam.submittedAt ||
      expired ||
      busy ||
      saved ||
      error
    )
      return;
    const timer = setTimeout(() => {
      void persist(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [answers, exam, busy, saved, error, expired]);
  useEffect(() => {
    if (
      expired &&
      exam?.status === 'collecting' &&
      !exam.submittedAt &&
      !busy &&
      !expiryRequested.current
    )
      void finalize();
  }, [expired, exam?.status, exam?.submittedAt, busy]);
  const questions = exam?.questions ?? [];
  return {
    exam,
    answers,
    error,
    message,
    busy,
    submitting,
    saved,
    remaining,
    expired,
    choose,
    start,
    persist,
    finalize,
    retry: () => setReload((n) => n + 1),
    complete:
      questions.length > 0 &&
      questions.every((q) => answers[q.question] !== undefined),
  };
}
