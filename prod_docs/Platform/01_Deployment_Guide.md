# 平台部署指南

## 发布产物

同一 Git SHA 构建三个镜像：`lg-agent-api`、`lg-agent-web`、`lg-agent-trainee-web`。只允许 `vX.Y.Z` 或 `sha-<40 hex>` 不可变标签。Release workflow 生成 SBOM/provenance、Trivy 扫描、digest，并用 Cosign keyless signing。

Helm chart：`deploy/helm/lg-agent`。它不部署 PostgreSQL、Redis、对象存储或 Secret。

## 外部依赖与 Secret

发布前由平台或 External Secrets 创建 `lg-agent-api-runtime`，至少包含：

```text
DATABASE_URL
JWT_SECRET
REDIS_URL
MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
OPENAI_API_KEY
SANDBOX_IMAGE_PULL_SECRET
```

`JWT_SECRET` 至少 32 字符且不能使用默认值。镜像拉取凭据使用 `lg-agent-registry`。Migration hook 会验证 Secret 契约、生产 LLM provider 与 Docker Sandbox 配置；注意：Secret 存在只代表部署契约完整，不代表 Redis/对象存储已有业务 adapter。

## 首次数据库初始化

从源码进行本地或单机部署时，先确保 PostgreSQL 已就绪且仓库根目录
`.env` 中的 `DATABASE_URL` 可连接，再执行：

```bash
pnpm db:init
```

该命令会校验 Prisma Schema、生成 Client、执行 `prisma migrate deploy`、
对齐权限注册表与系统角色，并确认 migration 状态；它幂等且不会导入演示账号。不要用
`prisma db push` 代替受版本控制的 migration。

生产 Helm 部署不需要、也不应在运维机上额外执行 `pnpm db:init`。
`pre-install` / `pre-upgrade` migration hook 使用与 API 相同的镜像和 Secret
自动完成迁移，失败时会阻止 Helm 事务继续。

## 三阶段原子发布

生产使用脚本，不直接执行裸 `helm upgrade`：

```bash
export RELEASE_VERSION=v1.4.0
export IMAGE_TAG=v1.4.0
export BACKUP_VERIFICATION_ID=restore-drill-2026-07-29
export IMAGE_DIGESTS_FILE=/secure/evidence/image-digests.txt
export API_PUBLIC_URL=https://api.example.com
bash deploy/scripts/release-transaction.sh
```

顺序固定：

1. 校验恢复演练记录和三镜像 digest。
2. `helm upgrade --atomic --wait` 运行 migration + permission registry reconcile，再滚动 API。
3. 等 API readiness 通过。
4. 滚动 Admin Web。
5. 滚动 Trainee Web。
6. 运行生产授权 smoke。

API rollout 使用 `maxUnavailable: 0`；升级时旧 Web 在 API 阶段继续运行。全新环境中 Web 等 API 完成后创建。

## 探针与策略校验

- API：`/api/v1/health`、`/api/v1/health/ready`
- Web：`/healthz`、`/readyz`

```bash
helm lint deploy/helm/lg-agent -f deploy/helm/lg-agent/values.production.yaml
helm template lg-agent deploy/helm/lg-agent \
  -f deploy/helm/lg-agent/values.production.yaml > rendered.yaml
node deploy/scripts/check-helm-policy.mjs \
  rendered.yaml deploy/helm/lg-agent/values.production.yaml
```

三个 Deployment 均配置 requests/limits、非 root、禁止提权、drop capabilities 与禁用 ServiceAccount token。当前缺口：chart 不提供 HPA、NetworkPolicy，也未提供 Docker daemon/remote executor；平台团队必须在上线前补齐或记录等价控制，并执行真实 Sandbox smoke。
