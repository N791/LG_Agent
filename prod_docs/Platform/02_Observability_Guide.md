# 平台可观测性指南

## 日志与审计

API 使用 Pino 结构化日志，并通过 CLS 关联 `traceId`、`correlationId`、`reqId`。业务审计写入 `AuditEvent`；AI request/audit、authorization change 和 Submission event 分别有持久记录。代码仍有少量启动 `console.log`，因此不要宣称完全禁用 console。

日志中不得出现 JWT、数据库凭据、对象存储密钥、原始 Prompt 或未脱敏 PII。

## 指标

已落地的指标族包括：

- HTTP latency / release HTTP request status；
- `ai_token_usage_total`；
- authorization resolution、registry 与 audit failure；
- retrieval route、latency、quality/rollout；
- Sandbox runtime metrics。

部署监控前应从 `/api/v1/telemetry/metrics` 或实际 Prometheus registry 核对 metric 名称和 label，避免 dashboard 依赖文档中的概念名。

## 健康检查

- `GET /api/v1/health`：数据库 ping；当前不检查 Redis、MinIO/S3 或 LLM。
- `GET /api/v1/health/ready`：permission registry version/digest 必须与当前发布一致，否则 503 fail-closed。
- Web：`/healthz`、`/readyz`。

## 发布观察窗

`deploy/monitoring/epic82-alerts.yaml` 提供发布告警基线。Prometheus 需以 job `lg-agent-registry-readiness` 通过 blackbox exporter 探测 readiness。每次发布至少观察 30 分钟，并关联记录：

- API 5xx、403/404 基线偏移；
- Pod restart 与 readiness；
- permission registry/audit failure；
- authorization P95；
- 双 Web 可用性；
- Submission/Sandbox 真实 smoke。

任一 critical 告警或 registry mismatch 触发停止推进或应用回滚。
