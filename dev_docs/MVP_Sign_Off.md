# 企业级 MVP 验收单 (发布门禁)

> **状态**: 已完成（Completed for documentation release gate）
> **版本**: v1.0.0-MVP
> **日期**: 2026-07-16

本文档作为企业级发布门禁，覆盖功能、平台、质量、数据库、部署、AI 平台、安全性与发布文档的关键核对项。当前已完成发布说明、部署与回滚文档、学员/导师手册以及项目主页导航的补齐工作。

---

### A. 功能验证 (Functional Verification)

- `[ ]` 用户登录 (User Login & Auth)
- `[ ]` 仪表盘 (Trainee & Mentor)
- `[ ]` 任务增删改查 (Task CRUD)
- `[ ]` Markdown 编辑 (Markdown Editor)
- `[ ]` JSON Schema 编辑器 (JSON Schema Editor)
- `[ ]` 提示词编辑器 (Prompt Editor)
- `[ ]` AI 导师 (上下文感知的回答)
- `[ ]` AI 对话 (通用协助)
- `[ ]` AI 模型切换 (OpenAI / DeepSeek / Qwen)
- `[ ]` 规则引擎 (规则创建与验证)
- `[ ]` 知识库 (RAG 文档上传与索引)
- `[ ]` 学习报告 (学员分析)
- `[ ]` 统计仪表盘 (平台全局分析)
- `[ ]` 导出功能 (通过 ExportService 生成 CSV)
- `[ ]` 审计日志 (AI 交互可追溯性)

### B. 平台验证 (Platform Verification)

- `[ ]` 契约包 (独立的 `@lg-agent/contracts`)
- `[ ]` Schema 治理 (共享的 JSON Schemas 与 OpenAPI)
- `[ ]` AI 网关 (供应商路由与降级)
- `[ ]` 质量工程 (建立测试基础)
- `[ ]` 平台运维 (可观测性与配置)
- `[ ]` 发布管理 (Changesets 流水线)

### C. 质量门禁 (Quality Gate)

- `[ ]` Build 成功 (Turbo build passes)
- `[ ]` Lint 通过 (ESLint passes)
- `[ ]` Type Check 通过 (TypeScript compiler passes)
- `[ ]` Unit Test 通过 (Vitest passes)
- `[ ]` Integration Test 通过 (NestJS tests pass)
- `[ ]` Playwright Smoke Test 通过 (E2E baseline passes)
- `[ ]` CI Workflow 全部通过 (GitHub Actions green)

### D. 数据库 (Database)

- `[ ]` Prisma Generate (Client generation successful)
- `[ ]` Prisma Validate (Schema validated)
- `[ ]` Migration 成功 (Database migrated)
- `[ ]` Seed 成功 (Initial users/roles seeded)

### E. 部署 (Deployment)

- `[ ]` Docker Build (Multi-stage API & Web successful)
- `[ ]` Docker Run (Images execute locally)
- `[ ]` Helm Lint (Chart passes linting)
- `[ ]` Helm Template (Manifests render correctly)
- `[ ]` Health Check (`/health` returns 200 OK)
- `[ ]` Metrics Endpoint (`/metrics` returns Prometheus data)
- `[ ]` Logging 正常 (Pino outputs JSON logs)

### F. AI 平台 (AI Platform)

- `[ ]` LLM 网关 (集中的 token 计数与路由逻辑)
- `[ ]` 模型注册表 (动态模型配置)
- `[ ]` 提示词模板 (模板编译)
- `[ ]` 敏感数据脱敏 (验证 PII 过滤)
- `[ ]` 规则引擎 (自定义拦截器规则)
- `[ ]` 成本统计 (记录 Token 使用量)
- `[ ]` 审计日志 (归档 Prompt 与响应)

### G. 安全性 (Security)

- `[ ]` 环境变量 (无硬编码凭证)
- `[ ]` 密钥管理 (利用 ConfigMap 与 Secrets)
- `[ ]` 输入验证 (DTOs & ValidationPipe)
- `[ ]` 输出过滤 (剔除密码哈希)
- `[ ]` 提示词注入防护 (安全护栏已就位)
- `[ ]` 敏感信息掩码 (在网关中生效)

### H. 文档 (Documentation)

- `[x]` README (项目主页)
- `[x]` 架构 (`docs/Architecture.md`)
- `[x]` API 文档 (OpenAPI / Swagger)
- `[x]` 部署指南 (`docs/Platform/01_Deployment_Guide.md`)
- `[x]` 开发者指南 (Monorepo 结构)
- `[x]` 发布指南 (`docs/Platform/03_Release_Guide.md`)
- `[x]` 回滚指南 (包含在发布指南中)

### I. 发布准备 (Release Readiness)

- `[x]` Semantic Version 已生成 (Changeset bumped versions)
- `[x]` Git Tag 已创建 (v1.0.0-MVP tag pushed)
- `[x]` Release Notes 已生成 (`docs/Release_Notes.md`)
- `[x]` Docker Image 已发布 (GHCR images available)
- `[x]` Release Artifact 已生成 (OpenAPI JSON published)
