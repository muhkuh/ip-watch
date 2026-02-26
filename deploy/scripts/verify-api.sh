#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1}"
API_TOKEN="${2:-}"

AUTH_ARGS=()
if [[ -n "${API_TOKEN}" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${API_TOKEN}")
fi

echo "[verify] Base URL: ${BASE_URL}"

echo "[verify] GET /api/health"
curl -fsS "${BASE_URL}/api/health" | sed 's/^/  /'
echo

echo "[verify] POST /api/status/check-now"
curl -fsS "${AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"devices":[{"name":"Office PC","type":"PC","ip":"127.0.0.1","probeProtocol":null,"probePort":null}]}' \
  "${BASE_URL}/api/status/check-now" | sed 's/^/  /'
echo

echo "[verify] GET /api/status"
curl -fsS "${AUTH_ARGS[@]}" "${BASE_URL}/api/status" | sed 's/^/  /'
echo

echo "[verify] OK"
