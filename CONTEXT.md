# LG Agent Domain Context

This file is the canonical vocabulary for module names, interfaces, tests, and architecture decisions.

| Term                | Meaning                                                                                                                                                                                          | Owner / source of truth                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Organization        | Tenant boundary that owns users, courses, tasks, submissions, configuration, and audit data. Every organization-scoped operation carries an authenticated tenant actor.                          | `organizations` domain and tenant security infrastructure |
| Course              | An organization-owned learning program containing ordered training tasks.                                                                                                                        | `courses` domain                                          |
| Task                | An authored unit of work, including instructions, files, environment requirements, and evaluation rules. It is not an execution attempt.                                                         | `tasks` domain                                            |
| Authoring Workspace | Durable editable workspace for one user and task: baseline, files, metadata, and versions.                                                                                                       | API `workspace` domain                                    |
| WorkspaceSession    | Client-side session model reconciling remote baseline, local draft, dirty files, offline snapshot, versions, active file, and execution state. UI consumers use its commands and selectors only. | `packages/trainee-web/src/modules/workspace-session`      |
| Execution Workspace | Ephemeral, isolated filesystem materialized from an Authoring Workspace for a single sandbox execution. It is destroyed after execution.                                                         | API `sandbox` domain                                      |
| Sandbox             | Execution boundary that selects an executor adapter and emits a common execution-event lifecycle. It never owns authoring state.                                                                 | API `sandbox` domain                                      |
| Submission          | The single durable record and lifecycle for a user's assessed task attempt, including state transitions, event log, cancellation, replay, score, and terminal hooks.                             | API `submissions` domain                                  |
| AuthConfig          | Validated immutable JWT signing interface (secret, algorithm, and expiry policy). Consumers inject its token rather than reading environment variables.                                          | API `auth` domain                                         |
| Adapter             | Replaceable implementation selected by a Nest module composition root and consumed through a token/interface. Business services do not instantiate it.                                           | Owning domain module                                      |

Public imports enter API domains through each domain's `index.ts`. Files under `internal`,
`repository`, `strategy`, `provider`, or `adapter` paths are implementation details and are not
cross-domain APIs.
