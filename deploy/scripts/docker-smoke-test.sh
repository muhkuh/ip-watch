#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_PORT="${WEB_PORT:-8080}"
BASE_URL="http://localhost:${WEB_PORT}"

cleanup() {
  echo "[smoke] Stopping docker stack..."
  (
    cd "$ROOT_DIR"
    docker compose down >/dev/null 2>&1 || true
  )
}
trap cleanup EXIT

echo "[smoke] Building frontend..."
cd "$ROOT_DIR/frontend"
npm run build

echo "[smoke] Starting docker stack on WEB_PORT=${WEB_PORT}..."
cd "$ROOT_DIR"
WEB_PORT="${WEB_PORT}" docker compose up -d --build

echo "[smoke] Waiting for web endpoint..."
for _ in {1..30}; do
  if curl -fsS "${BASE_URL}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[smoke] Running API verification..."
"$ROOT_DIR/deploy/scripts/verify-api.sh" "${BASE_URL}"

echo "[smoke] SUCCESS"
