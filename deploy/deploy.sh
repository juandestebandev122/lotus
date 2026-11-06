#!/usr/bin/env bash
# Build a release in a staging directory and swap it into /var/www/lotus.
#
# Usage (on the server):
#   scp lotus-src.tar.gz root@SERVER:/root/
#   bash /var/www/lotus/deploy/deploy.sh /root/lotus-src.tar.gz
#
# The live site keeps serving the previous version until the copy step, so a
# failed build changes nothing. The previous build is kept for rollback.
set -euo pipefail

SRC_TAR="${1:?usage: deploy.sh <source.tar.gz>}"
APP=/var/www/lotus
BUILD=/root/build-src
STAMP=$(date +%Y%m%d-%H%M%S)

echo "== 1/6  unpack"
rm -rf "$BUILD/app"
mkdir -p "$BUILD/app"
tar -xzf "$SRC_TAR" -C "$BUILD/app"
cd "$BUILD/app"

echo "== 2/6  install"
npm ci --no-audit --no-fund

echo "== 3/6  type check"
node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json

echo "== 4/6  build (webpack, standalone)"
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo "== 5/6  back up database and previous build"
mkdir -p /root/deploy-backups
cp "$APP/.data/db.json" "/root/deploy-backups/db-$STAMP.json"
if [ -d "$BUILD/app-previous" ]; then rm -rf "$BUILD/app-previous"; fi
if [ -d "$APP/.next" ]; then
  mkdir -p "$BUILD/app-previous/.next"
  cp -r "$APP/.next/." "$BUILD/app-previous/.next/"
  cp "$APP/server.js" "$BUILD/app-previous/server.js" 2>/dev/null || true
fi

echo "== 6/6  swap and restart"
cp -r .next/standalone/. "$APP/"
mkdir -p "$APP/.next"
rm -rf "$APP/.next/static"
cp -r .next/static "$APP/.next/static"
rm -rf "$APP/public"
cp -r public "$APP/public"
pm2 restart lotus --update-env

sleep 4
echo
echo "== verify"
curl -s https://lotusplay.tech/api/version || true
echo
pm2 status lotus
echo
echo "Rollback if needed:"
echo "  cp -r $BUILD/app-previous/.next/. $APP/.next/ && pm2 restart lotus"
echo "  database backup: /root/deploy-backups/db-$STAMP.json"
