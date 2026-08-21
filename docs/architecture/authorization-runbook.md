# Authorization and permission management runbook

Epic C replaces controller role checks with a versioned permission contract. Authentication proves
the actor; authorization resolves database-backed roles for the actor's organization; domain
services still apply organization and resource ownership predicates.

## Runtime contract

- `packages/contracts/src/authorization.ts` is the permission source of truth. Permission keys use
  `resource:action`, carry a registry version, scope, risk level, and optional replacement.
- `GET /api/v1/me/permissions` is the only frontend capability source. A loading or failed request
  exposes no protected UI.
- `PermissionGuard` is deny-by-default. Public handlers require `@Public()` and authenticated
  handlers require `@RequirePermission()` or `@RequireAnyPermission()`.
- Permission cache keys are `userId:organizationId`. Role permission/member changes invalidate all
  entries for that organization after the database transaction commits.
- Organization role administration cannot list, copy, grant, or assign platform-scoped
  permissions. Platform access is operator-provisioned with
  `BOOTSTRAP_PLATFORM_ADMIN=true`; it is never part of the `ADMIN` default mapping.

## Permission lifecycle

Permissions are append-only within a registry version.

1. **Rename:** add the new permission, set the old definition's `replacement`, grant both during a
   compatibility release, migrate `role_permissions`, then set `deprecatedAt` on the old row.
2. **Split:** add every destination permission, backfill each role using an explicit policy table,
   dual-declare the controller during the compatibility release, then deprecate the source.
3. **Delete:** first deprecate and stop declaring the permission. Verify that no controller metadata
   or `role_permissions` row references it. Physical deletion is a later, separately reviewed
   migration.

Never reuse an old key for different semantics. `node packages/api/scripts/check-architecture.mjs`
fails when a controller uses a permission absent from the registry or retains legacy role metadata.

## Change and rollback procedure

Role permission and member changes require the operator to enter the role name after reviewing the
impact preview. Audit events record actor, organization, request ID, resource, and before/after
values.

To roll back a role change:

1. Locate `authorization.role.permissions_changed` or
   `authorization.role.members_changed` in the organization audit stream.
2. Submit the event's `before` value through the same administration endpoint and confirmation
   flow. Do not edit join tables directly.
3. Confirm `/me/permissions` for one affected user and verify the authorization-denial metric has
   returned to baseline.

For an application rollback, keep the additive Epic C tables and registry rows. Roll back code
without dropping authorization data; the legacy `users.role` column remains populated as a
one-release migration bridge. Reapplying Epic C is idempotent.

## Release reconciliation

Application startup is read-only and never writes registry data. The Helm migration hook is the
only production reconciliation path:

```bash
node packages/api/node_modules/prisma/build/index.js migrate status \
  --schema packages/api/prisma/schema.prisma
node packages/api/node_modules/prisma/build/index.js migrate deploy \
  --schema packages/api/prisma/schema.prisma
node packages/api/dist/release/verify-deployment-database.js migrations
RELEASE_VERSION=vX.Y.Z node packages/api/dist/release/reconcile-authorization.js
node packages/api/dist/release/verify-deployment-database.js registry
```

The hook uses a PostgreSQL advisory transaction lock inside reconciliation. API readiness remains
503 until `permission_registry_state.registry_version` and its digest match the code registry.
Never bypass readiness or manually update the state row. A code rollback retains all four additive
authorization tables and the reconciled rows; it must not run a down migration.

## Security verification

The Epic C test gate covers missing policy declarations, horizontal and vertical escalation, IDOR
role access, cross-organization cache isolation, and all-or-nothing bulk member assignment.
Tenant-owned analytics, training, workspace, submission, discussion, audit, and telemetry queries
include organization predicates. A scoped resource miss returns 404 and records
`authorization.resource_boundary_miss`; a known capability denial returns the standard 403 error
contract.
