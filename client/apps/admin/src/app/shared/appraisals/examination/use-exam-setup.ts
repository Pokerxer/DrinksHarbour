'use client';
import { setupIssues } from './setup-validation';
import { useEffect, useRef, useState } from 'react';
import {
  fetchDepartmentOptions,
  type ScopeOptionDoc,
} from '@/services/appraisal.service';
import type { PeerEmployee } from '@/services/peerAppraisal.service';
import { fetchPeerParticipants } from '@/services/peerAppraisal.service';
import {
  saveExamination,
  type ExamConfiguration,
  type QuestionBankDraft,
} from '@/services/examination.service';
export const emptyQuestion = () => ({
  prompt: '',
  options: ['', ''],
  correctOption: 0,
  marks: 2,
});
const blank = (): ExamConfiguration => ({
  durationMinutes: 30,
  attendanceFrom: '',
  attendanceTo: '',
  questionsPerEmployee: 10,
  marksPerQuestion: 2,
  departments: [],
  questions: [emptyQuestion()],
});
function editable(input?: ExamConfiguration | null): ExamConfiguration {
  if (!input) return blank();
  const month = input.attendanceMonth;
  const end =
    month && /^\d{4}-\d{2}$/.test(month)
      ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0))
          .toISOString()
          .slice(0, 10)
      : '';
  return {
    ...input,
    durationMinutes: input.durationMinutes ?? 30,
    questions: input.questions.map((q) => ({
      ...q,
      marks: q.marks ?? input.marksPerQuestion ?? 2,
    })),
    attendanceFrom: input.attendanceFrom ?? (month ? `${month}-01` : ''),
    attendanceTo: input.attendanceTo ?? end,
    questionsPerEmployee: 10,
    marksPerQuestion: input.marksPerQuestion ?? 2,
  };
}
export default function useExamSetup({
  cycleId,
  initial,
  revision,
  onDirty,
  onSaved,
  recipients,
  rosterDirty,
  rosterSavedRevision,
}: {
  recipients?: PeerEmployee[];
  rosterDirty?: boolean;
  rosterSavedRevision?: number;
  cycleId: string;
  initial?: ExamConfiguration | null;
  revision: number;
  onDirty: (dirty: boolean) => void;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(Boolean(initial));
  const [config, setConfig] = useState<ExamConfiguration>(() =>
    editable(initial)
  );
  const [expectedRevision, setRevision] = useState(revision);
  const [departments, setDepartments] = useState<ScopeOptionDoc[]>([]);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dirty = useRef(false),
    lock = useRef(false);
  useEffect(() => {
    if (dirty.current || lock.current) return;
    setEnabled(Boolean(initial));
    setConfig(editable(initial));
    setRevision(revision);
  }, [initial, revision]);
  useEffect(() => {
    if (rosterSavedRevision !== undefined) setRevision(rosterSavedRevision);
  }, [rosterSavedRevision]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchDepartmentOptions()
      .then((rows) => {
        if (active) setDepartments(rows);
      })
      .catch(() => {
        if (active)
          setError(
            'Could not load departments. Use Reload departments to try again.'
          );
      });
    return () => {
      active = false;
    };
  }, [enabled, reload]);
  function mark() {
    dirty.current = true;
    onDirty(true);
    setMessage('');
  }
  function update(next: ExamConfiguration) {
    mark();
    setConfig(
      next.recipientIds
        ? {
            ...next,
            recipientIds: next.recipientIds.filter(
              (id) =>
                recipients?.some(
                  (p) =>
                    p.employee === id &&
                    p.department &&
                    next.departments.includes(p.department)
                ) ?? true
            ),
          }
        : next
    );
  }
  function replaceBank(bank: QuestionBankDraft) {
    mark();
    setConfig((current) => ({
      ...current,
      questions: bank.questions.map((q) => ({
        ...q,
        marks: q.marks ?? bank.marksPerQuestion,
      })),
      questionsPerEmployee: 10,
      marksPerQuestion: bank.marksPerQuestion,
    }));
  }
  function toggle(value: boolean) {
    mark();
    setEnabled(value);
  }
  const eligibleRecipients = recipients?.filter(
    (p) => p.department && config.departments.includes(p.department)
  );
  const recipientIds =
    eligibleRecipients
      ?.filter(
        (p) =>
          config.recipientIds === undefined ||
          config.recipientIds.includes(p.employee)
      )
      .map((p) => p.employee) ?? config.recipientIds;
  const issues = enabled ? setupIssues(config) : [];
  if (enabled && recipientIds && !recipientIds.length)
    issues.push('Select at least one employee to receive the examination.');
  if (enabled && rosterDirty)
    issues.push('Save the cycle roster before saving examination settings.');
  const valid = issues.length === 0;
  async function save() {
    if (lock.current || !valid) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await saveExamination(
        cycleId,
        enabled
          ? {
              durationMinutes: config.durationMinutes,
              attendanceFrom: config.attendanceFrom,
              attendanceTo: config.attendanceTo,
              questionsPerEmployee: 10,
              marksPerQuestion: config.marksPerQuestion ?? 2,
              departments: config.departments,
              ...(recipientIds !== undefined ? { recipientIds } : {}),
              questions: config.questions.map((q) => ({
                prompt: q.prompt,
                options: q.options,
                correctOption: q.correctOption,
                marks: q.marks,
                ...(q.difficulty ? { difficulty: q.difficulty } : {}),
              })),
            }
          : null,
        expectedRevision
      );
      setRevision(saved.revision);
      dirty.current = false;
      onDirty(false);
      setMessage('Examination settings saved');
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save examination settings.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function discardAndReload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = await fetchPeerParticipants(cycleId);
      setEnabled(Boolean(saved.examination));
      setConfig(editable(saved.examination));
      setRevision(saved.revision ?? 0);
      dirty.current = false;
      onDirty(false);
      setMessage('Saved examination settings reloaded');
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not reload examination settings.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    enabled,
    config,
    recipientIds,
    changed: dirty.current,
    update,
    toggle,
    replaceBank,
    departments,
    reloadDepartments: () => setReload((n) => n + 1),
    busy,
    error,
    message,
    valid,
    issues,
    save,
    discardAndReload,
  };
}
