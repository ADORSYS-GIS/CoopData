#!/usr/bin/env bash
# Read-only check of how Mambu signs balances in accounting reports of different ranges.
# Prints totals per account type only (no personal data).
#
# Usage:
#   export MAMBU_URL=... MAMBU_USER=... MAMBU_PASS=...
#   ./scripts/mambu-sign-probe.sh [branchId] [year] [month]     (default: ES0006 2026 9)
set -uo pipefail

: "${MAMBU_URL:?set MAMBU_URL}" "${MAMBU_USER:?set MAMBU_USER}" "${MAMBU_PASS:?set MAMBU_PASS}"
command -v jq >/dev/null || { echo "jq is required"; exit 1; }

BRANCH="${1:-ES0006}"
YEAR="${2:-2026}"
MONTH="${3:-9}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

api() {
  local method=$1 path=$2 body=${3:-}
  local args=(-sS -m 90 -K - -X "$method" -H "Accept: application/vnd.mambu.v2+json" -o "$TMP" -w '%{http_code}')
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  printf 'user = "%s:%s"\n' "$MAMBU_USER" "$MAMBU_PASS" | curl "${args[@]}" "$MAMBU_URL$path"
}

last_day() { date -d "$1-$2-01 +1 month -1 day" +%Y-%m-%d; }

probe() {
  local label=$1 start=$2 end=$3 types=$4
  local code key status
  code=$(api POST /accounting/reports \
    "{\"startDate\":\"$start\",\"endDate\":\"$end\",\"branchId\":\"$BRANCH\",\"currencyCode\":\"SZL\",\"balanceTypes\":$types}")
  if [ "$code" != 200 ] && [ "$code" != 201 ] && [ "$code" != 202 ]; then
    echo "$label $start..$end: HTTP $code"; return
  fi
  key=$(jq -r '.reportKey // empty' "$TMP")
  for _ in $(seq 1 20); do
    sleep 3
    api GET "/accounting/reports/$key" >/dev/null
    status=$(jq -r '.status // empty' "$TMP")
    [ "$status" = COMPLETE ] || [ "$status" = FAILED ] && break
  done
  echo "== $label  $start .. $end  balanceTypes=$types  ($status)"
  printf '%-10s %16s %16s %16s %16s %16s\n' type opening debits credits net closing
  jq -r '
    [.items[] | select(.glAccount.usage != "HEADER")] as $a
    | ["ASSET","LIABILITY","EQUITY","INCOME","EXPENSE"][] as $t
    | [$a[] | select(.glAccount.type == $t) | .amounts] as $m
    | [$t,
       ([$m[].openingBalance // 0] | add // 0),
       ([$m[].debits // 0] | add // 0),
       ([$m[].credits // 0] | add // 0),
       ([$m[].netChange // 0] | add // 0),
       ([$m[].closingBalance // 0] | add // 0)] | @tsv' "$TMP" |
    awk -F'\t' '{printf "%-10s %16.2f %16.2f %16.2f %16.2f %16.2f\n",$1,$2,$3,$4,$5,$6}'
  echo
}

END_M="$(last_day "$YEAR" "$MONTH")"
ALL='["OPENING_BALANCE","NET_CHANGE","CLOSING_BALANCE"]'
probe "month (what the sync asks)" "$YEAR-$(printf %02d "$MONTH")-01" "$END_M" "$ALL"
probe "year to date (what the sync asks)" "$YEAR-01-01" "$END_M" "$ALL"
probe "whole past year" "$((YEAR - 1))-01-01" "$((YEAR - 1))-12-31" "$ALL"
probe "whole past year, closing only" "$((YEAR - 1))-01-01" "$((YEAR - 1))-12-31" '["CLOSING_BALANCE"]'
