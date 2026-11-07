# Occasion review queue

Only platform admin/super_admin. Middleware matcher and route-roles must mirror
API roles; tenant staff/owners/admins cannot view customer briefs or conversations.
Queue refreshes30s, saved message panel10s, with explicit retry and pagination.
Do not poll-refresh the reply editor or overwrite unsaved edits. Customer replies
appear in the saved conversation and reopen request; inspect latest messages before
approving. AI check uses existing server Claude Haiku4.5, never browser API keys.

AI result is editable private draft. Explicit review checkbox required for profile
publish/email/manual WhatsApp record. Any edit/save resets approval. Publish in
chat leaves requested external response outstanding. Email sends and saves the
reply in chat; failure is visible, not sent. WhatsApp requires a second checkbox
confirming human actually sent it; opening/copying is not evidence of sending.
External send failures/suppression retain reply. Use server revision conflict errors
and refresh; never silently replace newer staff work. No auto cart/order writes.
