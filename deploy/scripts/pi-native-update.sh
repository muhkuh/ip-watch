#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

TARGET_DIR="${1:-/opt/ip-watch}"

if [[ ! -d "$TARGET_DIR/frontend" || ! -d "$TARGET_DIR/probe-host" ]]; then
  echo "Target directory does not look like an ip-watch deployment: $TARGET_DIR" >&2
  exit 1
fi

echo "[ip-watch] Updating probe dependencies..."
cd "$TARGET_DIR/probe-host"
sudo -u ipwatch npm install --omit=dev

echo "[ip-watch] Rebuilding frontend..."
cd "$TARGET_DIR/frontend"
sudo -u ipwatch npm install
sudo -u ipwatch npm run build

echo "[ip-watch] Refreshing static files..."
rm -rf /var/www/ip-watch
mkdir -p /var/www/ip-watch
cp -r "$TARGET_DIR/frontend/dist/ip-watch-pwa/browser/"* /var/www/ip-watch/

echo "[ip-watch] Restarting services..."
systemctl restart ip-watch-probe.service
systemctl restart nginx

echo "[ip-watch] Update complete."
