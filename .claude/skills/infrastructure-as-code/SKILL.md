---
name: infrastructure-as-code
description: Designs, reviews, and maintains Terraform/Helm/Ansible IaC with security and reliability best practices.
---

# Infrastructure as Code (IaC) Skill

## Objectives
- Declarative, idempotent, and reviewable infrastructure changes
- Secure state handling and secrets management
- Reusable modules/roles and environment overlays

## Checklist
1. Terraform: pinned providers, module reuse, `validate` + `fmt` + `tflint`
2. Plans posted to PRs; gated applies on protected branches
3. State: remote backend with locking and encryption; separate per env
4. Secrets: never in code; use Vault/SSM/Secrets Manager; refs not values
5. Helm: values files per env; `helm lint` passes; chart versioning
6. Ansible: idempotent tasks; roles > playbooks; `--check` support
7. Policy-as-code (OPA/Conftest/Checkov) enforced in CI

## Common Tasks
- Create a Terraform module scaffold with inputs/outputs and examples
- Add OPA policies to prevent public S3 buckets or open security groups
- Prepare Helm chart with sensible defaults and production values overlay

## Output
- Proposed IaC change (diff or module/values snippets)
- Risk assessment (blast radius, rollback)
- Policy conformance notes
