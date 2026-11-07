import type { PeerEmployeeScores } from '@/services/peerAppraisal.service';
function ScoreCard({
  title,
  score,
  weight,
  note,
}: {
  title: string;
  score: number | null;
  weight: number;
  note: string;
}) {
  return (
    <section
      aria-label={`${title} score`}
      className="min-w-0 rounded-xl border border-gray-200 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-3 text-xl font-semibold tabular-nums text-gray-900">
        {score === null ? '—' : `${score.toFixed(2)} / 100`}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {weight ? `${Number(weight.toFixed(2))}% of total` : 'Not included'}
      </p>
      <p className="mt-4 border-t border-gray-100 pt-3 text-sm font-medium tabular-nums text-[#790505]">
        {score === null
          ? 'Awaiting score'
          : `${((score * weight) / 100).toFixed(2)} weighted points`}
      </p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{note}</p>
    </section>
  );
}
export default function ScoreComponents({
  detail,
}: {
  detail: PeerEmployeeScores;
}) {
  const { appraisal, exam, attendance, weights } = detail;
  const examNote =
    exam.status === 'not_assigned'
      ? 'No examination assigned'
      : exam.status === 'not_started'
        ? 'Not started'
        : exam.status === 'in_progress'
          ? 'In progress'
          : `${exam.earnedMarks !== undefined ? `${exam.earnedMarks} / ${exam.maxMarks} marks · ` : ''}${exam.status === 'timed_out' ? 'Time expired; saved answers marked.' : 'Submitted'}`;
  const attendanceNote =
    attendance.status === 'not_configured'
      ? 'No attendance period configured'
      : attendance.status === 'unrated'
        ? 'No rated attendance'
        : attendance.status === 'provisional'
          ? 'Provisional until the attendance period and its shifts end.'
          : 'Attendance period complete';
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreCard
          title="Examination"
          score={exam.score}
          weight={weights.exam}
          note={examNote}
        />
        <ScoreCard
          title="Appraisal"
          score={appraisal.score}
          weight={weights.appraisal}
          note={`${appraisal.received} of ${appraisal.eligible} eligible appraisers${appraisal.status === 'provisional' ? ' · provisional average' : appraisal.status === 'pending' ? ' · awaiting ratings' : ''}`}
        />
        <ScoreCard
          title="Attendance"
          score={attendance.score}
          weight={weights.attendance}
          note={attendanceNote}
        />
      </div>
      {attendance.attendanceFrom && (
        <div className="rounded-xl bg-gray-50 p-4 text-xs leading-6 text-gray-500">
          <p>
            Attendance period: {attendance.attendanceFrom} –{' '}
            {attendance.attendanceTo}
          </p>
          {attendance.counts && (
            <p>
              {attendance.counts.attended} attended ·{' '}
              {attendance.counts.expected} expected · {attendance.counts.absent}{' '}
              absent · {attendance.counts.excused} excused
            </p>
          )}
        </div>
      )}
    </>
  );
}
