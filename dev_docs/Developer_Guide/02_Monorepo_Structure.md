# Monorepo 结构

```text
LG_Agent/
├─ packages/
│  ├─ api/              NestJS 模块化单体、Prisma 与发布校验
│  ├─ contracts/        共享 DTO、permission、JSON Schema、OpenAPI
│  ├─ permission-react/ React permission interface
│  ├─ web/              Admin Web
│  ├─ trainee-web/      学员端与 WorkspaceSession
│  └─ cli/              兼容 CLI（已废弃）
├─ deploy/              Helm、发布/回滚/smoke、runtime images
├─ docs/                ADR、runbook、exit report
├─ Design_docs/         产品/设计基线（01–09 受 CI 检查）
├─ dev_docs/            开发与架构说明
└─ prod_docs/           用户与生产运维说明
```

## Package 职责

| Package                      | 职责                                 | 依赖规则                                      |
| ---------------------------- | ------------------------------------ | --------------------------------------------- |
| `@lg-agent/contracts`        | DTO、permission、schema、OpenAPI     | 不依赖 Nest、Prisma 或 UI                     |
| `@lg-agent/api`              | domain module 与 adapter composition | 跨 domain 只从 `index.ts` import              |
| `@lg-agent/permission-react` | permission-aware React interface     | 只依赖 contracts/React                        |
| `@lg-agent/web`              | 平台管理界面                         | 通过 HTTP contracts 调 API                    |
| `@lg-agent/trainee-web`      | 学习与 Authoring Workspace 界面      | Workspace 页面只用 session commands/selectors |
| `@lg-agent/cli`              | 旧工作流兼容                         | 不再作为推荐入口                              |

## API module 规则

每个 domain 拥有 controller、application interface 与 implementation。Nest module 是 composition root；repository、strategy、provider 和 adapter 默认 private。公共 import 进入 `index.ts`。当前核心 deep module 是 Workspace、Submission、Sandbox、AI Retrieval 与 Authorization。

删除一个 shallow module 若只会把同样复杂度搬到调用者，就不应创建它。真实 seam 需要至少两个 adapter 或明确的替换/故障隔离需求；例如 Sandbox 有 Docker/local executor，Submission 有 database/in-process execution adapter，LLM 有多个 provider。

## 前端 locality

`packages/trainee-web/src/modules/workspace-session` 将远端 baseline、本地 draft、dirty file、离线快照、版本和执行状态集中在一个深 module。页面与面板不得再次复制这些状态机。Admin/Trainee route 的 `handle.permission` 仅控制体验，真正授权仍由 API guard 强制。

## 自动约束

- `pnpm architecture:check`：deep import、循环 Nest module、controller 跨 domain 调用、contracts 框架依赖和公共入口。
- `pnpm design:check`：Design_docs 01–09 与代码基线。
- OpenAPI/endpoint/version/registry scripts：契约与 permission 一致性。
- ESLint、TypeScript strict、Jest/Vitest、Playwright：实现与行为。
