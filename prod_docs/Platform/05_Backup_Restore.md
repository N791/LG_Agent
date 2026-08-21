# 数据备份与恢复

## PostgreSQL

PostgreSQL 是主要 durable source，必须覆盖：

- Organization/User/Course/Task；
- Authoring Workspace 文件与版本；
- Submission、ExecutionEvent、租约与日志；
- permission registry、role、audit；
- conversation、AI audit、文档/代码检索索引与 trace。

建议至少保留 7 个日备、4 个周备、12 个月备；需要分钟级 RPO 时启用 base backup + WAL/PITR。具体保留必须匹配法规、数据生命周期与成本政策。

### 隔离恢复演练

```bash
pg_dump -Fc "$DATABASE_URL" -f lg-agent.dump
createdb lg_agent_restore_drill
pg_restore --exit-on-error -d lg_agent_restore_drill lg-agent.dump
psql -d lg_agent_restore_drill -c 'SELECT count(*) FROM _prisma_migrations'
```

恢复到新实例后验证：

- `_prisma_migrations` 与关键 Submission 约束；
- pgvector extension；
- permission registry/role/member 的 Organization 一致性；
- document/code retrieval 表与抽样 evidence；
- Workspace、Submission、AuditEvent 抽样记录。

CI 会做逻辑备份/恢复和检索 artifact checksum，但这不是生产恢复演练。生产至少每季度演练，记录备份点、实际 RPO、从恢复到 smoke 通过的 RTO、校验结果与负责人。发布必须引用最近成功记录 `BACKUP_VERIFICATION_ID`。

## 对象存储

MinIO/S3 是部署 Secret 契约和未来归档/对象 adapter 的位置，但当前核心 Workspace、Submission 与检索元数据主要在 PostgreSQL；不要假定“备份 bucket 即完成平台备份”。

若环境启用了对象存储 adapter，应开启 versioning/immutable retention，并备份 bucket policy、object version、checksum 和数据库引用。恢复顺序是对象到新 bucket → checksum → 数据库到新实例 → 引用一致性 → smoke。

## Redis

Redis 当前不是 session、JWT blacklist 或业务 durable source。可按平台缓存策略备份，但灾难恢复应允许清空/重建，不能用 Redis 备份替代 PostgreSQL 恢复。

## 故障恢复原则

常规应用回滚不恢复数据库，也不执行 destructive down migration。仅在确认数据损坏并双人批准后切换至新恢复实例；禁止覆盖原实例。保存 DNS/Secret 切换、回切方案和审计记录。

## Starter Workspace 对账恢复

Sprint 19 的 Starter Workspace 对账只允许精确占位指纹。执行前保存 dry-run JSON；执行时系统为每个目标 Workspace 创建 `trigger=RECONCILE` 的旧文件快照并写入旧/新 hash 审计。若需撤回，按精确 workspace/version 恢复该快照，不删除 Submission、Discussion 或其他 WorkspaceVersion，也不得通过数据库批量写入覆盖未知内容。
