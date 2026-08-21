# Authorization registry and shared audit runbook

Epic 81 separates release-time registry writes from API startup. API pods only read
`permission_registry_state`; they never create permissions, system roles, or default grants.

## Release sequence

After Prisma migrations and before API/Web rollout, run exactly one idempotent command:

```bash
RELEASE_VERSION="$IMAGE_TAG" pnpm --filter @lg-agent/api authorization:reconcile
```

The command takes the PostgreSQL advisory transaction lock
`hashtext('lg-agent:permission-registry')`, reconciles `PERMISSION_REGISTRY`,
`SYSTEM_ROLE_REGISTRY`, and `DEFAULT_ROLE_PERMISSIONS`, then records the version, SHA-256 digest,
release version, and timestamp in `permission_registry_state`. Concurrent invocations serialize;
an older command refuses to downgrade a newer registry.

`GET /api/v1/health` is the liveness/database check.
`GET /api/v1/health/ready` also compares the database version and digest with the running code.
Mismatch returns 503 with `AUTH_REGISTRY_VERSION_MISMATCH`; Kubernetes must keep that pod out of
service. Do not bypass readiness. Re-run the matching immutable release's reconcile command.

Every permission change must:

1. update the TypeScript registry and default mappings;
2. increment `PERMISSION_REGISTRY_VERSION`;
3. add a forward-compatible migration and update
   `prisma/authorization-registry-manifest.json`;
4. pass `check-authorization-registry.mjs`, the Epic 81 Jest contract, and
   `prisma/tests/epic81-contract.sql`.

## Audit contract and failure policy

`common/audit` owns the only Prisma/CLS audit writer. Both Authorization and Observability use its
`AuditWriter` contract. `organizationId`, `requestId`, `traceId`, `before`, `after`, IP, and user
agent have dedicated, consistent fields; feature-specific details remain in `metadata`.

- Authorization denials and missing policy declarations use `BEST_EFFORT`: the request remains
  denied even when audit storage fails. The failure is never silent; it emits an error containing
  `AUDIT_EVENT_PERSISTENCE_FAILED` and increments
  `lg_audit_persistence_failures_total{severity="SECURITY"}`.
- Role creation, permission changes, and membership changes use `REQUIRED`. An audit failure
  returns 503 with `AUDIT_EVENT_PERSISTENCE_FAILED`. Because the business transaction may already
  have committed, operators must inspect the role and the error log before retrying.

Alert immediately on any `severity="SECURITY"` audit persistence failure. For a required failure,
compare the requested before/after values with current role state, create the missing incident
record, and retry only if the business change is absent. For best-effort denial failures, restore
audit storage and correlate request/trace IDs from application logs.

## Frontend compatibility

Both frontends use `@lg-agent/permission-react`. The provider compares
`/me/permissions.registryVersion` with its compiled registry version and exposes distinct
`loading`, `service-unavailable`, `version-mismatch`, `permission-denied`, and `ready` states.
Every state except `ready` has an empty permission set.

The identity key includes user, organization, and access token. A token refresh or organization
switch clears capabilities synchronously; late responses from an earlier identity are discarded.
Admin login restoration and Trainee token refresh remain app-specific adapters.
