#!/usr/bin/env bash
set -euo pipefail

# CoopData AI Module — auto-stop GPU instance when idle (cost control).
# Run every 5 min via cron. Stops the EC2 instance if vLLM had no requests
# for IDLE_MINUTES.
#
# Cron:  */5 * * * * /opt/coopdata-ai/stop-gpu-if-idle.sh
#
# Requires the AWS CLI + an IAM role with ec2:StopInstances on this instance.

IDLE_MINUTES="${IDLE_MINUTES:-30}"
STATE_FILE="/tmp/coopdata_ai_last_request"
THRESHOLD_SECONDS=$((IDLE_MINUTES * 60))

# vLLM exposes a counter of successful requests. Track the last time it changed.
REQUESTS=$(curl -sf http://localhost:8000/metrics \
    | grep -E '^vllm:request_success_total' \
    | awk '{s+=$2} END {print s+0}' 2>/dev/null || echo 0)

if [[ -f "$STATE_FILE" ]]; then
    LAST_REQUESTS=$(cat "$STATE_FILE")
    if [[ "$REQUESTS" != "$LAST_REQUESTS" ]]; then
        # Activity detected — update timestamp and counter.
        date +%s > /tmp/coopdata_ai_last_activity
        echo "$REQUESTS" > "$STATE_FILE"
        exit 0
    fi
else
    echo "$REQUESTS" > "$STATE_FILE"
    date +%s > /tmp/coopdata_ai_last_activity
    exit 0
fi

# No new requests — check how long since last activity.
if [[ -f /tmp/coopdata_ai_last_activity ]]; then
    LAST_ACTIVITY=$(cat /tmp/coopdata_ai_last_activity)
    AGE=$(( $(date +%s) - LAST_ACTIVITY ))
    if (( AGE > THRESHOLD_SECONDS )); then
        INSTANCE_ID=$(curl -sf http://169.254.169.254/latest/meta-data/instance-id)
        echo "No AI requests for ${IDLE_MINUTES} min. Stopping instance ${INSTANCE_ID}."
        aws ec2 stop-instances --instance-ids "$INSTANCE_ID"
    fi
fi
