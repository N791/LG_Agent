# 本地开发环境搭建

## 前置条件

- Node.js 20.6+（CI 使用 22；项目脚本使用 Node 原生 `--env-file`）
- pnpm 9（仓库锁定 `pnpm@9.15.9`）
- Docker 与 Docker Compose
- Git

## 配置与依赖

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait
```

Windows PowerShell 可使用 `Copy-Item .env.example .env`。`.env` 至少需要有效的 `DATABASE_URL`、32 字符以上的非默认 `JWT_SECRET`、MinIO 凭据；本地无真实 LLM 时可将 `LLM_PROVIDER=mock`。

Compose 端口：

| 依赖                  |        Host |   Container |
| --------------------- | ----------: | ----------: |
| PostgreSQL + pgvector |       54322 |        5432 |
| Redis                 |       16379 |        6379 |
| MinIO API / Console   | 9000 / 9001 | 9000 / 9001 |

注意 `.env.example` 的 `REDIS_URL` 与 `REDIS_HOST/REDIS_PORT` 都存在；本地 URL 应与映射端口一致。生产 Secret 契约见 prod_docs。

## 初始化数据库

```bash
pnpm --filter @lg-agent/contracts build
pnpm db:init
```

一键初始化会依次校验环境与 Prisma Schema、生成 Prisma Client、
执行受版本控制的 `migrate deploy`、对齐权限注册表与系统角色，
并确认最终 migration 状态。权限对齐不可省略，否则管理员验证成功后
会被管理页的 `/me/permissions` 会话检查拒绝。
该命令幂等，可在首次部署失败后或日后升级时安全重复执行。

项目脚本会优先保留 shell/CI 已注入的环境变量，并自动读取
`packages/api/.env` 或仓库根目录的 `.env`。不要直接使用
`pnpm --filter @lg-agent/api exec prisma ...` 进行本地初始化，因为 filtered exec
的工作目录是 `packages/api`，Prisma 不会自动读取仓库根目录的 `.env`。

演示数据不是部署必需项，且包含固定的训练账号。仅在隔离的本地开发数据库中，
显式设置 `ALLOW_INSECURE_DEMO_SEED=true` 后再运行
`pnpm --filter @lg-agent/api seed`；生产环境禁止运行该命令。

需要一次性管理员时配置 `BOOTSTRAP_*` 变量后运行：

```bash
pnpm --filter @lg-agent/api bootstrap:admin
```

bootstrap 可幂等修复同一账号的系统角色绑定，但仅在已有账号属于
同一组织、仍是启用的 `ADMIN`、且配置密码匹配时执行；它不会隐式重置密码。
开发环境直接使用 `.env` 中明确设置的强密码，生产环境则始终要求首次登录后改密。

不要用 `prisma db push` 替代受版本控制的 migration。

## 启动

```bash
pnpm dev
```

- API：`http://localhost:4000`；Swagger：`http://localhost:4000/api/docs`
- Admin Web：`http://localhost:8080`
- Trainee Web：`http://localhost:8081`

Turborepo 会并行启动 package 的 `dev` 命令。也可用 `pnpm --filter <package> dev` 单独启动。

## 提交前验证

```bash
pnpm architecture:check
pnpm design:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm --filter @lg-agent/api test:retrieval-gate
pnpm --filter @lg-agent/web test:e2e
pnpm --filter @lg-agent/trainee-web test:e2e
```

测试需使用独立数据库/fixture，不得连接生产。Playwright 首次运行前执行 `pnpm exec playwright install chromium`。
