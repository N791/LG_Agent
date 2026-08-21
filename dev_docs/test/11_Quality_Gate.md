# 质量门禁与测试策略

质量目标是通过公共 interface 验证行为，并用自动检查守住 module seam。测试文件可与 implementation 共置为 `*.spec.ts(x)`，也可位于 package 的 `test/`、`tests/` 目录；遵循现有 package 配置，不强制单一目录。

## 本地快速门禁

Husky/lint-staged 只对暂存的 TS/TSX 执行 ESLint + Prettier，对 JSON/Markdown/CSS/YAML 执行 Prettier；它不会自动运行完整 typecheck 或 unit test。

提交前至少运行：

```bash
pnpm architecture:check
pnpm design:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

涉及检索或浏览器流程时增加：

```bash
pnpm --filter @lg-agent/api test:retrieval-gate
pnpm --filter @lg-agent/web test:e2e
pnpm --filter @lg-agent/trainee-web test:e2e
```

## PR / main CI

| Gate                | 验证内容                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------- |
| OpenAPI & contracts | 生成物无漂移、无未版本化 breaking change、endpoint map、consumer version、permission registry |
| Database governance | Prisma validate、空库/升级 migration、并发锁、schema drift、查询计划、备份恢复                |
| Helm governance     | lint、三阶段 render、Secret/probe/resource/security context/immutable image policy            |
| Architecture        | deep import、循环 module、controller 跨 domain、contracts 框架依赖、公共入口                  |
| Design              | `Design_docs/Design/01–09` 与 module、endpoint、execution、schema 基线一致                    |
| Build               | ESLint、strict typecheck、Turbo build                                                         |
| Behavior            | Jest/Vitest unit/integration、retrieval regression、Admin/Trainee Playwright                  |

## 测试面

- **Deep module contract**：从公共 interface 测试 WorkspaceSession、Submission、Sandbox、Authorization、LLM/retrieval adapter。
- **Tenant isolation**：同组织成功、跨组织 403/404、平台管理员例外、审计事件。
- **Submission lifecycle**：幂等、状态转换、事件 sequence、restart recovery、lease、retry、cancel、replay、dead letter、terminal hook。
- **SSE**：事件版本、`Last-Event-ID` replay、完成/错误、断线清理。
- **Adapter parity**：两个 adapter 必须通过同一 contract suite；mock 不能替代关键 composition 测试。
- **Migration/recovery**：真实 migration、约束、pgvector、权限 registry、检索表与 fixture 恢复。

## 覆盖率

覆盖率是趋势信号，不是唯一门禁。新/改 implementation 必须覆盖正常、失败、权限、租户和恢复路径。优先测试公共 interface；纯粹为了测试而拆出 shallow module 会降低 locality。

运行：

```bash
pnpm test:cov
```

## Definition of Done

- 行为由 interface test 证明，关键失败路径可重现。
- 没有越过 domain seam 的 deep import。
- DTO/OpenAPI/permission/schema 与 consumer 同步。
- 新 migration 已验证升级、重复执行和恢复。
- 新 adapter 通过共享 contract suite。
- 用户可见或生产行为已同步更新 `prod_docs`；架构/开发行为已同步更新 `dev_docs`、ADR 或 runbook。
