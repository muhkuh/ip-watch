#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_DIR="${1:-/opt/ip-watch}"

echo "[ip-watch] Installing system packages..."
apt update
apt install -y nginx curl rsync

if ! command -v node >/dev/null 2>&1; then
  echo "[ip-watch] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

echo "[ip-watch] Preparing runtime user and directories..."
useradd --system --home /opt/ip-watch --shell /usr/sbin/nologin ipwatch 2>/dev/null || true
mkdir -p "$TARGET_DIR" /var/lib/ip-watch /etc/ip-watch
chown -R ipwatch:ipwatch "$TARGET_DIR" /var/lib/ip-watch

echo "[ip-watch] Syncing project to $TARGET_DIR..."
rsync -a --delete "$ROOT_DIR/" "$TARGET_DIR/"
chown -R ipwatch:ipwatch "$TARGET_DIR"

echo "[ip-watch] Installing probe host dependencies..."
cd "$TARGET_DIR/probe-host"
sudo -u ipwatch npm install --omit=dev

echo "[ip-watch] Building frontend..."
cd "$TARGET_DIR/frontend"
sudo -u ipwatch npm install
sudo -u ipwatch npm run build

echo "[ip-watch] Deploying static web files..."
rm -rf /var/www/ip-watch
mkdir -p /var/www/ip-watch
cp -r "$TARGET_DIR/frontend/dist/ip-watch-pwa/browser/"* /var/www/ip-watch/

echo "[ip-watch] Installing environment file..."
cp "$TARGET_DIR/deploy/systemd/probe-host.env.example" /etc/ip-watch/probe-host.env
chown root:root /etc/ip-watch/probe-host.env
chmod 640 /etc/ip-watch/probe-host.env

echo "[ip-watch] Installing and enabling probe service..."
cp "$TARGET_DIR/deploy/systemd/ip-watch-probe.service" /etc/systemd/system/ip-watch-probe.service
systemctl daemon-reload
systemctl enable --now ip-watch-probe.service

echo "[ip-watch] Configuring nginx..."
cp "$TARGET_DIR/deploy/nginx/ip-watch-native.conf" /etc/nginx/sites-available/ip-watch.conf
ln -sf /etc/nginx/sites-available/ip-watch.conf /etc/nginx/sites-enabled/ip-watch.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "[ip-watch] Installation complete."
echo "Health check: curl http://127.0.0.1/api/health"
