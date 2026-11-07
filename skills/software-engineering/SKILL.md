---
name: software-engineering
description: Guide cross-cutting software changes from problem definition through implementation, review, and verification. Use for defects, refactors, and changes that span system boundaries.
---

Read the workspace instructions and identify the entry points, existing callers, and behavior that must be preserved. Define the observable result before changing implementation. For a defect, reproduce it or collect concrete evidence of the failure and trace its cause.

Prefer the smallest complete change and reuse the repository's existing contracts. For changes that cross a boundary, trace inputs, authorization, state transitions, and outputs end to end. Check old data, retries, partial failures, and concurrent requests when the change can affect them.

Verify through the normal entry point. Use a focused regression check when existing tests miss the failure. For migrations and external side effects, separate rehearsal and verification from live execution. Report what changed, what passed, and any remaining blocker with enough detail for someone else to continue.

Use the project's specialist skills for framework details. In DrinksHarbour, follow the tenant review skill for access, catalog ownership, or marketplace money flows and the issue delivery skill for the Paperclip handoff.
