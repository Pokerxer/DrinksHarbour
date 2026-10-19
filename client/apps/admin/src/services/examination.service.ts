import {
  appraisalRequest as request,
  type AppraisalCycle,
} from './appraisal.service';
export interface ExamQuestionDefinition {
  prompt: string;
  options: string[];
  correctOption: number;
  marks?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}
export interface ExamConfiguration {
  recipientIds?: string[];
  durationMinutes?: number;
  questionsPerEmployee?: number;
  marksPerQuestion?: number;
  attendanceMonth?: string;
  attendanceFrom?: string;
  attendanceTo?: string;
  departments: string[];
  questions: ExamQuestionDefinition[];
}
export interface ExaminationSettings extends ExamConfiguration {
  assigned: number;
  submitted: number;
  monthComplete: boolean;
  periodComplete?: boolean;
}
export interface CompositeScore {
  appraisalScore: number;
  examScore?: number;
  attendanceScore: number;
  combinedScore: number;
  attendanceMonth?: string;
  attendanceFrom?: string;
  attendanceTo?: string;
  calculatedAt?: string;
}
export interface ExamAnswer {
  question: string;
  option: number;
}
export interface ExamAttempt {
  startedAt?: string | null;
  expiresAt?: string | null;
  serverNow?: string;
  durationMinutes?: number;
  timedOut?: boolean;
  revision: number;
  submittedAt: string | null;
  answers: ExamAnswer[];
  score?: number;
  earnedMarks?: number;
  maxMarks?: number;
  correctCount?: number;
  questionCount?: number;
}
export interface OwnExamination extends Partial<ExamAttempt> {
  assigned: boolean;
  marksPerQuestion?: number;
  status: AppraisalCycle['status'];
  attendanceMonth?: string;
  attendanceFrom?: string;
  attendanceTo?: string;
  questions?: {
    question: string;
    prompt: string;
    options: string[];
    marks?: number;
  }[];
}
const base = (id: string) => `/api/peer-appraisals/${id}/examination`;
export const saveExamination = (
  id: string,
  config: ExamConfiguration | null,
  expectedRevision: number
) =>
  request<{ revision: number }>(base(id), {
    method: 'PUT',
    body: JSON.stringify({
      ...(config ?? { enabled: false }),
      expectedRevision,
    }),
  });
export const fetchExamination = (id: string) =>
  request<OwnExamination>(base(id));
export const saveExamAnswers = (
  id: string,
  answers: ExamAnswer[],
  expectedRevision: number
) =>
  request<ExamAttempt>(base(id), {
    method: 'PATCH',
    body: JSON.stringify({ answers, expectedRevision }),
  });
export const submitExamAnswers = (
  id: string,
  answers: ExamAnswer[],
  expectedRevision: number
) =>
  request<ExamAttempt>(`${base(id)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers, expectedRevision }),
  });

export interface QuestionBankOption {
  id: string;
  name: string;
  questionCount: number;
}
export interface QuestionBankDraft {
  name?: string;
  questions: ExamQuestionDefinition[];
  questionsPerEmployee: number;
  marksPerQuestion: number;
  model?: string;
}
export const fetchQuestionBank = (id: string, bankId: string) =>
  request<QuestionBankDraft>(`${base(id)}/bank/${encodeURIComponent(bankId)}`);
export const generateExamQuestions = (
  id: string,
  topic: string,
  count: number
) =>
  request<QuestionBankDraft>(`${base(id)}/generate`, {
    method: 'POST',
    body: JSON.stringify({ topic, count }),
  });

export const startExamination = (id: string) =>
  request<OwnExamination>(`${base(id)}/start`, { method: 'POST' });
