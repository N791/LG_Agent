# LG-Agent 开发与内部设计文档 (Developer & Architecture Docs)

欢迎来到 `dev_docs` 目录！此目录主要面向 **LG-Agent 核心研发团队、系统架构师及开源贡献者**。
在这里，您可以找到深入的架构原理、内部 API 设计规范以及本地开发环境的搭建流程。

## 目录索引 (Table of Contents)

### 💻 开发者指南 (Developer Guide)

如何快速将这套庞大的微服务跑起来？

- [本地环境搭建 (Local Setup)](./Developer_Guide/01_Local_Setup.md) - Node/pnpm 安装、Docker Compose 依赖启动、Prisma 初始化及 Turbo 开发服务器运行指南。
- [Monorepo 架构解析 (Monorepo Structure)](./Developer_Guide/02_Monorepo_Structure.md) - 解析 `api`, `web`, `cli`, `contracts` 各个 Package 之间的依赖与边界。

### 🏗️ 架构与设计原理 (Architecture & Design)

- [核心架构图 (System Architecture)](./Architecture/01_System_Architecture.md) - 后端、网关、消息队列的内部组件交互图。
- [数据库设计 (Database Design)](./Architecture/02_Database_Design.md) - Prisma 实体关系图 (ER Diagram) 及核心业务表解析。
- [API 设计规范 (API Guidelines)](./Architecture/03_API_Guidelines.md) - 后端 REST API 设计、DTO 校验规范以及统一错误处理。
- [AI 集成深入剖析 (AI Integration)](./Architecture/04_AI_Integration.md) - 供应商适配器 (Provider Adapter) 设计、Token 审计拦截器与 PII 脱敏规则引擎的实现原理。

### 🧪 测试与质量 (Testing & Quality)

- [质量门禁 (Quality Gate)](./test/11_Quality_Gate.md) - 单元测试、E2E 测试和 CI 流水线的覆盖率要求及实践规范。

### 📅 里程碑 (Milestones)

- [MVP 验收清单 (MVP Sign-Off)](./MVP_Sign_Off.md) - v1.0.0-MVP 的发布门禁验证清单。

---

> **需要部署指南？**
> 如果您是 DevOps 或系统管理员，正在寻找生产环境部署、Kubernetes Helm Charts 或安全加固相关信息，请参阅 [`prod_docs/index.md`](../prod_docs/index.md)。
