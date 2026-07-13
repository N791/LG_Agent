# 本地开发环境搭建 (Local Setup)

为了在本地运行 LG-Agent 平台，您需要准备基础环境并启动所需的依赖服务。

## 1. 环境准备 (Prerequisites)

- **Node.js**: `v18.x` 或以上版本。
- **包管理器**: `pnpm` (`npm install -g pnpm`)。推荐由于 Turborepo 与 pnpm workspaces 的完美兼容。
- **Docker**: 用于启动本地的数据库和缓存等依赖服务。

## 2. 启动依赖服务 (Dependencies)

平台在本地运行时依赖于 PostgreSQL 和 Redis。我们提供了一个 `docker-compose.yml` 文件来一键启动这些服务。

在项目根目录下执行：

```bash
docker-compose up -d
```

这将启动：

- **PostgreSQL** (`localhost:5433`): 主要关系型数据库。
- **Redis** (`localhost:6379`): 用于速率限制和缓存。

## 3. 安装依赖与构建契约包

首先安装所有的 npm 依赖：

```bash
pnpm install
```

因为 `@lg-agent/api` 和 `@lg-agent/web` 都依赖于 `@lg-agent/contracts` (数据契约包)，我们需要先构建它：

```bash
pnpm turbo run build --filter @lg-agent/contracts
```

## 4. 数据库初始化 (Database Setup)

进入 `@lg-agent/api` 目录，将 Prisma Schema 推送到本地的 PostgreSQL 数据库，并生成 Prisma Client：

```bash
cd packages/api
pnpm prisma db push
pnpm prisma generate
```

## 5. 启动服务 (Running the Application)

回到项目根目录，使用 Turborepo 一键启动 API 和 Web 端的开发服务器：

```bash
pnpm run dev
```

该命令等价于 `pnpm turbo run dev --ui=tui`。它会：

1. 在端口 `3000` 启动 NestJS API 服务。
2. 在端口 `5173` 启动 Vite React 前端服务。
3. 提供一个控制台交互式 TUI (Terminal UI)，您可以方便地查看不同微服务的日志。

## 6. 测试环境

如果您需要运行集成测试 (E2E/Integration tests)，确保 `DATABASE_URL` 正确指向了 `docker-compose` 中暴露的数据库端口，并且直接在项目根目录下运行：

```bash
pnpm turbo run test
```
