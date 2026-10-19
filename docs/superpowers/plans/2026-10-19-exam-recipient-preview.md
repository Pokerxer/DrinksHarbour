# Department examination recipient preview

User: selecting a department should show employees who will receive questions.
Show active selected cycle participants in checked departments, using current
employee department data (same matching behavior as launch's refreshed snapshot).
Update immediately for department and local roster selection changes. Identify
unsaved roster preview and freeze authoritative assignments only at launch.

- [x] RED test HR eligible employees project minimal current department ID and
  preserve tenant/active/role filtering; add field to existing endpoint/type only.
- [x] RED actual cycle-panel interaction test department toggles and unsaved roster
  add/remove; no other tenant/non-roster employee leaked in preview.
- [x] Optional selection callback from roster hook, wire live selected IDs + current
  eligible employee metadata into focused ExamRecipients component. Group by
  department with counts; clear none selected/empty roster/no matching recipients.
- [x] Relevant UI/types and full server tests; update API rules/resume/memory.

No new permissions/endpoint, email sending, dependencies, live data mutations,
commits/deployment or agents. Backend remains authoritative; don't persist preview.
