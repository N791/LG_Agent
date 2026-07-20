# LG Agent — AI 沉浸式企业入职引擎

> **"化被动阅读为主动实战"** — 将企业静态技术文档升级为可运行、可验证的 AI 沉浸式入职闯关引擎。

---

## 🎯 项目简介

LG Agent 是一个面向企业的 AI 驱动新人培训平台。通过自动化环境装配、六阶段闯关训练流程、沙盒代码执行与 AI 导师评审，将新人业务上手周期缩短 50%，资深工程师带教内耗降低 80%。

目前 **v1.0.0** 已经正式发布！我们完成了涵盖底层基础设施、认证、课程管理、集成 Monaco Editor 的 Trainee Web 工作区、沙盒代码执行引擎、AI 导师实时指导、和 DevOps 观测监控等核心 Epic 的建设。

---

## 🏗️ 核心架构与文档

我们采用 Cloud-Native 企业级架构设计，所有服务与功能解耦，遵循 **Contract-First** API 治理规范。

📚 **核心文档导航**：

- [部署与使用文档 (prod_docs/)](prod_docs/index.md) - 面向运维与终端用户。
- [开发与内部设计文档 (dev_docs/)](dev_docs/index.md) - 面向核心研发与架构师。

- [Release Notes (v1.0.0)](prod_docs/Release_Notes.md)
- [发布门禁验收清单 (MVP Sign-Off)](dev_docs/MVP_Sign_Off.md)
- [产品发布文档总览](prod_docs/index.md)

👩‍💻 **用户手册**：

- [学员使用手册 (Trainee Manual)](prod_docs/User/Trainee_Manual.md)
- [导师使用手册 (Mentor Manual)](prod_docs/User/Mentor_Manual.md)

⚙️ **平台运维 (DevOps)**：

- [高可用系统拓扑 (System Topology)](prod_docs/System_Topology.md)
- [部署指南 (Deployment Guide)](prod_docs/Platform/01_Deployment_Guide.md)
- [安全生产指南 (Security Guide)](prod_docs/Platform/04_Security_Guide.md)

💻 **开发与架构 (Development)**：

- [本地搭建指南 (Local Setup)](dev_docs/Developer_Guide/01_Local_Setup.md)
- [系统核心架构 (System Architecture)](dev_docs/Architecture/01_System_Architecture.md)
- [数据库 ER 设计 (Database Design)](dev_docs/Architecture/02_Database_Design.md)

---

## 💻 技术栈 (Tech Stack)

| 核心层级       | 技术选型                                                         |
| -------------- | ---------------------------------------------------------------- |
| **Monorepo**   | Turborepo, pnpm workspace, Changesets                            |
| **后端 API**   | NestJS, Prisma, PostgreSQL, `@nestjs/swagger`                    |
| **前端 Web**   | React 18, Vite, Ant Design, Monaco Editor, xterm.js              |
| **CLI 工具**   | Node.js, TypeScript, Commander.js _(已废弃, 请使用 Web 工作区)_  |
| **AI 引擎**    | OpenAI / DeepSeek / Qwen 适配, Sensitive Filter Rule Engine      |
| **沙盒执行**   | 自动化 Docker Runner                                             |
| **缓存与存储** | Redis, MinIO (S3 Compatible)                                     |
| **部署观测**   | Helm Charts, Multi-stage Dockerfiles, Pino, Prometheus, Terminus |
| **质量工程**   | Vitest, Playwright, Strict ESLint                                |

---

## 🚀 快速开始 (Quick Start)

### 1. 前置环境

- Node.js ≥ 20.0.0
- pnpm ≥ 9.0.0
- Docker & Docker Compose
- PostgreSQL 16+, Redis 7+, MinIO

### 2. 依赖安装与配置

```bash
# 安装 Monorepo 依赖
pnpm install

# 配置环境变量 (根据自身环境修改)
cp .env.example .env
```

### 3. 本地构建与启动

```bash
# 生成 Prisma 客户端并初始化数据表
pnpm --filter @lg-agent/api exec prisma generate
pnpm --filter @lg-agent/api exec prisma db push

# 启动全部服务 (API + Web)
pnpm run dev
```

- **Web 管理后台**: `http://localhost:5173`
- **API 接口文档 (Swagger)**: `http://localhost:3000/api/docs`

---

## 🛠️ 质量与工程规范 (Quality Engineering)

- **版本发布**: 借助 [Changesets](https://github.com/changesets/changesets) 完成语义化版本 (SemVer) 发布。
- **CI/CD**: 通过 GitHub Actions 自动化执行 Build, Lint, Typecheck, Test，以及 Registry-Agnostic 的镜像推送和发布。
- **API 治理**: 基于 Swagger 实现 OpenAPI 自动生成，确立 `@lg-agent/contracts` 作为单点契约。
- **代码提交**: 强制 Conventional Commits 规范，Husky 拦截钩子。

## 📄 许可证 (License)

本项目采用 [Apache License 2.0 with Commons Clause](LICENSE) 协议发布。

您可以免费下载、修改并在企业内部使用本作构建。但**严禁将本软件或其衍生品用于商业出售、转售，或将其包装为付费服务（SaaS）提供给第三方**。

更多详细条款与定义，请参阅完整的 [LICENSE](LICENSE) 文件。
