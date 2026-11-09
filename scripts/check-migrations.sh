#!/usr/bin/env bash
# Fails when backend/migrations has a duplicate number prefix or a gap in the
# numbering, except the ones already shipped and listed below.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backend/migrations"
ALLOWED_DUPLICATES=" 64 "
ALLOWED_GAPS=" 47 "

prefixes=$(ls "$DIR" | grep -E '^[0-9]+_.*\.sql$' | sed -E 's/^([0-9]+)_.*/\1/' | sed -E 's/^0+([0-9])/\1/' | sort -n)
fail=0

for dup in $(echo "$prefixes" | uniq -d); do
    if [[ "$ALLOWED_DUPLICATES" != *" $dup "* ]]; then
        echo "ERROR: migration number $dup is used by more than one file:"
        ls "$DIR" | grep -E "^0*${dup}_"
        fail=1
    fi
done

expected=$(echo "$prefixes" | head -n1)
for n in $(echo "$prefixes" | uniq); do
    while [[ "$n" -gt "$expected" && "$ALLOWED_GAPS" == *" $expected "* ]]; do
        expected=$((expected + 1))
    done
    if [[ "$n" != "$expected" ]]; then
        echo "ERROR: migration numbering has a gap: expected $expected, found $n"
        fail=1
        expected=$n
    fi
    expected=$((expected + 1))
done

[[ "$fail" -eq 0 ]] && echo "Migration numbering OK ($(echo "$prefixes" | uniq | wc -l) numbers)."
exit "$fail"
