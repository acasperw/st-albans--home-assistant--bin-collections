#!/usr/bin/env bash
set -euo pipefail
# Pull latest code (prefers GitHub CLI), build, restart service.
# Designed to run on the Pi at /opt/st-albans
# Usage: ./deploy/update-and-restart.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Sync Repository =="
if command -v gh >/dev/null 2>&1; then
	# gh repo sync keeps local in sync with remote default branch
	if gh repo sync 2>/dev/null; then
		echo "(gh) Repository synced"
	else
		echo "(gh) repo sync failed, attempting fallback to git pull"
		git pull --ff-only
	fi
else
	echo "GitHub CLI not found; using git pull"
	git pull --ff-only
fi

echo "== Build =="
./deploy/build-release.sh

echo "== Restart Service =="
sudo systemctl restart st-albans

echo "== Recent Logs =="
sudo journalctl -u st-albans -n 25 --no-pager || true

echo "Done."
