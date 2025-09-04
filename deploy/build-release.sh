#!/usr/bin/env bash
set -euo pipefail
# Simple local-in-place build script (used when building directly on Pi or dev machine)
# Creates production builds for client and server; server then serves client assets.
# Usage: ./deploy/build-release.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"

echo "== Building Angular client (production) =="
(cd "$CLIENT_DIR" && npm install --no-audit --no-fund && npm run build)

echo "== Building server TypeScript =="
(cd "$SERVER_DIR" && npm install --no-audit --no-fund && npm run build)

echo "Build complete. Start with: (cd server && node dist/server.js)"
