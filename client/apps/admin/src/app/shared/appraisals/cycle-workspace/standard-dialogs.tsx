import { Button, Modal } from 'rizzui';
import { PiRocketLaunch } from 'react-icons/pi';
import type { AppraisalCycle } from '@/services/appraisal.service';
import type useStandardCycle from './use-standard-cycle';
export default function StandardDialogs({
  cycle,
  state,
}: {
  cycle: AppraisalCycle;
  state: ReturnType<typeof useStandardCycle>;
}) {
  const {
    showLaunchModal,
    showCloseModal,
    setShowLaunchModal,
    setShowCloseModal,
    launching,
    closing,
    handleLaunch,
    handleClose,
  } = state;
  return (
    <>
      <Modal
        isOpen={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        size="sm"
      >
        <div className="p-6">
          <p className="text-base font-semibold text-gray-900">
            Launch {cycle.name}?
          </p>
          <p className="mt-2 text-sm text-gray-500">
            This creates an appraisal for every eligible employee and starts
            asking them and their managers for feedback.{' '}
            {cycle.peerReviewEnabled
              ? 'Peer review is on, so employees will be asked to nominate peers.'
              : 'Peer review is off, so this collects self and manager assessments only.'}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Re-launching later is safe — employees who already have an appraisal
            for this cycle are skipped rather than duplicated — but a launch
            cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowLaunchModal(false)}
              disabled={launching}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLaunch}
              disabled={launching}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              <PiRocketLaunch className="me-1.5 h-4 w-4" />
              {launching ? 'Launching…' : 'Launch cycle'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        size="sm"
      >
        <div className="p-6">
          <p className="text-base font-semibold text-gray-900">
            Close this cycle?
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Any feedback still outstanding (not yet submitted) will be marked
            expired and can no longer be submitted. This cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCloseModal(false)}
              disabled={closing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClose}
              disabled={closing}
              className="bg-[#b20202] hover:bg-[#9f0101]"
            >
              {closing ? 'Closing…' : 'Close cycle'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
