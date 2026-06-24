---
name: observability
description: Establishes metrics, logs, traces, dashboards, and alerts that drive fast detection and low MTTR.
---

# Observability Skill

## Objectives
- Actionable SLO-based alerts with clear ownership and runbooks
- Consistent correlation across logs/traces/metrics
- Dashboards that answer “what’s broken?” and “why?”

## Checklist
1. Define SLIs/SLOs for critical paths; set alert policies on error budget burn
2. Enable OpenTelemetry (OTLP) where feasible; propagate trace/context IDs
3. Logs are structured JSON, redacted for PII/secrets, with consistent fields
4. Golden dashboards per service with links to logs, traces, and runbooks
5. Alert noise reduction: page only on user-impacting signals

## Common Tasks
- Add OpenTelemetry SDK/exporters to a service and validate traces
- Create Prometheus rules and Grafana dashboards for RED/USE
- Implement log correlation IDs end-to-end through gateways and workers

## Output
- Config/code snippets for instrumentation
- Proposed dashboards and alert rules (YAML/JSON) with owners
- Risk/benefit notes and expected MTTR impact
