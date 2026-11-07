#!/bin/sh
# Harvey resolves its configuration and credentials from its own checkout.
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
# This runtime is scoped to Harvey; leave the desktop Codex installation alone.
PATH="$project_dir/.local/harvey-codex/node_modules/.bin:$PATH"
export PATH
cd "$project_dir/.local/harvey"
if [ ! -x .venv/bin/harvey ]; then
  echo "Harvey is not installed. See docs/tenant-outreach/harvey.md." >&2
  exit 1
fi
exec .venv/bin/harvey "$@"
