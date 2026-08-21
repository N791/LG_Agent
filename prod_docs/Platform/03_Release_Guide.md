# 发布与回滚

## 版本与镜像

功能变更通过 `pnpm changeset` 记录。Release PR 合并后创建 `vX.Y.Z` GitHub Release；`.github/workflows/release.yml` 为 API、Admin Web、Trainee Web 同时生成版本标签和 `sha-<40 hex>` 标签，不发布 `latest`。

`release-evidence.zip` 包含三镜像 digest、漏洞扫描结果、migration 清单和版本变更。SBOM/provenance 保存为 registry attestation，镜像 digest 使用 Cosign keyless signing。

## 生产门禁

```text
CI（contract/database/Helm/architecture/design/test/E2E）
→ 已成功的隔离恢复演练
→ 构建、扫描、签名
→ migration
→ permission registry reconcile
→ API readiness
→ Admin Web
→ Trainee Web
→ production smoke
→ 30 分钟观察窗
```

Migration Job 使用目标 API 镜像和同一 `DATABASE_URL`，执行 migration status/deploy、权限表校验、registry reconcile 与 digest 校验。任一步失败时 Helm 原子事务不推进。

脚本和 CI 证明流程可执行，但不替代具体环境的演练记录。新集群首次发布、跨版本升级、应用回滚与数据库恢复必须分别保存实际证据。

## Production smoke

`deploy/scripts/production-smoke.mjs` 检查：

- API/permission registry readiness 与两个 Web；
- 管理员/目标用户登录和 `/me/permissions`；
- 角色分配、撤权及 8 次负载均衡读取；
- 跨 Organization 403/404；
- authorization audit event。

还应由环境 runbook 追加 Submission、SSE 与 Docker Sandbox smoke；仓库脚本当前未覆盖这一段。

## 应用回滚

选择已验证的上一 Helm revision：

```bash
helm history lg-agent -n lg-agent-prod
export ROLLBACK_REVISION=17
export NAMESPACE=lg-agent-prod
bash deploy/scripts/rollback-release.sh
```

脚本只回滚应用镜像并重新运行 production smoke，不执行 down migration、不删除权限表、不恢复数据库。migration 必须保持前向兼容。

只有确认数据损坏、应用回滚无效，并获得 Incident Commander 与数据库负责人批准，才允许从快照/PITR 恢复到**新实例**。记录 RPO、RTO、校验结果、批准人和回切方案。

## Sprint 19 Golden Path gate

发布前先以 dry-run 执行 `workspace:reconcile-starter` 并保存 JSON 结果；任何 `unknown-or-user-modified-content` 均不得自动覆盖。经 Security/Backend 审核后，才可携带 `--confirm --actor-id <uuid>` 执行。脚本会在同一事务中创建恢复版本与 AuditEvent。

Staging 必须调用 `/api/v1/health/golden-path-ready`，并验证 Node 20、四个 Schema `$id`、Golden Template hash、Retrieval active version、非 Mock Provider 与 Permission Registry。Retrieval 按 `LEGACY → SHADOW → ACTIVE` 推进，失败时只需回到 `LEGACY`；Workspace 回滚使用自动创建的 `RECONCILE` 版本；Runtime 回滚使用上一不可变 API 镜像。详细证据与签署见 `docs/architecture/sprint-19-exit-report.md`。
