# Multi-language sandbox runbook

Epic B keeps submission orchestration language-neutral. A task selects a runtime with
`envConfig.runtime`; the registry resolves that request to a structured command and a
digest-pinned image. Adding a language means registering one profile and one image mapping.

## Runtime governance

| Language | Runtime     | Supported version | Dependency cache |
| -------- | ----------- | ----------------- | ---------------- |
| Node.js  | node        | 20                | npm              |
| Java     | JDK         | 21                | Maven (`.m2`)    |
| Python   | CPython     | 3.12              | pip/uv cache     |
| Go       | Go          | 1.24              | module cache     |
| Rust     | rustc/Cargo | 1.84              | Cargo registry   |

Images must be on `SANDBOX_IMAGE_ALLOWLIST` and pinned with `@sha256`. Production image
promotion requires a vulnerability scan with no unaccepted critical findings and an attached
SPDX or CycloneDX SBOM. Retain the previous digest until the new digest passes the golden tasks.

Cache volume names include organization identity and language. Lockfiles are part of the
dependency install/build cache key used by the image toolchain; execution workspaces are never
stored in the cache. Do not place credentials or private build output in cache targets.

All containers run non-root with a read-only root filesystem, dropped capabilities, no network,
bounded CPU/memory/PIDs, `no-new-privileges`, and an ephemeral `/tmp`.

## Rollout and rollback

`SANDBOX_ENABLED_LANGUAGES` is the per-language rollout switch. Enable one language at a time,
run its build/lint/test/run golden task and a failing task, then observe queue latency, image pull
latency, execution duration, cache hit rate, timeout/OOM count, and error code distribution.

Rollback by removing only the affected language from `SANDBOX_ENABLED_LANGUAGES` and restoring
its previous digest. Other profiles remain registered and continue serving submissions. Never
change the Submission state machine during a runtime rollback.

## Template import

Git imports accept HTTPS repositories on `TEMPLATE_GIT_ALLOWED_HOSTS` and require a full commit
SHA or `refs/tags/<tag>`. Imports reject embedded credentials, branches, submodule material,
symlinks, binary files, excess file counts, and excess bytes. Credential helper variables live
only in the clone process environment. The importer deletes its checkout and returns a
commit-pinned file manifest plus a deterministic content digest to `WorkspaceInitializer`.
