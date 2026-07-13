# 平台可观测性指南

## 1. 结构化日志 (Structured Logging / Pino)

`lg-agent` 后端完全禁用了标准的 `console.log`，转而使用 `nestjs-pino` 记录日志。

- **JSON 格式**: 在生产环境中，所有日志都以 JSON 对象的形式输出。
- **Pretty Print**: 在开发环境中，自动启用 `pino-pretty` 以提高可读性。
- **请求追踪**: 每一个 HTTP 请求都会自动附加一个唯一的 `req.id` 记录在日志中，以便追踪整个请求的生命周期。

## 2. Prometheus 指标 (Metrics)

我们使用 `@willsoto/nestjs-prometheus` 暴露了一个标准的 `/metrics` 接口供 Prometheus 抓取数据。

### 现有指标

- **HTTP 指标**: 自动处理 (例如: `http_request_duration_seconds`)。
- **AI Token 使用量**: 自定义计数器 `ai_token_usage_total`，按 `provider` (供应商) 和 `model` (模型) 进行分组，追踪 Token 消耗量。

所有自定义指标的注册与管理仅在 `MonitoringModule` 内部进行。Controller 绝不能直接实例化或操作 Prometheus 计数器，它们必须统一调用 `MonitoringService`。

## 3. 健康检查 (Health Checks / Terminus)

应用向 Kubernetes 暴露了一个 `/health` 接口。

- **存活探针 (Liveness Probe)**: 确认 Node 进程正在运行且未发生死锁。
- **就绪探针 (Readiness Probe)**: 确认数据库连接正常 (通过 Prisma Health Indicator 检测)，在 Kubernetes 将流量路由到该 Pod 之前生效。
