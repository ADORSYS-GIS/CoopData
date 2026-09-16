---
layout: default
title: "CI Coverage Gates"
parent: Testing
nav_order: 3
---

# CI Coverage Gates

A "Coverage Gate" is an automated check that runs in GitHub Actions every time a Pull Request is opened. It measures the percentage of code covered by tests. If the coverage falls below a pre-configured minimum threshold, the CI pipeline fails and blocks the PR from being merged.

This ensures that test coverage strictly improves (or at least remains stable) over time, forcing developers to write tests for their new code.

---

## 1. Frontend Gate (React / Vitest)

For the frontend, we use `vitest` to measure coverage.

### Where are the thresholds defined?
Thresholds are defined in `frontend/vitest.config.ts` under the `test.coverage` section:

```typescript
coverage: {
  // ...
  thresholds: {
    lines: 40,
    functions: 30,
    branches: 30,
    statements: 40,
  },
}
```
*Note: These should be raised incrementally as the project coverage grows.*

### How is it enforced?
In `.github/workflows/ci-frontend.yml`, the unit test step explicitly runs:
```bash
npm run coverage
```
When Vitest finishes, it compares the actual coverage against the thresholds. If any metric falls below the required percentage, Vitest exits with a non-zero code, failing the GitHub Action.

### How to check coverage locally
Run the following command in the `frontend/` directory:
```bash
npm run coverage
```
The CI also uploads an `lcov.info` artifact that you can download and view in your IDE to see exactly which lines are uncovered.

---

## 2. Backend Gate (Rust / Tarpaulin)

Rust doesn't measure coverage natively via `cargo test`, so we use a specialized tool called `cargo-tarpaulin`.

### How is it enforced?
In `.github/workflows/ci-backend.yml`, the CI installs `cargo-tarpaulin` and runs the tests with a strict line-coverage gate:
```bash
cargo tarpaulin --workspace --fail-under 70
```
The `--fail-under 70` argument is the gate. It tells Tarpaulin: *"If the total line coverage is less than 70%, exit with an error."* If this happens, the GitHub Action fails, blocking the PR.

### How to check coverage locally
If you have tarpaulin installed (`cargo install cargo-tarpaulin`), run the following in the `backend/` directory:
```bash
cargo tarpaulin --workspace
```
The CI also generates a `cobertura.xml` artifact that you can download and inspect.
