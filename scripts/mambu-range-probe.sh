#!/usr/bin/env bash
# Read-only: which accounting report date ranges does Mambu answer correctly?
# For each range prints totals per type and the accounting-equation gap under both
# sign conventions. The right convention shows a gap near 0. Totals only, no personal data.
#
# Usage:
#   export MAMBU_URL=... MAMBU_USER=... MAMBU_PASS=...
#   ./scripts/mambu-range-probe.sh [branchId]        (default: ES0006)
#   NO_CURRENCY=1 ./scripts/mambu-range-probe.sh     (do not filter by currency: all accounts)
set -uo pipefail

: "${MAMBU_URL:?set MAMBU_URL}" "${MAMBU_USER:?set MAMBU_USER}" "${MAMBU_PASS:?set MAMBU_PASS}"
command -v jq >/dev/null || { echo "jq is required"; exit 1; }

BRANCH="${1:-ES0006}"
if [ -n "${NO_CURRENCY:-}" ]; then CUR=''; else CUR=',"currencyCode":"SZL"'; fi
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

api() {
  local method=$1 path=$2 body=${3:-}
  local args=(-sS -m 90 -K - -X "$method" -H "Accept: application/vnd.mambu.v2+json" -o "$TMP" -w '%{http_code}')
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  printf 'user = "%s:%s"\n' "$MAMBU_USER" "$MAMBU_PASS" | curl "${args[@]}" "$MAMBU_URL$path"
}

printf '%-34s %14s %14s %14s %14s %14s | %14s %14s\n' range assets liabilities equity income expense "gap natural" "gap signed"

probe() {
  local label=$1 start=$2 end=$3 code key status=""
  code=$(api POST /accounting/reports \
    "{\"startDate\":\"$start\",\"endDate\":\"$end\",\"branchId\":\"$BRANCH\"$CUR,\"balanceTypes\":[\"OPENING_BALANCE\",\"NET_CHANGE\",\"CLOSING_BALANCE\"]}")
  if [ "$code" != 200 ] && [ "$code" != 201 ] && [ "$code" != 202 ]; then
    printf '%-34s HTTP %s\n' "$label" "$code"; return
  fi
  key=$(jq -r '.reportKey // empty' "$TMP")
  for _ in $(seq 1 20); do
    sleep 3
    api GET "/accounting/reports/$key" >/dev/null
    status=$(jq -r '.status // empty' "$TMP")
    [ "$status" = COMPLETE ] || [ "$status" = FAILED ] && break
  done
  [ "$status" = COMPLETE ] || { printf '%-34s report %s\n' "$label" "${status:-timed out}"; return; }
  jq -r --arg l "$label" '
    [.items[] | select(.glAccount.usage != "HEADER")] as $a
    | def t($x): [$a[] | select(.glAccount.type == $x) | .amounts.closingBalance] | add // 0;
      t("ASSET") as $A | t("LIABILITY") as $L | t("EQUITY") as $Q | t("INCOME") as $I | t("EXPENSE") as $E
    | [$l, $A, $L, $Q, $I, $E, ($A - $L - $Q - $I + $E), ($A + $L + $Q + $I + $E)] | @tsv' "$TMP" |
    awk -F'\t' '{printf "%-34s %14.2f %14.2f %14.2f %14.2f %14.2f | %14.2f %14.2f\n",$1,$2,$3,$4,$5,$6,$7,$8}'
}

probe "month 2026-09"             2026-09-01 2026-09-30
probe "from 2026-08-01 to 09-30"  2026-08-01 2026-09-30
probe "from 2026-07-01 to 09-30"  2026-07-01 2026-09-30
probe "from 2026-06-01 to 09-30"  2026-06-01 2026-09-30
probe "from 2026-05-01 to 09-30"  2026-05-01 2026-09-30
probe "from 2026-04-01 to 09-30"  2026-04-01 2026-09-30
probe "from 2026-03-01 to 09-30"  2026-03-01 2026-09-30
probe "day 2026-08-31"            2026-08-31 2026-08-31
probe "day 2026-06-30"            2026-06-30 2026-06-30
probe "day 2026-03-31"            2026-03-31 2026-03-31
probe "day 2025-12-31"            2025-12-31 2025-12-31
probe "day 2024-12-31"            2024-12-31 2024-12-31
echo
echo "Trust a range when one of the two gaps is near 0. Compare the same date across ranges."
