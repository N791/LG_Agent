# Monorepo 目录结构解析 (Monorepo Structure)

LG-Agent 采用 Monorepo（单体仓库）的方式组织代码，利用 **Turborepo** 提供极速的构建缓存，结合 **pnpm workspaces** 解决多包依赖管理问题。

## 顶层目录结构

```text
LG_Agent/
├── packages/           # 核心子包 (微服务与前端)
│   ├── api/            # 后端服务 (NestJS)
│   ├── web/            # 导师与管理控制台 (React/Vite)
│   ├── trainee-web/    # 学员专属工作区SPA (React/Vite)
│   ├── cli/            # 终端命令行工具 (Node CLI - 已废弃)
│   └── contracts/      # 共享契约与类型定义
├── prod_docs/          # 面向用户的部署与使用文档
├── dev_docs/           # 内部开发与架构设计文档
├── deploy/             # Kubernetes Helm Charts 等基础设施文件
├── package.json        # 根依赖与工作区配置
└── turbo.json          # Turborepo 构建流水线配置
```

## 核心 Package 职责划分

### 1. `@lg-agent/api`

基于 **NestJS** 构建的核心后端。

- **职责**: 处理所有业务逻辑，包括鉴权、任务管理、学习报告分析，以及作为 AI Gateway 将请求转发给 OpenAI/DeepSeek/Qwen。
- **技术栈**: NestJS, Prisma (PostgreSQL ORM), Redis, Jest。
- **目录设计**: 遵循领域驱动设计 (DDD)，划分为 `modules/` (按业务领域拆分，如 `auth`, `tasks`, `ai`)，通过依赖注入降低耦合。

### 2. `@lg-agent/web`

面向导师和学员的 **SPA 前端** 控制台。

- **职责**: 提供直观的仪表盘、任务编辑器（支持 JSON Schema 在线校验）、代码提交记录展示和 AI 对话界面。
- **技术栈**: React 18, Vite, Ant Design, Tailwind CSS。
- **打包方式**: 生产环境下编译为静态文件，通过 Nginx 托管。

### 3. `@lg-agent/trainee-web`

高度集成的 **学员专属在线工作区 (SPA)**。

- **职责**: 替代原有的 CLI 工具，提供一站式的沉浸式学习体验。内置 Mission Hub (任务大厅)、Monaco Code Editor (代码编辑器)、AI Mentor Chat (AI导师实时辅导)、以及 Execution Center (沙盒执行终端输出)。
- **技术栈**: React 18, Vite, Ant Design, Monaco Editor, xterm.js, Tailwind CSS。

### 4. `@lg-agent/cli` (已废弃)

早期的 **Node.js 命令行工具**。

- **状态**: 随着 `@lg-agent/trainee-web` 的上线，该模块将被逐渐弃用，现存仅为了向后兼容部分老旧脚本。

### 5. `@lg-agent/contracts`

至关重要的 **共享契约库**，实现了前后端类型的单一真实数据源 (Single Source of Truth)。

- **职责**: 定义系统中所使用的公共接口 (Interfaces)、枚举 (Enums)、数据传输对象 (DTOs) 以及 JSON Schemas。
- **原理**: `api`, `web`, `trainee-web`, `cli` 都将 `@lg-agent/contracts` 作为依赖引入。当 API 的出入参发生变更时，修改契约库即可让所有消费者在 TypeScript 编译阶段感知到类型变化，避免运行时的接口不匹配问题。
