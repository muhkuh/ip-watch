# IP Watch Deployment Guide

## Overview
This project supports two deployment modes:

1. Local development/testing with Docker Compose.
2. Native Raspberry Pi runtime with `systemd` + Nginx.

Use Docker for fast testing on your workstation, and native mode for lean operation on Raspberry Pi 3.

Detailed end-to-end validation:
- `/docs/deployment/E2E-RUNBOOK.md`

## Remote Admin vs Runtime Access

- `connect.raspberrypi.com` is useful for remote administration and deployment tasks on the Raspberry Pi.
- End users (for example iPhone PWA clients) should access the app via the local LAN address:
  - `http://<PI_IP>/`
- The runtime app flow in local network should not depend on remote-connect services.

## A) Docker Test Setup (Workstation)

Fast path (script):
```bash
./deploy/scripts/docker-test-up.sh
```

If port `8080` is already used:
```bash
WEB_PORT=8081 ./deploy/scripts/docker-test-up.sh
```

One-command smoke test (build + up + verify + down):
```bash
./deploy/scripts/docker-smoke-test.sh
```
or with custom port:
```bash
WEB_PORT=8081 ./deploy/scripts/docker-smoke-test.sh
```

### 1. Build frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

### 2. Start stack
```bash
docker compose up -d --build
```

Services:
- Web app: `http://localhost:8080`
- Probe API health: `http://localhost:8080/api/health`

Verify:
```bash
./deploy/scripts/verify-api.sh http://localhost:8080
```

If API token is enabled:
```bash
./deploy/scripts/verify-api.sh http://localhost:8080 "<your-token>"
```

### 3. Stop stack
```bash
docker compose down
```

Or:
```bash
./deploy/scripts/docker-test-down.sh
```

### 4. Persisted test data
The probe backend is stateless. Device data is persisted in the frontend (browser IndexedDB), not in Docker volumes.

---

## B) Native Raspberry Pi Setup (Recommended for Pi 3)

Fast path installer (run on Raspberry Pi):
```bash
sudo ./deploy/scripts/pi-native-install.sh
```

### 1. Install system dependencies
```bash
sudo apt update
sudo apt install -y nginx curl
```

Install Node.js 20:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:
```bash
node -v
npm -v
```

### 2. Create runtime user and directories
```bash
sudo useradd --system --home /opt/ip-watch --shell /usr/sbin/nologin ipwatch || true
sudo mkdir -p /opt/ip-watch
sudo mkdir -p /etc/ip-watch
sudo chown -R ipwatch:ipwatch /opt/ip-watch
```

### 3. Copy project to Raspberry Pi
Copy repository content to:
`/opt/ip-watch`

Example:
```bash
sudo rsync -av --delete /path/to/ip-watch/ /opt/ip-watch/
sudo chown -R ipwatch:ipwatch /opt/ip-watch
```

### 4. Install probe-host dependencies
```bash
cd /opt/ip-watch/probe-host
sudo -u ipwatch npm install --omit=dev
```

### 5. Build frontend and deploy static files
Build on the Pi (or copy prebuilt dist from workstation):
```bash
cd /opt/ip-watch/frontend
sudo -u ipwatch npm install
sudo -u ipwatch npm run build
```

Deploy static files:
```bash
sudo rm -rf /var/www/ip-watch
sudo mkdir -p /var/www/ip-watch
sudo cp -r /opt/ip-watch/frontend/dist/ip-watch-pwa/browser/* /var/www/ip-watch/
```

### 6. Configure probe-host environment
```bash
sudo cp /opt/ip-watch/deploy/systemd/probe-host.env.example /etc/ip-watch/probe-host.env
sudo chown root:root /etc/ip-watch/probe-host.env
sudo chmod 640 /etc/ip-watch/probe-host.env
```

Adjust values in:
`/etc/ip-watch/probe-host.env`

Optional security:
- Set `PROBE_API_TOKEN=<your-token>` to enable bearer token auth.

### 7. Install and start systemd service
```bash
sudo cp /opt/ip-watch/deploy/systemd/ip-watch-probe.service /etc/systemd/system/ip-watch-probe.service
sudo systemctl daemon-reload
sudo systemctl enable --now ip-watch-probe.service
sudo systemctl status ip-watch-probe.service
```

### 8. Install Nginx site config
```bash
sudo cp /opt/ip-watch/deploy/nginx/ip-watch-native.conf /etc/nginx/sites-available/ip-watch.conf
sudo ln -sf /etc/nginx/sites-available/ip-watch.conf /etc/nginx/sites-enabled/ip-watch.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Verify installation
```bash
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1/api/health
```

Or with helper:
```bash
sudo ./deploy/scripts/verify-native-services.sh
```

With API token:
```bash
./deploy/scripts/verify-api.sh http://127.0.0.1 "<your-token>"
```

Open from another LAN device:
`http://<raspberry-pi-ip>/`

---

## Raspberry Pi Notes

- Raspberry Pi 3 should run this stack comfortably in native mode.
- If ping fails with permission issues, verify `ping` binary capabilities:
```bash
getcap "$(which ping)"
```

Expected output usually includes `cap_net_raw`.

---

## Update Procedure (Native)

1. Deploy updated source to `/opt/ip-watch`.
2. Reinstall dependencies if `package.json` changed:
```bash
cd /opt/ip-watch/probe-host
sudo -u ipwatch npm install --omit=dev
```
3. Rebuild frontend and recopy `/var/www/ip-watch`.
4. Restart services:
```bash
sudo systemctl restart ip-watch-probe.service
sudo systemctl restart nginx
```

Or use update script:
```bash
sudo ./deploy/scripts/pi-native-update.sh
```

### Troubleshooting: Native Update Script

The update script requires `root` and runs `npm` as user `ipwatch`:
- `sudo -u ipwatch npm install --omit=dev`
- `sudo -u ipwatch npm install`
- `sudo -u ipwatch npm run build`

If file ownership is wrong (for example changed to another user), update may fail with `EACCES`.

Common issues and fixes:

1. `sudo: ./deploy/scripts/pi-native-update.sh: command not found`
```bash
cd /opt/ip-watch
ls -l ./deploy/scripts/pi-native-update.sh
sudo bash ./deploy/scripts/pi-native-update.sh
```

2. `bash: ./deploy/scripts/pi-native-update.sh: Permission denied`
```bash
cd /opt/ip-watch
chmod +x ./deploy/scripts/pi-native-update.sh
sudo ./deploy/scripts/pi-native-update.sh
```

3. `npm ERR! EACCES` during update (for example on `package-lock.json` or `node_modules`)
```bash
cd /opt/ip-watch
sudo chown -R ipwatch:ipwatch /opt/ip-watch
sudo chmod -R u+rwX /opt/ip-watch
sudo -u ipwatch mkdir -p /opt/ip-watch/.npm
sudo ./deploy/scripts/pi-native-update.sh
```

4. Script says `Please run as root (sudo).`
```bash
cd /opt/ip-watch
sudo ./deploy/scripts/pi-native-update.sh
```

---

## Backup and Restore (Native)

Device definitions live in each client browser (IndexedDB). There is no server-side device database to backup/restore by default.

Recommended backup scope:
- `/etc/ip-watch/probe-host.env` (service config/token)
- `/opt/ip-watch` (code + deployment assets)
