# 发布说明 (Release Notes): v1.0.0-MVP

LG-Agent v1.0.0-MVP 已正式发布。该版本将企业培训场景中的文档阅读、课堂练习、代码提交、沙盒评测与 AI 辅导串联为一个可运行的闭环，帮助企业快速落地新人上手训练流程。

## 1. 版本目标

本次发布聚焦于以下目标：

- 交付一套可演示的企业级新人培训平台基础能力。
- 将课程、任务、沙盒执行、AI 导师评审与学习分析串在同一平台中。
- 为后续企业 SSO、LDAP、API Governance 与多租户能力提供可扩展基础。

## 2. 本次发布包含的核心能力

### 业务能力

- 完整的组织、用户、角色与课程管理能力。
- 支持任务创建、配置与版本化管理。
- 提供 Web Console 与 Trainee Web Client 两套客户端体验。
- 支持学员通过 CLI 拉取 Workspace、执行本地验证并提交评测。

### AI 能力

- 集成统一的 LLM Gateway 与 Provider Adapter。
- 提供 RAG 知识库检索能力，支持上下文感知问答。
- 支持敏感信息过滤、响应内容审核与 AI 审计日志记录。

### 平台能力

- 提供 Docker 沙盒执行环境，支持编译、测试与代码质量评测。
- 支持学习分析、提交历史、AI Review 与自动化评测报告展示。
- 提供 Prometheus 指标、结构化日志与健康检查能力。

## 3. 关键交付物

- Web 管理后台与学员端 Web IDE。
- NestJS API 服务与 Prisma 数据模型。
- Contracts / Schema Governance 契约包。
- Helm 部署模板与容器化构建能力。
- 发布说明、部署指南、用户手册与 MVP 验收清单。

## 4. 兼容性与环境要求

建议使用以下环境进行部署与验证：

- Node.js 20+
- pnpm 9+
- Docker 24+
- PostgreSQL 16+
- Redis 7+
- MinIO / S3 兼容对象存储

## 5. 快速上手

1. 安装依赖：

   ```bash
   pnpm install
   ```

2. 初始化数据库与 Prisma 客户端：

   ```bash
   pnpm --filter @lg-agent/api exec prisma generate
   pnpm --filter @lg-agent/api exec prisma db push
   ```

3. 启动本地开发环境：

   ```bash
   pnpm run dev
   ```

4. 访问地址：

   - 管理后台: http://localhost:5173
   - API 文档: http://localhost:3000/api/docs

## 6. 已知限制

- 企业级 SSO / LDAP 接入已预留接口，但当前 MVP 版本以基础登录与角色控制为主。
- 生产环境的 Secrets 管理、审计归档与多租户策略需在后续版本持续完善。
- 某些高级配置项仍建议由导师在 Web Console 中完成人工确认。

## 7. 发布与回滚

- 发布流程请参考 [部署指南](./Platform/01_Deployment_Guide.md) 与 [发布管理指南](./Platform/03_Release_Guide.md)。
- 若发现生产环境回退问题，请优先使用 Helm 回滚或回退到上一稳定镜像标签。
