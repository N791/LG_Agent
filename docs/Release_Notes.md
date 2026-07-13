# 发布说明 (Release Notes): v1.0.0-MVP

我们非常高兴地宣布 LG-Agent 平台的 v1.0.0-MVP 版本正式发布！
本次发布标志着 28 个史诗任务 (Epics) 的完成，建立了一个强大、企业级的 AI 辅助学习环境。

## 🚀 核心功能 (Key Features)

### 用户与课程管理 (User & Course Management)

- 完整的基于角色访问控制 (RBAC)，支持导师 (Mentors) 和学员 (Trainees)。
- 动态创建课程与任务，支持通过 JSON Schema 验证配置。

### AI 网关与导师 (AI Gateway & Tutor)

- 通过供应商适配器模式 (Provider Adapter pattern) 统一集成 OpenAI、DeepSeek 和 Qwen。
- **AI 导师**: 利用 RAG（检索增强生成）提供上下文感知的协助。
- **安全性**: 结合规则引擎，在任何 LLM API 调用前进行 PII（个人身份信息）和敏感数据脱敏。
- **分析**: 针对所有 AI 交互进行详细的成本追踪和审计日志记录。

### 命令行工具与沙盒 (CLI & Sandbox)

- `@lg-agent/cli` 允许学员拉取工作区代码，运行本地测试，并安全地提交代码。
- 自动化的沙盒引擎 (Sandbox Engine)，能够评估 Node、Python 和 Java 提交的任务。

### 企业平台基础 (Enterprise Platform Foundation)

- **Monorepo**: Turborepo + pnpm workspaces。
- **API 治理**: 集成 OpenAPI/Swagger，生成平台数据契约 (`@lg-agent/contracts`)。
- **DevOps**: 多阶段 Docker 构建、外部化的持久化依赖以及统一的 Helm Chart。
- **可观测性**: Prometheus 指标、Pino 结构化日志以及 Terminus 健康检查。
- **质量**: 采用 Playwright E2E 和 Vitest 单元测试的 GitHub Actions CI。
