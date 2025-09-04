#!/usr/bin/env bash
set -euo pipefail
# Pull latest code, build, restart service. Designed to run on the Pi at /opt/st-albans
# Usage: ./deploy/update-and-restart.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Git Pull =="
git pull --ff-only

echo "== Build =="
./deploy/build-release.sh

echo "== Restart Service =="
sudo systemctl restart st-albans

echo "== Recent Logs =="
sudo journalctl -u st-albans -n 25 --no-pager || true

echo "Done."
