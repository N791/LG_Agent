# Sprint 18 Exit Report

**状态：** READY FOR STAGING ACCEPTANCE  
**验证日期：** 2026-07-29  
**范围：** Epic 80、Epic 81、Epic 82

本报告记录已完成的自动化验收证据。它不是最终 `PASSED` 签字：真实 Kubernetes
环境中的 Helm 回滚演练和四方人工批准仍是发布阻断项。

## Exit Criteria

| Exit criterion                             | 结果         | 证据                                                                                                                                                                                                     |
| ------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 质量、架构、migration 与双前端 E2E         | PASS         | ESLint；API/Web/Trainee/CLI TypeScript；API 44 suites/186 tests；Admin 2 files/6 tests；Trainee 4 files/11 tests；255 个 API 文件的架构检查；Admin 3/3、Trainee 4/4 Playwright                           |
| 两实例即时撤权与成员移除                   | PASS         | 两个独立 API 进程共享数据库；系统角色撤销、高风险权限移除、自定义角色成员移除均在两个实例的下一请求由 200 变为 403，详见 [Authorization Cluster Safety Runbook](authorization-cluster-safety-runbook.md) |
| 旧角色、自定义角色与租户隔离               | PASS         | `sprint18-exit-contract.sql` 验证旧 `MENTOR` 与自定义角色并存，并拒绝跨组织 `user_roles`                                                                                                                 |
| Permission Registry 一致性与只读启动       | PASS         | registry v1/digest 一致；启动路径只校验，写入仅由 reconciliation 命令执行                                                                                                                                |
| migration → API → Admin → Trainee 原子顺序 | PASS（策略） | `check-release-phases.mjs` 对分阶段 Helm render、`--atomic --wait`、超时和 smoke gate 做静态强制检查                                                                                                     |
| 发布前快照恢复与 Epic C 数据完整性         | PASS         | PostgreSQL 16/pgvector 隔离恢复；14 migrations、35 permissions、5 roles、70 role_permissions、1 user_role；Epic 80/81/Sprint 18 SQL contracts 与 migration replay 全部通过                               |
| 上一不可变镜像 Helm rollback               | PENDING      | 需要受保护 staging Kubernetes 环境和已发布的前一版本                                                                                                                                                     |
| Security/Backend/Frontend/Platform 签字    | PENDING      | 由 CODEOWNERS 与 PR checklist 收集真实审批                                                                                                                                                               |

## 质量门禁

- Lint：通过，0 error。
- TypeScript：API、Admin Web、Trainee Web、CLI 全部通过。
- Unit/contract tests：API 44 suites / 186 tests；Admin 2 files / 6 tests；Trainee 4 files / 11 tests。
- Architecture/design：255 个 API 文件与 contracts 通过；design consistency、registry compatibility、additive authorization migration policy 通过。
- E2E：Admin Playwright 3/3；Trainee Playwright 4/4。
- Build：contracts、permission-react、API、CLI、Admin Web、Trainee Web 全部通过。

本机离线环境中的 pnpm 启动器拒绝 registry signature 校验；未绕过安全校验，而是使用
lockfile 对应的已安装二进制完成上述门禁。CI 仍通过 canonical pnpm 命令执行同一套门禁。

## 数据库恢复演练

- 源数据库完成 14 个 migration，并执行 authorization registry reconciliation。
- 恢复夹具保留 legacy `MENTOR`、自定义组织角色及其成员关系。
- `pg_dump -Fc` 快照 SHA-256：
  `13fc109db5bcf89d5c6ef7a4918f36ba4c655e751d863747cdddb543fbb06e59`。
- 快照恢复到独立数据库后，Epic 80、Epic 81 和 Sprint 18 SQL contracts 全部通过。
- 恢复库 migration replay 无待执行 migration；registry reconciliation 与数据库校验通过。

## 最终 staging 门禁

1. 在受保护 staging 环境运行 `staging-release-drill.yml`，保存 migration、双 Pod smoke、
   快照恢复、migration replay 与 `helm rollback` 日志。
2. 确认回滚到前一不可变镜像后，Epic C 授权数据与 registry digest 不变。
3. 将绿色 workflow run 和制品链接附到发布 PR。
4. 收集以下真实审批；未全部批准前不得把本报告状态改为 `PASSED`。

## Sign-off

| 职能     | 审批者                | 状态    |
| -------- | --------------------- | ------- |
| Security | `@lg-agent-core-team` | PENDING |
| Backend  | `@backend-team`       | PENDING |
| Frontend | `@frontend-team`      | PENDING |
| Platform | `@devops-team`        | PENDING |
