#!/usr/bin/env bash
# Read-only data-availability check against a Mambu sandbox.
# Saves raw responses (personal fields stripped) and a summary outside the repo.
#
# Usage:
#   export MAMBU_URL=https://<tenant>.sandbox.mambu.com/api MAMBU_USER=<user>
#   read -rs MAMBU_PASS; export MAMBU_PASS
#   ./scripts/mambu-explore.sh [output-dir]      (default: ~/mambu-samples)
set -uo pipefail

: "${MAMBU_URL:?set MAMBU_URL}" "${MAMBU_USER:?set MAMBU_USER}" "${MAMBU_PASS:?set MAMBU_PASS}"
command -v jq >/dev/null || { echo "jq is required"; exit 1; }

OUT="${1:-$HOME/mambu-samples}"
mkdir -p "$OUT"
SUMMARY="$OUT/availability-summary.txt"
: > "$SUMMARY"

CLIENT_ALLOW='map({id,state,creationDate,activationDate,approvedDate,closedDate,birthDate,gender,assignedBranchKey,assignedCentreKey,clientRoleKey,groupKeys,loanCycle,lastModifiedDate,
  address:(.addresses[0]|{region,city,country,postcode}),
  adl:{region:._ADL.RG,dateJoined:._ADL.dateJoined,dateResignedDeceased:._ADL.dateResignedDeceased,memberCategory:._ADL.mcat},
  meet:{memberCategory:._meet.memberCategory,memberPresence:._meet.memberPresence,agm:._meet.Special_General_Meeting_Members}})'

esc() { local s=${1//\\/\\\\}; printf '%s' "${s//\"/\\\"}"; }

call() {
  local method=$1 path=$2 file=$3 body=${4:-} accept=${5:-application/vnd.mambu.v2+json} code
  local args=(-sS -m 60 -K - -X "$method" -H "Accept: $accept"
    -D "$OUT/$file.headers" -o "$OUT/$file" -w '%{http_code}')
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  code=$(printf 'user = "%s:%s"\n' "$(esc "$MAMBU_USER")" "$(esc "$MAMBU_PASS")" | curl "${args[@]}" "$MAMBU_URL$path")
  local line
  line=$(printf '%-5s %-4s %s' "$code" "$method" "$path")
  [ -n "${QUIET:-}" ] || echo "$line"
  echo "$line" >> "$SUMMARY"
}

total() { grep -i '^items-total' "$OUT/$1.headers" 2>/dev/null | tr -d '\r' | awk '{print $2}'; }

keys() {
  [ -s "$OUT/$1" ] || return
  printf '\n[%s] fields seen:\n' "$1" >> "$SUMMARY"
  jq -r 'if type=="array" then [.[]?|keys[]]|unique|join(", ") elif type=="object" then keys|join(", ") else . end' "$OUT/$1" >> "$SUMMARY" 2>/dev/null
}

echo "== Profile and reference data" | tee -a "$SUMMARY"
call GET '/branches?limit=100&detailsLevel=FULL&paginationDetails=ON' branches.json
call GET '/centres?limit=100&detailsLevel=FULL' centres.json
call GET '/currencies?limit=50' currencies.json
call GET '/customfieldsets?limit=100' customfieldsets.json
call GET '/customfieldsets?availableFor=BRANCH&limit=100' customfieldsets-branch.json
call GET '/depositproducts?limit=100&detailsLevel=FULL' depositproducts.json
call GET '/loanproducts?limit=100' loanproducts.json

echo "== Ledger" | tee -a "$SUMMARY"
for t in ASSET LIABILITY EQUITY INCOME EXPENSE; do
  call GET "/glaccounts?type=$t&limit=1000&paginationDetails=ON" "glaccounts-$t.json"
done
FIRST_GL=$(jq -r '.[0].glCode // empty' "$OUT/glaccounts-ASSET.json" 2>/dev/null)
[ -n "$FIRST_GL" ] && call GET "/glaccounts/$FIRST_GL?from=2026-09-01&to=2026-09-30" glaccount-balance.json
[ -n "$FIRST_GL" ] && call GET "/glaccounts/$FIRST_GL?from=2026-09-01&to=2026-09-30&branchId=ES0006" glaccount-balance-branch.json
call POST '/gljournalentries:search?limit=20' gljournalentries.json \
  '{"filterCriteria":[{"field":"bookingDate","operator":"BETWEEN","value":"2026-01-01","secondValue":"2026-01-31"}]}'
call POST '/accounting/reports' accounting-report-start.json \
  '{"startDate":"2026-09-01","endDate":"2026-09-30","branchId":"ES0006","balanceTypes":["OPENING_BALANCE","NET_CHANGE","CLOSING_BALANCE"]}'
RKEY=$(jq -r '.reportKey // empty' "$OUT/accounting-report-start.json" 2>/dev/null)
if [ -n "$RKEY" ]; then
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 3
    call GET "/accounting/reports/$RKEY" accounting-report.json
    [ "$(jq -r '.status // empty' "$OUT/accounting-report.json" 2>/dev/null)" = COMPLETE ] && break
  done
fi
SACCO_KEY=$(jq -r '.[]|select(.id=="ES0006")|.encodedKey' "$OUT/branches.json" 2>/dev/null)
if [ -n "$SACCO_KEY" ]; then
  call POST '/gljournalentries:search?limit=1&paginationDetails=ON' gljournalentries-branch-sep.json \
    "{\"filterCriteria\":[{\"field\":\"assignedBranchKey\",\"operator\":\"EQUALS\",\"value\":\"$SACCO_KEY\"},{\"field\":\"bookingDate\",\"operator\":\"BETWEEN\",\"value\":\"2026-09-01\",\"secondValue\":\"2026-09-30\"}]}"
fi

echo "== Members" | tee -a "$SUMMARY"
call GET '/clients?limit=20&detailsLevel=FULL&paginationDetails=ON' clients.json
jq "$CLIENT_ALLOW" "$OUT/clients.json" > "$OUT/clients.tmp" 2>/dev/null && mv "$OUT/clients.tmp" "$OUT/clients.json"

echo "== Savings, shares and fixed deposits" | tee -a "$SUMMARY"
call GET '/deposits?limit=20&detailsLevel=FULL&paginationDetails=ON' deposits.json
call GET '/deposits?limit=20&detailsLevel=FULL&branchId=ES0006&paginationDetails=ON' deposits-branch.json
DEP_KEY=$(jq -r '[.[]|select((.balances.totalBalance//0)>0 and (.name|test("share";"i")|not))][0].encodedKey // empty' "$OUT/deposits-branch.json" 2>/dev/null)
[ -n "$DEP_KEY" ] && call POST '/deposits/transactions:search?limit=50' deposit-transactions.json \
  "{\"filterCriteria\":[{\"field\":\"parentAccountKey\",\"operator\":\"EQUALS\",\"value\":\"$DEP_KEY\"}]}"

for t in FIXED_DEPOSIT SAVINGS_PLAN; do
  call POST '/deposits:search?limit=3&detailsLevel=FULL' "deposits-$t.json" \
    "{\"filterCriteria\":[{\"field\":\"accountType\",\"operator\":\"EQUALS\",\"value\":\"$t\"},{\"field\":\"accountState\",\"operator\":\"EQUALS\",\"value\":\"ACTIVE\"}]}"
done
call POST '/deposits/transactions:search?limit=5' deposit-withdrawals.json \
  '{"filterCriteria":[{"field":"type","operator":"EQUALS","value":"WITHDRAWAL"}]}'

echo "== Loans" | tee -a "$SUMMARY"
call GET '/loans?limit=20&detailsLevel=FULL&paginationDetails=ON' loans.json
call GET '/loans?limit=5&detailsLevel=FULL&accountState=ACTIVE_IN_ARREARS' loans-in-arrears.json
call GET '/loans?limit=1&branchId=ES0006&paginationDetails=ON' loans-branch.json
call GET '/clients?limit=1&branchId=ES0006&paginationDetails=ON' clients-branch.json
for sub in WRITTEN_OFF RESCHEDULED REFINANCED; do
  call POST '/loans:search?limit=3' "loans-$sub.json" \
    "{\"filterCriteria\":[{\"field\":\"accountSubState\",\"operator\":\"EQUALS\",\"value\":\"$sub\"}]}"
done
LOAN_ID=$(jq -r '.[0].id // empty' "$OUT/loans.json" 2>/dev/null)
LOAN_KEY=$(jq -r '.[0].encodedKey // empty' "$OUT/loans.json" 2>/dev/null)
[ -n "$LOAN_ID" ] && call GET "/loans/$LOAN_ID/schedule" loan-schedule.json
[ -n "$LOAN_KEY" ] && call POST '/loans/transactions:search?limit=50' loan-transactions.json \
  "{\"filterCriteria\":[{\"field\":\"parentAccountKey\",\"operator\":\"EQUALS\",\"value\":\"$LOAN_KEY\"}]}"

echo "== Deep probes" | tee -a "$SUMMARY"
call GET '/loans?limit=3&detailsLevel=FULL&accountState=CLOSED_WRITTEN_OFF' loans-closed-written-off.json
call POST '/loans/transactions:search?limit=3' loan-transactions-writeoff.json \
  '{"filterCriteria":[{"field":"type","operator":"EQUALS","value":"WRITE_OFF"}]}'
call GET '/installments?dueFrom=2026-09-01&dueTo=2026-09-30&installmentState=LATE&limit=5&paginationDetails=ON' installments-late.json
for st in MATURED WITHDRAWN LOCKED; do
  call POST '/deposits:search?limit=3&detailsLevel=FULL' "deposits-state-$st.json" \
    "{\"filterCriteria\":[{\"field\":\"accountState\",\"operator\":\"EQUALS\",\"value\":\"$st\"}]}"
done
if [ -n "${DEP_KEY:-}" ]; then
  call GET "/deposits/$DEP_KEY/balanceSummary?startDate=2026-01-01&endDate=2026-03-31&limit=10" deposit-balance-summary.json
  call POST '/deposits/balanceSummary:search?limit=10' deposit-balance-summary-search.json \
    "{\"filterCriteria\":[{\"field\":\"encodedKey\",\"operator\":\"EQUALS\",\"value\":\"$DEP_KEY\"}]}"
fi
call GET '/groups?branchId=ES0006&detailsLevel=FULL&limit=5&paginationDetails=ON' groups-branch.json
call GET '/organization/transactionChannels' transaction-channels.json
call GET '/configuration/clientroles.yaml' clientroles.yaml '' 'application/vnd.mambu.v2+yaml'
call GET '/configuration/grouprolenames.yaml' grouprolenames.yaml '' 'application/vnd.mambu.v2+yaml'

echo "== Custom field definitions (names and options only)" | tee -a "$SUMMARY"
mkdir -p "$OUT/cf"
QUIET=1
for id in $(jq -r '.[].customFields[]?.id' "$OUT/customfieldsets.json" 2>/dev/null | sort -u); do
  call GET "/customfields/$id" "cf/$id.json"
done
unset QUIET
jq -s 'map(select(.id)|{id,type,state,usage,name:.displaySettings.displayName,availableFor,options:[.selectionOptions[]?.value]})' "$OUT"/cf/*.json > "$OUT/customfield-definitions.json" 2>/dev/null
echo "customfield-definitions.json: $(jq length "$OUT/customfield-definitions.json" 2>/dev/null) definitions" | tee -a "$SUMMARY"

echo "== Value distributions (counts only, no records)" | tee -a "$SUMMARY"
call GET '/clients?branchId=ES0006&state=ACTIVE&limit=500&detailsLevel=FULL' clients-sample500.json
jq '{n:length,state:(group_by(.state)|map({(.[0].state):length})|add),region:(group_by(._ADL.RG)|map({((.[0]._ADL.RG)//"none"):length})|add),category:(group_by(._ADL.mcat)|map({((.[0]._ADL.mcat)//"none"):length})|add),presence:(group_by(._meet.memberPresence)|map({((.[0]._meet.memberPresence)//"none"):length})|add),agm:(group_by(._meet.Special_General_Meeting_Members)|map({((.[0]._meet.Special_General_Meeting_Members)//"none"):length})|add),addressRegion:(group_by(.addresses[0].region)|map({((.[0].addresses[0].region)//"none"):length})|add),role:(group_by(.clientRoleKey)|map({((.[0].clientRoleKey)//"none"):length})|add)}' "$OUT/clients-sample500.json" > "$OUT/client-distributions.json" 2>/dev/null
call GET '/loans?branchId=ES0006&accountState=ACTIVE&limit=500&detailsLevel=FULL' loans-sample500.json
jq '{n:length,state:(group_by(.accountState)|map({(.[0].accountState):length})|add),purpose:(group_by(._LINFO.loanp)|map({((.[0]._LINFO.loanp)//"none"):length})|add),product:(group_by(.loanName)|map({(.[0].loanName):length})|add)}' "$OUT/loans-sample500.json" > "$OUT/loan-distributions.json" 2>/dev/null
jq 'map(select(.name))|{n:length,withdrawalPurposeSet:(map(select(._WTR.wp!=null))|length)}' "$OUT/deposits-branch.json" > "$OUT/deposit-distributions.json" 2>/dev/null
rm -f "$OUT/clients-sample500.json" "$OUT/loans-sample500.json"

{
  printf '\n== Record counts (Items-Total)\n'
  for f in branches clients deposits loans clients-branch deposits-branch loans-branch glaccounts-ASSET gljournalentries-branch-sep; do
    printf '%-30s %s\n' "$f" "$(total $f.json)"
  done
} | tee -a "$SUMMARY"

for f in branches centres customfieldsets customfieldsets-branch accounting-report-start accounting-report depositproducts loanproducts glaccounts-ASSET glaccount-balance glaccount-balance-branch \
  gljournalentries gljournalentries-branch-sep clients deposits deposits-FIXED_DEPOSIT deposits-SAVINGS_PLAN deposit-transactions deposit-withdrawals loans loans-in-arrears \
  loans-WRITTEN_OFF loans-RESCHEDULED loans-REFINANCED loan-schedule loan-transactions loans-closed-written-off loan-transactions-writeoff installments-late deposits-state-MATURED deposits-state-WITHDRAWN deposits-state-LOCKED deposit-balance-summary deposit-balance-summary-search groups-branch transaction-channels; do
  keys "$f.json"
done

echo
echo "Done. Review: $SUMMARY"
