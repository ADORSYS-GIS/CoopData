# Runbooks — coop data

Provide actionable, step-by-step instructions for common operational tasks and incidents. Keep each runbook:

- Single-purpose and short (5–10 min to execute)
- Tied to specific alerts/dashboards
- Verified at least once per quarter

## Index

<!-- TODO: Create individual runbook files and link them here -->

- [Service X: High Error Rate] — *TODO: create runbook*
- [Database: High CPU/Connection Saturation] — *TODO: create runbook*
- [Queue Backlog Growing] — *TODO: create runbook*

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
