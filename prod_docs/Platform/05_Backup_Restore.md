# 数据备份与恢复 (Backup & Restore)

为了保障业务的连续性，平台管理员必须配置可靠的数据备份策略。LG-Agent 的核心状态保存在 PostgreSQL 和 MinIO（对象存储）中。

## 1. PostgreSQL 备份策略

核心业务数据（用户、组织架构、任务、学习报告及 AI 交互日志）均存储在 PostgreSQL 中。

### 备份方案

由于 LG-Agent 依赖云原生基础设施，建议利用云提供商的托管服务能力：

- **RDS 自动备份**: 开启自动增量备份与全量快照，保留周期建议至少 30 天。
- **冷备份 (自行管理)**: 如果在自建 Kubernetes 中运行 PostgreSQL，推荐使用 **pgBackRest** 或 **Velero** 等工具将数据库快照导出到冷存储 S3 中。

### 数据恢复 (Disaster Recovery)

在遇到误删数据或硬件故障时：

1. 从快照中恢复出新的 RDS 实例。
2. 更新 Kubernetes 集群中存放 `DATABASE_URL` 的 Secret。
3. 重启所有的 `@lg-agent/api` Pods 以使新的数据库连接生效。

## 2. MinIO (S3) 备份策略

MinIO 中存储了大型的非结构化数据，例如导师上传的课程知识库文件 (RAG PDF/Markdown)、学员提交的代码快照，以及可能的日志归档。

### 备份方案

- **异地灾备同步**: 使用 MinIO 的多站点复制 (Multi-Site Replication) 功能，或者利用 `mc mirror` 命令每天定时将主集群的桶 (Buckets) 镜像到廉价的冰川存储 (Glacier) 或另一个可用区的对象存储中。
- **版本控制 (Versioning)**: 建议在存放 RAG 知识库的 Bucket 上开启版本控制，防止导师误覆盖文件。

## 3. Redis 说明

- Redis 仅用于短期的缓存（如会话状态、速率限制计数器、JWT 黑名单）。
- **不需要备份**: 平台被设计为可以容忍 Redis 数据的丢失。如果 Redis 重启或清空，影响仅限于所有的登录会话失效（要求用户重新登录），不会造成永久性数据损坏。
