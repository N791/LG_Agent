# ADR 0002: Submission Is the Single Assessed-Execution Entry

- Status: Accepted
- Date: 2026-07-28

## Decision

All assessed task execution enters through the Submission public interface. Submission owns
idempotency, persisted state transitions, event logs, cancellation, replay, recovery, scoring, and
terminal hooks. Sandbox executes a workspace but does not create a parallel submission lifecycle.

## Consequences

Callers observe one state machine and one log stream. New side effects attach as terminal-hook
interfaces. Legacy or convenience endpoints must delegate to Submission rather than persist their
own attempt state.
