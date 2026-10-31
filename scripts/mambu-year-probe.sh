#!/usr/bin/env bash
# Read-only check: does the Mambu accounting report work for a whole past year?
# Asks for 1 January - 31 December of each year and prints only totals (no personal data).
#
# Usage:
#   export MAMBU_URL=https://<tenant>.sandbox.mambu.com/api MAMBU_USER=<user>
#   read -rs MAMBU_PASS; export MAMBU_PASS
#   ./scripts/mambu-year-probe.sh [branchId] [firstYear] [lastYear]   (default: ES0006 2018 current year)
set -uo pipefail

: "${MAMBU_URL:?set MAMBU_URL}" "${MAMBU_USER:?set MAMBU_USER}" "${MAMBU_PASS:?set MAMBU_PASS}"
command -v jq >/dev/null || { echo "jq is required"; exit 1; }

BRANCH="${1:-ES0006}"
FIRST="${2:-2018}"
LAST="${3:-$(date +%Y)}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

api() {
  local method=$1 path=$2 body=${3:-}
  local args=(-sS -m 90 -K - -X "$method" -H "Accept: application/vnd.mambu.v2+json" -o "$TMP" -w '%{http_code}')
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  printf 'user = "%s:%s"\n' "$MAMBU_USER" "$MAMBU_PASS" | curl "${args[@]}" "$MAMBU_URL$path"
}

printf '%-6s %-9s %8s %8s %16s %16s %16s %16s\n' year result accounts nonzero assets liabilities equity "earnings"
for year in $(seq "$FIRST" "$LAST"); do
  code=$(api POST /accounting/reports \
    "{\"startDate\":\"$year-01-01\",\"endDate\":\"$year-12-31\",\"branchId\":\"$BRANCH\",\"currencyCode\":\"SZL\",\"balanceTypes\":[\"OPENING_BALANCE\",\"NET_CHANGE\",\"CLOSING_BALANCE\"]}")
  if [ "$code" != 200 ] && [ "$code" != 201 ] && [ "$code" != 202 ]; then
    printf '%-6s HTTP %s %s\n' "$year" "$code" "$(jq -r '.errors[0].errorReason // .returnMessage // empty' "$TMP" 2>/dev/null)"
    continue
  fi
  key=$(jq -r '.reportKey // empty' "$TMP")
  status=""
  for _ in $(seq 1 20); do
    sleep 3
    api GET "/accounting/reports/$key" >/dev/null
    status=$(jq -r '.status // empty' "$TMP")
    [ "$status" = COMPLETE ] && break
    [ "$status" = FAILED ] && break
  done
  if [ "$status" != COMPLETE ]; then
    printf '%-6s report %s\n' "$year" "${status:-timed out}"
    continue
  fi
  jq -r --arg y "$year" '
    [.items[] | select(.glAccount.usage != "HEADER")] as $a
    | def total($t): [$a[] | select(.glAccount.type == $t) | .amounts.closingBalance] | add // 0;
      ($a | length) as $n
    | ([$a[] | select(.amounts.closingBalance != 0 or .amounts.netChange != 0)] | length) as $nz
    | (total("INCOME") - total("EXPENSE")) as $e
    | [$y, "COMPLETE", $n, $nz, total("ASSET"), total("LIABILITY"), total("EQUITY"), $e]
    | @tsv' "$TMP" |
    awk -F'\t' '{printf "%-6s %-9s %8s %8s %16.2f %16.2f %16.2f %16.2f\n",$1,$2,$3,$4,$5,$6,$7,$8}'
done
echo
echo "A year is usable when assets = liabilities + equity + earnings (gap near 0) and nonzero accounts > 0."
