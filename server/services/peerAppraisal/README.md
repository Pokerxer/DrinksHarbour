# All-colleague bonus appraisal

Each frozen participant rates every other participant once, with one integer 1–5.
No self rating. All belong to one authenticated tenant. Only unrestricted HR may
manage the business-wide roster or read allocations/results across employees.

Store NGN in integer minor units; calculate bonus with unrounded mean / 5 × allocation.
Draft ratings never produce published results. Close only with every participant
submitted and all directed rating pairs present. Transactions touch the cycle
revision to serialize mutations; stale forms receive 409. Launch freezes roster
and allocations. Inactive/deleted participants never disappear from a launched
cycle: cancel if completion becomes impossible. Cancellation does not pay bonuses.

Only the author can read outgoing ratings. Own final results are released on
closure; no incoming individual ratings are exposed. With two participants,
aggregate results inherently permit inference of the single rating.

Draft roster PUTs include expectedRevision from the HR participants response.
A stale save returns 409 without replacing allocations; HR can explicitly discard
local edits and reload the saved roster. Unavailable draft participants remain
visible/removable. Progress refresh uses persisted status and ignores older
responses. Identical submission retries succeed even after closure; changed
ratings and cancelled-cycle writes remain rejected.
