#!/usr/bin/env bash
# Moves the Edy submodule to a chosen commit or tag and refreshes its build.
# Leaves the parent gitlink staged. Does not create a commit.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: update-edy.sh <commit-or-tag>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EDY="$ROOT/vendor/edy"
REV="$1"

if [[ ! -e "$EDY/.git" ]]; then
  echo "Edy submodule is missing at $EDY" >&2
  exit 1
fi

if [[ -n "$(git -C "$EDY" status --porcelain)" ]]; then
  echo "Edy submodule has local changes. Refusing to update." >&2
  exit 1
fi

git -C "$EDY" fetch --tags origin
git -C "$EDY" checkout --detach "$REV"

npm install --prefix "$EDY"
npm test --prefix "$EDY"
npm run build:editor --prefix "$EDY"

git -C "$ROOT" add vendor/edy

echo "Edy pin is staged at $(git -C "$EDY" rev-parse HEAD). Commit the gitlink from the parent repository when ready."
