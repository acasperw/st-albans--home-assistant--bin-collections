#!/usr/bin/env bash
set -euo pipefail
# Restart the systemd service and show concise status
SERVICE=st-albans

if ! command -v systemctl >/dev/null; then
  echo "systemctl not found (are you on the Pi?)" >&2
  exit 1
fi

echo "== Restarting $SERVICE =="
sudo systemctl restart "$SERVICE"
echo "== Status ($SERVICE) =="
sudo systemctl --no-pager --lines=20 status "$SERVICE" || true

echo "Logs (tail)":
sudo journalctl -u "$SERVICE" -n 30 --no-pager || true
