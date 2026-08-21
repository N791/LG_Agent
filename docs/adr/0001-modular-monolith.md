# ADR 0001: Modular Monolith with Enforced Domain Boundaries

- Status: Accepted
- Date: 2026-07-28

## Decision

The API remains a NestJS modular monolith. Each domain owns its controllers, application services,
interfaces, and implementations. Cross-domain consumers use the owning module's public interface;
repository, strategy, provider, and adapter implementations stay private. Nest domain modules are
the composition roots that bind tokens to adapters.

An architecture check runs in CI and rejects forbidden deep imports, circular Nest module
dependencies, controller-to-foreign-service calls, framework dependencies in
`@lg-agent/contracts`, and missing public entry points for core deep modules.

## Consequences

Deployment stays simple and local calls remain cheap. A network boundary is introduced only when
independent scaling, failure isolation, or ownership justifies it. New modules must document their
public interface, internal implementation, adapter bindings, tenant scope, and contract-test seam.
