# Benchmarks

This directory stores benchmark tasks used to evaluate milestone-level capability.

Benchmarks are not the same as ordinary test fixtures:

- `tests/fixtures/` support automated tests
- `benchmarks/` define higher-level evaluation tasks and reference repositories

The initial benchmark focus is `0.2.0`, where Code Orb should move from a narrow MVP into a small but believable alpha for local repository work.

Current milestone-aligned benchmarks:

- `failing-test-fix/` for the `0.2.0` runnable alpha path
- `verification-still-fails/` for the `0.3.0` edit-and-verify failure-reporting path
