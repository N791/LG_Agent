# 平台安全指南

## 凭据与身份

- 所有生产凭据位于外部 Secret；Git、values、日志和前端 bundle 不得出现明文。
- JWT secret 至少 32 字符；access/refresh expiry 与算法由 `AuthConfig` 一次验证后注入。
- 当前支持 login 与 refresh，**没有** Redis JWT blacklist/logout revocation；响应事件时应轮换 Secret、缩短 token 生命周期或按 runbook采取强制措施，不要依赖不存在的黑名单。
- bootstrap admin 只用于初始化或幂等修复同一管理员的系统角色绑定；
  它不会隐式重置密码。生产环境始终标记为必须改密，bootstrap 凭据使用后应轮换并清除。

## Permission RBAC 与租户

授权不是仅靠 `ADMIN/MENTOR/TRAINEE` 枚举。运行时使用 permission registry、自定义 role、role-permission、user-role 与 resource policy；`users.role` 只作兼容桥。

- 前端 route permission 只控制显示，API 的 JWT + PermissionGuard 才是强制 interface。
- Organization 是 tenant seam；repository 查询必须同时约束 actor 的 `organizationId`。
- registry version/digest 不一致时 readiness 503，Pod 不接流量。
- 角色/成员变更必须生成 audit event；跨 Organization 返回 403/404。

## AI 与检索

出站 Prompt 经过关键词、regex、prompt-injection 与 masking 规则。日志只保存 prompt hash 和脱敏 rule hit。检索 source、citation open、trace 与 index 管理均执行 Organization ACL。真实 provider key 仅存在于 API Secret。

## Sandbox

Docker executor 已在代码中强制：

- image digest/allowlist；
- `network=none`、read-only root filesystem；
- drop capabilities、`no-new-privileges`；
- 非 root UID、CPU/memory/PID/time/concurrency 限制；
- Execution Workspace 与 Authoring Workspace 分离。

生产禁止 local executor。启用 Java/Python/Go/Rust 前必须构建、扫描、签名并替换 `.env.example` 中的示例 digest，再按 `docs/architecture/multi-language-sandbox-runbook.md` 灰度。

## 平台侧待落实

当前 Helm chart 未自带 NetworkPolicy、HPA、专用 Sandbox node pool 或 Docker daemon/remote runner。平台必须提供等价网络隔离与 executor 运行条件，并通过渗透、逃逸、资源耗尽和真实执行 smoke 验证。文档中的建议不代表 chart 已创建这些资源。
