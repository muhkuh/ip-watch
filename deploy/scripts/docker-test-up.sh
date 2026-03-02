#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_PORT="${WEB_PORT:-8080}"

echo "[ip-watch] Starting docker compose stack..."
cd "$ROOT_DIR"
WEB_PORT="${WEB_PORT}" docker compose up -d --build

echo "[ip-watch] Done."
echo "Web:    http://localhost:${WEB_PORT}"
echo "Health: http://localhost:${WEB_PORT}/api/health"
