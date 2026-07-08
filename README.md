# LG Agent — AI 沉浸式企业入职引擎

> **"化被动阅读为主动实战"** — 将企业静态技术文档升级为可运行、可验证的 AI 沉浸式入职闯关引擎。

---

## 项目简介

LG Agent 是一个面向企业的 AI 驱动新人培训平台。通过自动化环境装配、六阶段闯关训练流程、沙盒代码执行与 AI 导师评审，将新人业务上手周期缩短 50%，资深工程师带教内耗降低 80%。

## 技术栈

| 层级       | 技术                                               |
| ---------- | -------------------------------------------------- |
| 后端 API   | NestJS + Prisma + PostgreSQL                       |
| 管理后台   | React 18 + Vite + Ant Design + Tailwind CSS        |
| CLI 客户端 | Node.js + TypeScript + Commander.js                |
| AI 服务    | LangChain + LLM Gateway (OpenAI / Qwen / DeepSeek) |
| 沙盒       | Docker Engine                                      |
| 缓存       | Redis                                              |
| 文件存储   | MinIO                                              |
| 向量数据库 | pgvector (MVP)                                     |
| Monorepo   | pnpm workspace                                     |

## 目录结构

```text
LG_Agent/
├── .agents/              # Agent 开发状态
├── docs/                 # 设计文档（Single Source of Truth）
├── packages/
│   ├── api/              # NestJS 后端服务
│   │   └── src/
│   │       ├── modules/  # 业务模块
│   │       ├── common/   # 公共模块（guards, filters, interceptors）
│   │       ├── config/   # 配置模块
│   │       └── main.ts   # 入口
│   ├── web/              # React 管理后台
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── hooks/
│   │       ├── services/
│   │       ├── stores/
│   │       └── utils/
│   └── cli/              # CLI 客户端
│       └── src/
│           ├── commands/
│           ├── services/
│           └── utils/
├── .editorconfig         # 编辑器统一配置
├── .env.example          # 环境变量模板
├── .gitignore
├── .prettierrc           # Prettier 配置
├── commitlint.config.js  # Commit Message 规范
├── eslint.config.mjs     # ESLint Flat Config
├── tsconfig.base.json    # TypeScript 基础配置
├── pnpm-workspace.yaml   # Monorepo 配置
├── package.json          # 根依赖与脚本
└── README.md
```

## 快速开始

### 前置要求

- Node.js ≥ 20.0.0
- pnpm ≥ 9.0.0
- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+

### 安装

```bash
# 安装依赖
pnpm install

# 复制环境变量模板
cp .env.example .env
# 编辑 .env 填写实际值
```

### 开发命令

```bash
# 代码格式检查
pnpm format:check

# 代码格式修复
pnpm format

# Lint 检查
pnpm lint

# Lint 修复
pnpm lint:fix

# 类型检查
pnpm typecheck
```

## 开发规范

项目严格遵循以下规范（详见 `docs/`）：

- **Git 分支**: Git Flow（main / develop / feature/* / release/* / hotfix/*）
- **Commit**: Conventional Commits（feat / fix / docs / style / refactor / perf / test / chore）
- **代码**: TypeScript Strict Mode + ESLint + Prettier
- **Review**: 所有代码必须经过 Code Review 后才能合并
- **测试**: 核心模块覆盖率 ≥ 80%

## 文档

所有设计文档位于 `docs/` 目录：

- 产品调研 & 需求分析
- 技术架构设计
- 数据库设计
- API 设计
- 开发规范
- CI/CD 流水线
- 安全设计

## License

UNLICENSED — 企业内部项目
