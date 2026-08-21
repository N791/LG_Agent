# API 设计规范

## 路由与协议

- 业务路由使用全局前缀 `/api/v1`，Swagger UI 为 `/api/docs`。
- Controller 使用复数资源名；操作型端点只用于明确命令，如 `submissions/:id/cancel`。
- 普通 JSON 使用 HTTP 状态码并由全局 interceptor 统一为 `{ code, message, data }`。
- 错误由全局 filter 统一为 `{ code, message, details?, traceId? }`。
- SSE 不套普通 envelope，事件使用版本化 DTO；Submission 日志支持 `Last-Event-ID` replay。

## 契约 source of truth

共享 DTO、枚举、permission 常量和 SSE 类型位于 `@lg-agent/contracts`。`packages/contracts/schemas/openapi.json` 从 Nest Controller 生成，是 payload 的机器可读基线。禁止前端复制后端 DTO，也禁止在 contracts 中引入 Nest/Prisma implementation。

生成与检查：

```bash
pnpm --filter @lg-agent/contracts build
pnpm --filter @lg-agent/api openapi:generate
node packages/api/scripts/check-openapi-breaking.mjs <base.json> <candidate.json>
node packages/api/scripts/check-endpoint-map.mjs \
  "Design_docs/Design/08_8._核心_API_设计（Core_API_Design）.md" \
  packages/contracts/schemas/openapi.json
```

CI 会拒绝 stale OpenAPI、breaking change、endpoint map 漂移、consumer version 漂移和 permission registry 漂移。

## 输入、身份与租户

- 全局 `I18nValidationPipe` 启用 `whitelist` 与 `transform`；请求 DTO 必须声明验证规则。
- 全局 JWT guard 默认保护所有路由；公开端点必须显式 `@Public()`。
- Controller 使用 `@RequirePermission` 或 `@RequireAnyPermission`；不要依据前端隐藏状态授权。
- 组织级调用必须把 authenticated tenant actor 传入 owning domain 的 interface，由 repository 同时约束 `organizationId`。
- 跨组织资源对非平台管理员返回 403 或 404，避免存在性泄漏。

## Module interface

跨 domain import 只能来自该 domain 的 `index.ts`。Controller 调用本 domain 的公共 interface；不得 deep import 另一个 domain 的 repository、strategy、provider 或 adapter。新 module 需要说明公共 interface、private implementation、adapter 绑定、tenant scope 和 contract-test seam。

## 变更清单

1. 更新 contracts DTO/permission/schema。
2. 更新 Controller 装饰器与 OpenAPI。
3. 增加 interface/contract test；SSE 同时测试 replay 与终止事件。
4. 运行 `pnpm architecture:check`、`pnpm design:check`、OpenAPI 检查和相关测试。
5. breaking change 必须版本化并附迁移说明。
