# Runbooks — coop data

Provide actionable, step-by-step instructions for common operational tasks and incidents. Keep each runbook:
- Single-purpose and short (5–10 min to execute)
- Tied to specific alerts/dashboards
- Verified at least once per quarter

## Index
<!-- TODO: Link to individual runbooks below -->
- [Service X: High Error Rate](runbooks/service-x-high-error-rate.md)
- [Database: High CPU/Connection Saturation](runbooks/database-cpu-saturation.md)
- [Queue Backlog Growing](runbooks/queue-backlog.md)

## Template
```
Title: <Concise title>
Owner: <Team or person>
Severity: <P1–P4>
Related Alerts: <Link(s)>
Dashboards: <Link(s)>

1) Context
- What the alert means and likely user impact.

2) Immediate Actions (Mitigation)
- Step-by-step, reversible actions. Include commands with placeholders.

3) Diagnosis
- Commands/queries to gather evidence (logs, traces, metrics).

4) Remediation
- Permanent fix options or links to relevant tickets.

5) Validation
- How to confirm recovery via SLOs/metrics.

6) Post‑Incident
- Notes to include in PIR, follow-ups, owners, due dates.
```
