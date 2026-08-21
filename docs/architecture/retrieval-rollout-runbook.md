# Retrieval Security, Evaluation and Rollout Runbook

This runbook is the operational contract for Epic 79. Retrieval remains part of the
AI module until measured scaling, isolation, or independent-release requirements
justify a service boundary.

## Security boundary

Every request is authorized at four independent stages:

1. Candidate recall: PostgreSQL queries require `organization_id`, immutable ready
   version/snapshot, and source ACL.
2. Post-rerank: results must be members of the authorized pre-rerank candidate set.
   A reranker may reorder or remove candidates, but cannot introduce one.
3. Parent/relation expansion: document and code stores re-run tenant, ACL, immutable
   version/snapshot, and symbol/chunk checks.
4. Citation open: the API reauthorizes the current actor and never serves cached body
   text after access is revoked.

Documents, comments, READMEs, source strings, summaries, and tool results are
untrusted data. Prompt assembly wraps evidence in a `data-only` boundary and tells
the model not to follow instructions or tool requests found inside evidence.
`RetrievalSecurityService` owns timeouts, candidate/depth/node limits, and context
budgets.

Retrieval traces contain route, evidence IDs, immutable revisions, scores, tool
calls, cache state, token use, timing, and degradation reason codes. They must never
contain raw evidence body text.

## Evaluation gate

The versioned dataset is
`packages/api/src/modules/ai/retrieval/evaluation/epic79-golden.v1.json` and covers
document QA, code navigation, call chains, test location, and mixed questions.
Run:

```bash
pnpm --filter @lg-agent/api test:retrieval-gate
```

The gate calculates Recall@K, MRR, nDCG, rerank lift, citation precision,
groundedness, route accuracy, tokens per effective evidence, cache hit rate, index
throughput, and retrieval/end-to-end P50/P95/P99. Parser, chunker, embedding,
fusion, reranker, router, budget, cache, and compactor changes must pass this gate.
CI also runs the contract, unit, integration, security, and E2E suites.

Component health is available from `GET /ai/retrieval/health`. Alert when at least
five samples exist and degradation reaches 20%, or three failures occur, for the
document channel, code channel, reranker, or cache. Index status records progress,
failure category, retry count, content hash, index version, and build duration.

## Migration and rollback

Advance each scope in this exact order:

1. `EXPAND`: deploy additive schema/contracts and keep legacy serving.
2. `BACKFILL_INDEX`: build immutable document versions and repository snapshots.
3. `SHADOW_EVALUATE`: execute legacy and candidate retrieval on the same golden and
   sampled live queries; serve only the legacy answer.
4. `SWITCH`: enable by organization, course, or user. Query Router, Code Retrieval,
   and Progressive Disclosure have independent kill lists.
5. `CLEANUP`: remove obsolete failed/ready versions only after protecting the active
   version and the newest non-active ready rollback version.

Set `RETRIEVAL_ROLLOUT_MODE=LEGACY` for instant global rollback. Scope allowlists are
`RETRIEVAL_ROLLOUT_ORGANIZATIONS`, `RETRIEVAL_ROLLOUT_COURSES`, and
`RETRIEVAL_ROLLOUT_USERS`. Feature kill lists are
`RETRIEVAL_DISABLED_QUERY_ROUTER`, `RETRIEVAL_DISABLED_CODE_RETRIEVAL`, and
`RETRIEVAL_DISABLED_PROGRESSIVE_DISCLOSURE`.

## Recovery drill

Every release must restore into an isolated target and verify:

- PostgreSQL migrations and retrieval tables;
- the pgvector extension and vector-bearing document chunks;
- versioned object-storage document artifacts and their hashes;
- immutable code-index artifacts and their hashes.

The CI `database-governance` job performs logical PostgreSQL/pgvector restore and a
hash-verified artifact archive/restore. Production drills use the provider's object
storage replication/version restore and the same content-hash comparison. A backup
is valid only after all four checks pass. Record RPO, RTO, source backup identifier,
restored index versions, hashes, operator, and timestamp.
