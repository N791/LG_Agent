# LG Agent — AI 沉浸式企业入职引擎

> **"化被动阅读为主动实战"** — 将企业静态技术文档升级为可运行、可验证的 AI 沉浸式入职闯关引擎。

---

## 🎯 项目简介

LG Agent 是一个面向企业的 AI 驱动新人培训平台。通过自动化环境装配、六阶段闯关训练流程、沙盒代码执行与 AI 导师评审，将新人业务上手周期缩短 50%，资深工程师带教内耗降低 80%。

目前 **v1.0.0-MVP** 已经正式发布！我们完成了涵盖底层基础设施、认证、课程管理、沙盒引擎、AI 导师、和 DevOps 等 28 个核心 Epic 的建设。

---

## 🏗️ 核心架构与文档

我们采用 Cloud-Native 企业级架构设计，所有服务与功能解耦，遵循 **Contract-First** API 治理规范。

📚 **核心文档导航**：

- [系统架构概览 (Architecture)](docs/Architecture.md)
- [MVP 验收清单 (MVP Sign-Off)](docs/MVP_Sign_Off.md)
- [Release Notes (v1.0.0-MVP)](docs/Release_Notes.md)

👩‍💻 **用户手册**：

- [学员使用手册 (Trainee Manual)](docs/User/Trainee_Manual.md)
- [导师使用手册 (Mentor Manual)](docs/User/Mentor_Manual.md)

⚙️ **平台运维 (DevOps)**：

- [部署指南 (Deployment Guide)](docs/Platform/01_Deployment_Guide.md)
- [可观测性指南 (Observability Guide)](docs/Platform/02_Observability_Guide.md)
- [发布与回滚策略 (Release Guide)](docs/Platform/03_Release_Guide.md)

---

## 💻 技术栈 (Tech Stack)

| 核心层级       | 技术选型                                                         |
| -------------- | ---------------------------------------------------------------- |
| **Monorepo**   | Turborepo, pnpm workspace, Changesets                            |
| **后端 API**   | NestJS, Prisma, PostgreSQL, `@nestjs/swagger`                    |
| **前端 Web**   | React 18, Vite, Ant Design                                       |
| **CLI 工具**   | Node.js, TypeScript, Commander.js                                |
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
