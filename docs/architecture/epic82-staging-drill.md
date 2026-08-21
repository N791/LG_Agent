# Epic 82 staging release drill

The repeatable drill is `.github/workflows/staging-release-drill.yml`. Run it from GitHub Actions
against the protected `staging` environment after the release workflow has attached
`release-evidence.zip`.

## Preconditions

1. Staging has at least two API replicas and a pre-provisioned `lg-agent-api-runtime` Secret.
2. A PostgreSQL restore into an isolated instance has passed the checks in
   `prod_docs/Platform/05_Backup_Restore.md`; its record ID is supplied to the workflow.
3. Dedicated smoke users, a custom role with a unique permission, and a foreign-organization
   resource path are configured in staging environment variables/secrets.
4. `rollbackRevision` identifies the last known-good immutable Helm revision.

## Automated sequence

The workflow verifies all three Cosign signatures, deploys in migration → registry → API → Admin
Web → Trainee Web order, runs the multi-Pod revocation smoke, replays the entire transaction to
prove idempotency, then executes `helm rollback` and repeats smoke.

The always-run evidence step archives for 90 days:

- Helm history;
- Pod/Deployment/Service snapshot;
- migration/reconciliation Job log;
- Admin and Trainee screenshots;
- release, image tag, backup drill ID and rollback revision.

An Epic 82 drill is accepted only when the workflow is green and its artifact is linked from the
release record. A failed workflow is evidence of a failed drill, not an exception to the gate.
