#!/usr/bin/env bash
# The go-live check (web/DEPLOYMENT.md): asks the live site for five kinds of
# address and checks every response header that web/public/_headers sets.
# The deploy job (.github/workflows/site.yml) runs it after every deploy; by
# hand:
#
#   bash deploy/check-live.sh https://tabletalk.fyi
#   bash deploy/check-live.sh https://tabletalk.<account>.workers.dev
#
# Addresses: the home page, a team page, a page that doesn't exist (must be a
# 404 with the same headers), one /_astro/ file and one font. For each:
#   - every security header present exactly once, with the planned value;
#   - exactly one Cache-Control, with the value for its kind of file (two
#     values joined with a comma would mean two _headers rules both set it);
#   - no Set-Cookie (the footer promises no cookies);
#   - no Report-To or Nel (Cloudflare's error reports to another server);
#   - for pages, no "cloudflareinsights" (Cloudflare's injected beacon), and
#     the page is compressed for a browser that asks (gzip or Brotli).
# Prints one line per check and exits 1 if any failed.
set -euo pipefail

base="${1:?usage: check-live.sh https://<site address>}"
base="${base%/}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failed=0

PAGE_CACHE="no-cache"
HASHED_CACHE="public, max-age=31536000, immutable"
SECURITY=(
  "content-security-policy|frame-ancestors 'none'"
  "x-frame-options|DENY"
  "x-content-type-options|nosniff"
  "referrer-policy|strict-origin-when-cross-origin"
  "permissions-policy|camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"
  "cross-origin-opener-policy|same-origin"
  "cross-origin-resource-policy|same-origin"
)

ok() { echo "  ok    $*"; }
bad() { echo "  FAIL  $*"; failed=1; }

# fetch <path> <name>: GET the path; headers to $work/<name>.h (names in lower
# case, no CR), body to $work/<name>.b, status code printed. A failed request
# (no DNS yet, no certificate, a timeout) prints curl's error and status 000,
# and the checks carry on, so every address is still reported.
fetch() {
  : > "$work/$2.b"
  : > "$work/$2.raw"
  curl -sS --max-time 30 -o "$work/$2.b" -D "$work/$2.raw" -w '%{http_code}' "$base$1" || true
  tr -d '\r' < "$work/$2.raw" | awk -F': ' 'NF > 1 { $1 = tolower($1) } { print }' OFS=': ' > "$work/$2.h"
}

# values <name> <header>: every value of that header, one per line.
values() { grep -i "^$2: " "$work/$1.h" | sed "s/^[^:]*: //" || true; }

# check <path> <name> <expected status> <expected Cache-Control> <page?>
check() {
  local path="$1" name="$2" want_status="$3" want_cache="$4" page="$5" status entry header value got
  status="$(fetch "$path" "$name")"
  echo "$path"
  [ "$status" = "$want_status" ] && ok "status $status" || bad "status $status, expected $want_status"
  for entry in "${SECURITY[@]}"; do
    header="${entry%%|*}"
    value="${entry#*|}"
    got="$(values "$name" "$header")"
    [ "$got" = "$value" ] && ok "$header" || bad "$header: got '${got//$'\n'/ + }', expected '$value'"
  done
  got="$(values "$name" strict-transport-security)"
  case "$got" in
    "max-age=86400" | "max-age=31536000") ok "strict-transport-security ($got)" ;;
    *) bad "strict-transport-security: got '${got//$'\n'/ + }'" ;;
  esac
  got="$(values "$name" cache-control)"
  [ "$got" = "$want_cache" ] && ok "cache-control ($got)" || bad "cache-control: got '${got//$'\n'/ + }', expected '$want_cache'"
  got="$(values "$name" set-cookie)"
  [ -z "$got" ] && ok "no set-cookie" || bad "set-cookie: $got"
  # Cloudflare's Network Error Logging (reports to a.nel.cloudflare.com).
  for header in report-to nel; do
    got="$(values "$name" "$header")"
    [ -z "$got" ] && ok "no $header" || bad "$header: $got"
  done
  if [ "$page" = "page" ]; then
    grep -qi cloudflareinsights "$work/$name.b" && bad "the page mentions cloudflareinsights" || ok "no cloudflareinsights"
    # Asked again as a browser asks. Pages were once sent at full size
    # (no-transform in Cache-Control stopped Cloudflare compressing them).
    got="$(curl -sS --max-time 30 -o /dev/null -H 'Accept-Encoding: gzip, br' -w '%header{content-encoding}' "$base$path" || true)"
    case "$got" in
      gzip | br | zstd) ok "compressed ($got)" ;;
      *) bad "not compressed for a browser that asks: content-encoding '$got'" ;;
    esac
  fi
}

check / home 200 "$PAGE_CACHE" page

# A team page: the first team linked from the Premier League page.
fetch /premier-league/ league > /dev/null
team="$(grep -o 'href="/premier-league/[a-z0-9-]*/"' "$work/league.b" | grep -v '/matches/' | head -1 | cut -d'"' -f2 || true)"
[ -n "$team" ] && check "$team" team 200 "$PAGE_CACHE" page || bad "no team page linked from /premier-league/"

check "/no-such-page-$RANDOM/" missing 404 "$PAGE_CACHE" page

# A hashed file and a font: the home page's first stylesheet, and the first
# font named in any of its stylesheets.
sheets="$(grep -o '/_astro/[^"]*\.css' "$work/home.b" || true)"
if [ -n "$sheets" ]; then
  check "$(echo "$sheets" | head -1)" css 200 "$HASHED_CACHE" file
  font=""
  for sheet in $sheets; do
    fetch "$sheet" sheet > /dev/null
    font="$(grep -o '/_astro/[^)"'"'"']*\.woff2' "$work/sheet.b" | head -1 || true)"
    [ -z "$font" ] || break
  done
  [ -n "$font" ] && check "$font" font 200 "$HASHED_CACHE" file || bad "no font in the home page's stylesheets"
else
  bad "no /_astro/ stylesheet linked from /"
fi

if [ "$failed" = 0 ]; then
  echo "Go-live check passed: $base"
else
  echo "Go-live check FAILED: $base"
fi
exit "$failed"
