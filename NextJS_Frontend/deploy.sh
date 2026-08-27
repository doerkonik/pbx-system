#!/usr/bin/env bash
# =============================================================================
#  Zero-downtime frontend deploy.
#
#  Building straight into .next deletes the JS chunks the running server is
#  still serving, so for the whole build window every page dies with
#  "Application error: a client-side exception has occurred". Instead we build
#  into a staging dir, then swap it in with mv (atomic rename) and restart.
#
#  The live site keeps serving the OLD build for the entire build, and the
#  running process keeps its open handles through the rename, so the only
#  interruption is the pm2 restart itself (a couple of seconds).
#
#  Usage:  bash deploy.sh
# =============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

STAGE=".next-stage"
PREV=".next-prev"

echo "==> Building into $STAGE (live site untouched)"
rm -rf "$STAGE"
NEXT_DIST_DIR="$STAGE" npm run build

if [[ ! -f "$STAGE/BUILD_ID" ]]; then
  echo "!! Build produced no BUILD_ID — aborting, live build left in place."
  rm -rf "$STAGE"
  exit 1
fi

echo "==> Swapping build in"
rm -rf "$PREV"
[[ -d .next ]] && mv .next "$PREV"
mv "$STAGE" .next

echo "==> Restarting pm2 process"
pm2 restart pbx-frontend --update-env >/dev/null

# Wait for the new server to actually answer before declaring success.
for _ in $(seq 1 30); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' https://127.0.0.1:3002/login || true)
  [[ "$code" == "200" ]] && { echo "==> OK — /login returns 200 (build $(cat .next/BUILD_ID))"; exit 0; }
  sleep 1
done

echo "!! New build did not come up. Roll back with:"
echo "   rm -rf .next && mv $PREV .next && pm2 restart pbx-frontend"
exit 1
