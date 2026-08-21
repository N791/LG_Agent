# ADR 0003: Trigger for a Persistent Execution Adapter

- Status: Accepted
- Date: 2026-07-28

## Decision

Execution is consumed through `IExecutionAdapter`. The in-process adapter is suitable only when a
single process may own the work and restart loss is acceptable. The database-backed adapter is the
default durable choice when restart recovery, leasing, retries, cancellation, or multiple API
instances are required.

A separate queue or worker service is introduced only when database leasing no longer satisfies
measured throughput, isolation, or operational requirements.

## Consequences

Business code is adapter-agnostic. Adapter choice is made in composition, and every implementation
must pass the same dispatch, duplicate-delivery, retry, cancellation, and dead-letter contract.
