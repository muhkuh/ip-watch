#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

DATA_FILE="${1:-/var/lib/ip-watch/devices.json}"
BACKUP_DIR="${2:-/var/backups/ip-watch}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DATA_FILE" ]]; then
  echo "Data file not found: $DATA_FILE" >&2
  exit 1
fi

TARGET="${BACKUP_DIR}/devices-${TIMESTAMP}.json"
cp "$DATA_FILE" "$TARGET"

echo "[backup] Created: $TARGET"
