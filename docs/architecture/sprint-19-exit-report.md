# Sprint 19 Exit Report — Browser Audit Remediation

Date: 2026-08-01  
Status: **CODE COMPLETE / STAGING SIGN-OFF PENDING**

## Audit closure matrix

| Audit  | Owner               | Code remediation                                                                                                | Automated evidence                              | Operational evidence                          |
| ------ | ------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| AUD-01 | Backend             | Canonical `starterTemplate`, hash/version/entry, offline Golden fixture, legacy read adapter                    | `sprint19-browser-remediation.contract.spec.ts` | Reconcile preview and browser reopen pending  |
| AUD-02 | Backend / QA        | Node manifest/script preflight; removed `--if-present`; negative Golden tests                                   | Sprint 19 contract test + executor contracts    | Docker image smoke pending                    |
| AUD-03 | Backend             | Node 20 TypeScript fails fast with stable error; JS runs directly                                               | Runtime profile contract                        | Staging Node image smoke pending              |
| AUD-04 | Backend / Frontend  | Canonical JSON Schema `$id`, tested aliases, encoded client path                                                | Sprint 19 contract test + TypeScript            | Task Editor browser replay pending            |
| AUD-05 | Security / Frontend | Tenant-scoped `/organizations/current`; user/course forms no longer enumerate platform organizations            | TypeScript + permission/tenant suites           | ADMIN/PLATFORM_ADMIN browser matrix pending   |
| AUD-06 | AI/Retrieval        | Versioned BUILDING fixtures, rollout remains reversible, Mock rejected outside fixtures, explicit UI error      | Provider contract + retrieval suites            | Production Provider and ACTIVE index required |
| AUD-07 | Backend / Frontend  | Static analytics route precedes `/:id`; trainees use personal data and do not call manage analytics             | Route contract + discussion tests               | Browser console replay pending                |
| AUD-08 | AI / Frontend       | Structured review findings/severity/evidence/suggestions/retrieval state; execution JSON is separately labelled | TypeScript + prompt schema validation           | Non-Mock model review pending                 |

## Automated evidence

Passed locally without downloading dependencies:

```text
contracts/api/admin-web/trainee-web TypeScript: PASS
API Jest: 46 suites, 197 tests PASS
Admin Web Vitest: 2 files, 6 tests PASS
Schema client Vitest: 1 file, 5 tests PASS
Trainee Web Vitest: 4 files, 11 tests PASS
Sprint 19 changed-file ESLint: PASS, 0 warnings
Contracts, API, Admin Web and Trainee Web production builds: PASS
ai_review.json and sandbox/env schemas: valid JSON
```

The repository `pnpm` launcher could not run because its offline version switcher attempted registry signature verification. Local installed TypeScript, ESLint and Jest binaries were used instead. CI must still run the canonical `pnpm lint`, `typecheck`, `build`, `test`, contracts, integration and Playwright gates.

The `agent-browser` CLI is not installed in this workspace. The local dual-web Playwright smoke was attempted with the installed runner but the bounded run timed out after 180 seconds while the Admin Web Chromium test was running; no pass evidence was recorded. Browser/staging sign-off therefore remains open.

The 2026-08-01 follow-up also added canonical Prompt Schema validation in the Task Editor, encoded-path/404 client regression tests, and a stable `RETRIEVAL_INDEX_KIND_INVALID` rejection for activate/retry routes. Docker CLI was present, but the daemon was unavailable and the host Node version was 24, so this evidence does not replace the required Node 20 image smoke.

## Safe workspace reconciliation

Dry-run is the default and prints `affected`, `skipped`, a reason per workspace and old/new hashes:

```bash
pnpm --filter @lg-agent/api workspace:reconcile-starter
```

Apply requires explicit confirmation and a real actor UUID:

```bash
pnpm --filter @lg-agent/api workspace:reconcile-starter -- --confirm --actor-id <uuid>
```

Only exact known `Hello World/index.ts` fingerprints with no submission and no workspace version are eligible. The apply transaction rechecks the hash, creates a recoverable `RECONCILE` version, replaces files, and writes an AuditEvent containing actor, task, workspace, request ID and old/new hashes. Unknown content or any learner history is skipped.

## Staging gate

`GET /api/v1/health/golden-path-ready` returns 200 only when all checks pass:

- Node 20 runtime image configured;
- all four canonical Schema IDs registered;
- Golden starter template/hash is present;
- a READY and active Golden retrieval document version exists;
- selected LLM Provider is non-Mock;
- permission registry is reconciled.

The seed creates idempotent document/code fixtures in `BUILDING`; it does not bypass indexing or activation. Promote through SHADOW, inspect traces/evidence, then activate for the allowlisted acceptance organization.

## Rollback

- Retrieval: set `RETRIEVAL_ROLLOUT_MODE=LEGACY` (or remove the acceptance IDs from allowlists) and restart API pods.
- Runtime: deploy the previous immutable API image; Java/Python/Go/Rust profiles were not changed.
- Workspace reconciliation: restore the automatically created `RECONCILE` workspace version. Never bulk overwrite current files.
- Web/API: roll back the Helm release only; do not down-migrate or restore the database for an application-only rollback.

## Required sign-off

- [ ] Backend: Docker Node 20 Run/Build/Lint/Test and reconciliation preview reviewed
- [ ] Frontend: both browser paths replayed with no Schema 404 or Discussion 500
- [ ] AI/Retrieval: ACTIVE indexed evidence and non-Mock Tutor/Review verified
- [ ] Security: tenant/permission matrix and zero unintended workspace overwrite verified
- [ ] QA: Golden Path, negative path, console and API assertions archived

Sprint 19 is not eligible for production promotion until all five signatures and CI/Playwright evidence are attached.
