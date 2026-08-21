# Authorization cluster-safety runbook

Epic 80 deliberately uses a database read for every `AuthorizationService.resolve()` call. There
is no process-local decision cache, so a revoked assignment is rejected by every API pod on its
next authorization query. Do not add an in-memory authorization cache.

## Approved performance gate

Run the baseline against production-like PostgreSQL data and connection settings:

```bash
pnpm --filter @lg-agent/api benchmark:authorization
```

The approved defaults are P95 <= 75 ms, P99 <= 150 ms, and database connection utilization <=
80%. The JSON result also records P50 and database QPS. Store release-candidate output with the
deployment evidence. If a threshold fails, do not add a local cache: propose Redis invalidation or
a database authorization-version check and run the same cross-instance contract.

### 2026-07-28 verification record

An isolated PostgreSQL 16/pgvector database was migrated from empty through all 13 migrations,
seeded, and measured with 500 resolutions at concurrency 10:

| Metric       |         Result |      Gate |
| ------------ | -------------: | --------: |
| P50          |        5.10 ms |  recorded |
| P95          |        6.79 ms |  <= 75 ms |
| P99          |       50.83 ms | <= 150 ms |
| Database QPS |       1,456.66 |  recorded |
| Connections  | 11 / 100 (11%) |    <= 80% |

All gates passed, so Epic 80 keeps database-real-time resolution and does not enable a cache.

### 2026-07-28 two-instance E2E record

Two independently started API processes shared the isolated migrated database. Requests were sent
directly to both instances before and immediately after each database change:

| Scenario                        | Before                 | First request after change |
| ------------------------------- | ---------------------- | -------------------------- |
| System role revocation          | pod 1: 200; pod 2: 200 | pod 1: 403; pod 2: 403     |
| High-risk `user:manage` removal | pod 1: 200; pod 2: 200 | pod 1: 403; pod 2: 403     |
| Custom-role member removal      | pod 1: 200; pod 2: 200 | pod 1: 403; pod 2: 403     |

This run also caught and fixed the missing `AuthorizationAuditService` module export that had
prevented the global permission guard from resolving in a real application process.

Runtime dashboards should use:

- `lg_authorization_resolution_duration_seconds`
- `lg_authorization_resolution_db_queries_total`
- `lg_authorization_legacy_bridge_uses_total`
- `lg_authorization_legacy_bridge_last_use_timestamp_seconds`

Alert when P95 exceeds 75 ms for 10 minutes, connection utilization exceeds 80%, or any legacy
bridge use occurs after the compatibility end version.

## Revocation verification

Deploy at least two API pods behind the normal load balancer. Assign a high-risk permission to a
test user, prove it succeeds through both pods, then revoke it. The first request routed to each
pod must return 403. Repeat for role permission removal and organization membership removal.

The automated two-instance contract is:

```bash
pnpm --filter @lg-agent/api test -- --runInBand epic80-authorization.spec.ts
```

Run the database contract after migrations:

```bash
psql "$DATABASE_URL" -f packages/api/prisma/tests/epic80-contract.sql
```

## Legacy bridge removal gate

The `users.role` bridge remains rollback-compatible through application version `2.0.0`. It
dual-writes the current system role on create/change, lazy-backfills missing assignments from the
database user row (never from a potentially stale JWT), preserves custom roles on legacy role
changes, and drops all source-organization assignments before a tenant move.

`users.legacy_role_migrated_at` distinguishes a never-migrated row from a deliberately revoked
assignment. Once set, an empty assignment set is authoritative and lazy backfill will not recreate
the revoked role.

Remove the bridge only when all of the following hold for one complete release window:

1. the bridge-use counter has not increased and the last-use timestamp predates that window;
2. every user has exactly one matching legacy system-role assignment;
3. the previous release can be rolled back without losing custom assignments;
4. the migration and database contract have passed on a restored production snapshot.
