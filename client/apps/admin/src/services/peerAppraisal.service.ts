import type {
  ExaminationSettings,
  QuestionBankOption,
  CompositeScore,
} from './examination.service';
import {
  appraisalRequest as request,
  type AppraisalCycle,
} from './appraisal.service';
export interface PeerEmployee {
  department?: string | null;
  employee: string;
  displayName: string;
}
export interface PeerRatingInput {
  subject: string;
  rating: number;
}
export interface PeerResult {
  composite?: CompositeScore;
  averageScore: number;
  ratingCount: number;
  allocationMinor: number;
  bonusMinor: number;
  currency: 'NGN';
}
export interface PeerParticipant extends PeerEmployee {
  isAppraiser?: boolean;
  allocationMinor: number;
  submittedAt: string | null;
  unavailable: boolean;
  result?: PeerResult;
}
export interface PeerProgress {
  availableQuestionBanks?: QuestionBankOption[];
  examination?: ExaminationSettings | null;
  revision?: number;
  status: AppraisalCycle['status'];
  total: number;
  appraiserTotal?: number;
  submitted: number;
  participants: PeerParticipant[];
}
export interface PeerReview {
  hasExamination?: boolean;
  isAppraiser?: boolean;
  name: string;
  status: AppraisalCycle['status'];
  submittedAt: string | null;
  revision: number;
  colleagues: PeerEmployee[];
  ratings: PeerRatingInput[];
}
export interface PeerMyCycle {
  examAssigned?: boolean;
  examSubmittedAt?: string | null;
  isAppraiser?: boolean;
  _id: string;
  name: string;
  status: AppraisalCycle['status'];
  submittedAt: string | null;
}
export interface PeerRosterInput {
  employee: string;
  bonusAmount: number;
  isAppraiser?: boolean;
}
const base = '/api/peer-appraisals';
const write = (method: string, body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export const createPeerCycle = (name: string) =>
  request<AppraisalCycle>(base, write('POST', { name }));
export const fetchPeerEmployees = () =>
  request<PeerEmployee[]>(`${base}/eligible-employees`);
export const fetchPeerParticipants = (id: string) =>
  request<PeerProgress>(`${base}/${id}/participants`);
export const replacePeerRoster = (
  id: string,
  participants: PeerRosterInput[],
  expectedRevision = 0
) =>
  request<{ saved: number; revision: number }>(
    `${base}/${id}/participants`,
    write('PUT', { participants, expectedRevision })
  );
export const peerCycleAction = (
  id: string,
  action: 'launch' | 'close' | 'cancel'
) => request<AppraisalCycle>(`${base}/${id}/${action}`, write('POST'));
export const fetchMyPeerCycles = () => request<PeerMyCycle[]>(`${base}/my`);
export const fetchPeerReview = (id: string) =>
  request<PeerReview>(`${base}/${id}/review`);
export const fetchPeerResult = (id: string) =>
  request<PeerResult>(`${base}/${id}/result`);
export const savePeerRatings = (
  id: string,
  ratings: PeerRatingInput[],
  expectedRevision: number
) =>
  request<{ revision: number; submittedAt: string | null }>(
    `${base}/${id}/review`,
    write('PATCH', { ratings, expectedRevision })
  );
export const submitPeerRatings = (
  id: string,
  ratings: PeerRatingInput[],
  expectedRevision: number
) =>
  request<{ revision: number; submittedAt: string | null }>(
    `${base}/${id}/submit`,
    write('POST', { ratings, expectedRevision })
  );
