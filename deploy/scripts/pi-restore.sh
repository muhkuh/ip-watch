#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

BACKUP_FILE="${1:-}"
TARGET_FILE="${2:-/var/lib/ip-watch/devices.json}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: sudo ./deploy/scripts/pi-restore.sh <backup-file> [target-file]" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_FILE")"
cp "$BACKUP_FILE" "$TARGET_FILE"
chown ipwatch:ipwatch "$TARGET_FILE" || true

systemctl restart ip-watch-probe.service

echo "[restore] Restored backup to: $TARGET_FILE"
echo "[restore] Service restarted: ip-watch-probe.service"
