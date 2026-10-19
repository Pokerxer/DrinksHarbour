# Department examination recipient preview — 2026-10-19

Status: implemented locally and verified; uncommitted, not deployed. User requests employee names when selecting exam departments.
Plan: ../plans/2026-10-19-exam-recipient-preview.md.
Scope: current department metadata from HR eligible endpoint, live draft roster IDs,
department-filtered preview and counts/empty states; assignment frozen at launch.


## Implementation

Existing unrestricted-HR eligible-employees API now projects department:string|null
alongside employee/displayName, from current employeeProfile.work.department. Query
retains tenant,active and TENANT_ROLES restrictions; no emails or other profile data.
No new endpoint/schema/mutation. Existing launch already refreshes department from
current employee data; preview now uses same current metadata.

Roster hook emits optional onSelectionChange IDs whenever its displayed selection
changes, including reload/save synchronization. Cycle panel intersects these IDs
with current eligible employees and passes candidates plus rosterDirty into exam
setup. Departments are filtered client-side immediately on checkbox edits; no save
or network request needed to update preview. No preview data is persisted.

Focused recipients.tsx shows total and department groups with employee names/counts,
scrollable body and responsive layout. No department,unloaded data,empty roster,
zero matching people and selected group with no cycle participants have explicit
states. Missing department is excluded. Unsaved roster edits visibly flagged;
copy clarifies final recipients use current departments at launch. Only active
cycle selections appear, not every business employee. Unavailable roster selection
is excluded by eligibility, and existing roster guard/alert still blocks launch.

Files: server/services/peerAppraisal/queries.js; PeerEmployee type; use-cycle-setup,
cycle-panel; examination/setup/setup-settings and new recipients component/test.
No changes to question generation,marks,grading,timing,bonuses or role permissions.

## Verification

- RED component test failed because preview absent (/tmp/exam-recipients-red.log).
  RED Mongo/JWT/HTTP test failed undefined department vs actual fixture department
  (/tmp/exam-recipients-http-red.log); implemented minimal projection after failure.
- Real disposable Mongo HTTP10pass/0skip/0fail (/tmp/exam-recipients-http.log): exact
  metadata projection,current department,staff403,foreign tenant absent; full exam
  lifecycle/weighted/timed/closure/legacy workflows still pass.
- Full server4075pass/36skip/0fail (/tmp/exam-recipients-server.log).
- Scoped tsc clean (/tmp/exam-recipients-types-final.log).
- UI actual panel test covers department toggle,non-roster exclusion,unsaved add/
  remove,department-less employee exclusion,none selected and zero matching state.
- First full UI run had4 five-second timeouts during concurrent server/Tailwind/
  browser jobs; rerun without those jobs using maxWorkers2. Final result below.
- Synthetic actual React browser1366px/390px verified names/counts after checkbox
  updates,selected department exclusion,no horizontal overflow,no page errors.
  /tmp/exam-recipients-browser.log; screenshots /tmp/exam-recipients-desktop.png and
  /tmp/exam-recipients-mobile.png (mobile viewed). Harness uses synthetic data;
  no authenticated production HR walkthrough. Helper stopped preview server.
- No live data writes,new dependencies,subagents,commit,push or deployment.
  Disposable Mongo stopped after final HTTP workflow. Self-review;CodeRabbit unavailable.


Final ledger:341UItests/31files passed with maxWorkers2
(/tmp/exam-recipients-ui-last.log). No competing server/browser/compiler jobs;
prior5s test timeouts did not recur (recipient interaction964ms). Server4075pass/
36skip,HTTP10pass,scoped types/formatting/whitespace clean,desktop/mobile browser
preview passed. No outstanding required work; no preview or test database running.
