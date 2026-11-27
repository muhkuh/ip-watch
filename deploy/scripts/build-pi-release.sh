#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ $# -ne 1 || "$1" != /* || ! "$1" =~ \.tar\.gz$ ]]; then
  echo 'Usage: bash deploy/scripts/build-pi-release.sh /absolute/path/ip-watch-RELEASE.tar.gz' >&2
  exit 2
fi
OUTPUT="$1"
if [[ -e "$OUTPUT" || -L "$OUTPUT" ]]; then
  echo 'Choose a new archive path.' >&2
  exit 2
fi

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 24 || minor < 15) { console.error("Node 24.15+ is required."); process.exit(1); }'
TEMP_ROOT="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
STAGE="$(mktemp -d "$TEMP_ROOT/ip-watch-release.XXXXXXXX")"
[[ "$(cd "$STAGE" && pwd -P)" == "$TEMP_ROOT"/ip-watch-release.* ]]
trap 'rm -r -- "$STAGE"' EXIT
cp -R "$ROOT_DIR/frontend/src" "$ROOT_DIR/frontend/public" "$STAGE/"
cp "$ROOT_DIR/frontend/"{package.json,package-lock.json,angular.json,ngsw-config.json,tsconfig.json,tsconfig.app.json,postcss.config.js,tailwind.config.js} "$STAGE/"
(
  cd "$STAGE"
  npm ci --no-fund --no-audit
  npm run build
)

mkdir -p "$STAGE/release/web" "$STAGE/release/probe-host"
cp -R "$STAGE/dist/ip-watch-pwa/browser/." "$STAGE/release/web/"
cp "$ROOT_DIR/LICENSE" "$STAGE/release/"
cp "$STAGE/dist/ip-watch-pwa/3rdpartylicenses.txt" "$STAGE/release/"
cp -R "$ROOT_DIR/probe-host/src" "$STAGE/release/probe-host/"
cp "$ROOT_DIR/probe-host/"{package.json,package-lock.json} "$STAGE/release/probe-host/"
cp "$ROOT_DIR/deploy/scripts/pi-release-preflight.sh" "$STAGE/release/"
cp "$ROOT_DIR/deploy/scripts/pi-release-smoke.cjs" "$STAGE/release/"
cp "$ROOT_DIR/deploy/systemd/probe-host.env.example" "$STAGE/release/"
cp "$ROOT_DIR/docs/deployment/"{pi-release-runbook.md,e2e-runbook.md,_deployment_base.md} "$STAGE/release/"
(
  printf 'built_at=%s\n' "$(date -u +%FT%TZ)"
  printf 'node=%s\n' "$(node --version)"
  printf 'npm=%s\n' "$(npm --version)"
  if command -v git >/dev/null && git -C "$ROOT_DIR" rev-parse HEAD >/dev/null 2>&1; then
    printf 'source_head=%s\n' "$(git -C "$ROOT_DIR" rev-parse HEAD)"
    if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then printf 'source_dirty=true\n'; else printf 'source_dirty=false\n'; fi
  fi
) > "$STAGE/release/BUILD-INFO"

ARCHIVE="$STAGE/release.tar.gz"
tar -czf "$ARCHIVE" -C "$STAGE/release" .
(set -o noclobber; cat "$ARCHIVE" > "$OUTPUT")
sha256sum "$OUTPUT"
