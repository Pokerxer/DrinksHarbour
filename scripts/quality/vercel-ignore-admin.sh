#!/bin/sh
# Ignore-command logic for Vercel's admin app.
#
# Vercel caps `ignoreCommand` values at 256 characters, so the git-diff logic
# lives here and client/apps/admin/vercel.json invokes this file.
# Exit 1 = changes detected (build proceeds); exit 0 = no relevant changes
# (build skipped).
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
cd "$ROOT" || exit 1

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
# Replayed/hard-reset histories can reference a SHA the shallow clone doesn't
# carry; fall back to HEAD^ so one stale token never bricks the ignore gate.
git cat-file -e "$PREV" 2>/dev/null || PREV=HEAD^

git diff --quiet "$PREV" HEAD -- \
  client/apps/admin \
  client/packages \
  client/package.json \
  client/pnpm-lock.yaml \
  client/pnpm-workspace.yaml \
  client/turbo.json \
  scripts/quality \
  package.json \
  .nvmrc \
  || exit 1

exit 0
