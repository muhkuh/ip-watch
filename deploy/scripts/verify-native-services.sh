#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

echo "[verify] systemd status: ip-watch-probe.service"
systemctl --no-pager --full status ip-watch-probe.service | sed -n '1,15p'
echo

echo "[verify] systemd status: nginx"
systemctl --no-pager --full status nginx | sed -n '1,15p'
echo

echo "[verify] API checks"
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/verify-api.sh" "http://127.0.0.1"
