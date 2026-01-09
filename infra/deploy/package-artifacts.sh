#!/usr/bin/env bash
set -euo pipefail

# Packages build outputs into tar.gz artifacts.
# Intended to run in CI (Linux runner).

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/artifacts}"
RELEASE_ID="${2:-local}"

mkdir -p "$OUT_DIR"

pack_backend() {
  local src="$ROOT_DIR/api/auth-api"
  local out="$OUT_DIR/backend-$RELEASE_ID.tgz"
  tar -C "$src" -czf "$out" \
    dist \
    package.json \
    package-lock.json \
    migrations \
    README.md
  echo "$out"
}

pack_web_admin() {
  local src="$ROOT_DIR/frontend/web_admin"
  local out="$OUT_DIR/web_admin-$RELEASE_ID.tgz"
  tar -C "$src" -czf "$out" dist
  echo "$out"
}

pack_next_app() {
  local name="$1" # web_driver|web_passenger
  local src="$ROOT_DIR/frontend/$name"
  local out="$OUT_DIR/${name}-$RELEASE_ID.tgz"
  tar -C "$src" -czf "$out" \
    .next \
    public \
    package.json \
    package-lock.json \
    next.config.mjs \
    next-env.d.ts \
    README.md 2>/dev/null || true
  echo "$out"
}

echo "Backend: $(pack_backend)"
echo "Web Admin: $(pack_web_admin)"
echo "Web Driver: $(pack_next_app web_driver)"
echo "Web Passenger: $(pack_next_app web_passenger)"
