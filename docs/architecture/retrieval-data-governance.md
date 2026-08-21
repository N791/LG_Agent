# Retrieval data governance

Epic 74 introduces two immutable citation boundaries:

- Documents are pinned to `DocumentVersion.id`; publishing new content creates a new version.
- Code is pinned to `RepositorySnapshot.id` and its `(organizationId, repositoryId, commitSha)`.

The database rejects updates to a boundary after its status becomes `READY`. Retrieval evidence
stores the pinned boundary id as well as the rendered citation, so later indexing cannot silently
move an existing citation.

## Tenant scope and ACL predicates

Every retrieval query starts with the authenticated `organizationId`; request payload tenant ids
must never override it. All tenant-owned rows carry a direct `organization_id`, even when a parent
also provides a scope path.

| Model                              | Organization scope path                | Required ACL predicate                                                |
| ---------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| KnowledgeSource                    | `KnowledgeSource.organizationId`       | `organization_id = actor.organizationId AND source.acl permits actor` |
| DocumentVersion                    | direct + `source.organizationId`       | direct organization match and authorized source                       |
| DocumentNode / DocumentChunk       | direct + `documentVersion.source`      | direct organization match and authorized version source               |
| RepositorySnapshot                 | `RepositorySnapshot.organizationId`    | organization match and `snapshot.acl` permits actor                   |
| CodeSymbol / CodeRelation          | direct + `repositorySnapshot`          | direct organization match and authorized snapshot                     |
| RetrievalTrace / RetrievalEvidence | direct + authenticated trace           | organization match; evidence boundary must share it                   |
| ConversationSummary                | direct + `conversation.organizationId` | organization, conversation user/mentor policy match                   |

Adapters receive a `RetrievalScopeDTO` and must apply these predicates before ranking or expansion.
Cross-organization ids are reported as `RETRIEVAL_ACCESS_DENIED`, not as usable results.

## Retention

`RetrievalTrace`, `RetrievalEvidence`, and `ConversationSummary` carry explicit `expiresAt` values
and are purgeable in bounded batches. Evidence is deleted with its trace; pinned document versions
and repository snapshots use `RESTRICT` while retained evidence refers to them. Source/snapshot
content lifecycle policy may remove an immutable boundary only after its evidence retention window.

## Rollout and rollback

`RETRIEVAL_ROLLOUT_MODE` supports `LEGACY`, `SHADOW`, and `ACTIVE`.
`RETRIEVAL_ROLLOUT_ORGANIZATIONS` limits shadow/active mode to an organization allowlist; all other
organizations remain on legacy retrieval. Setting the global mode to `LEGACY` is the fast rollback.
Tutor and Prompt code depend only on retrieval ports; adapter selection remains in `AiModule`.
