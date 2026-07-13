# 平台部署指南

## 1. 与镜像仓库无关的配置 (Registry Agnostic Configuration)

所有的 CI/CD 流水线和部署清单都使用环境变量来定义容器镜像仓库，确保我们不会被锁定在任何特定的供应商（例如 Docker Hub 或 GitHub Container Registry）。

### 核心环境变量

在部署或构建时，以下变量用于控制镜像命名：

- `IMAGE_REGISTRY`: 镜像仓库的域名 (例如: `ghcr.io`, `docker.io`, `0123456789.dkr.ecr.us-east-1.amazonaws.com`)。
- `IMAGE_NAMESPACE`: 组织或用户命名空间 (例如: `lg-agent`, `my-company`)。
- `IMAGE_NAME`: 镜像的基础名称 (例如: `lg-agent-api`)。
- `IMAGE_TAG`: 特定版本或 Git Commit SHA (例如: `v1.0.0`)。

## 2. Docker 多阶段构建 (Docker Multi-stage Builds)

我们利用 `turbo prune` 进行多阶段 Docker 构建，以保持镜像轻量且安全。

- **Pruner 阶段**: 仅提取目标工作区所需的相关包和依赖。
- **Installer 阶段**: 安装依赖并执行构建。
- **Runner 阶段**: 基于 Alpine Linux，仅复制编译后的输出文件，并以非 root 用户（API 使用 `nestjs`，Web 使用 `nginx`）运行。

## 3. Kubernetes 部署 (Helm)

我们使用位于 `deploy/helm/lg-agent` 的统一 Helm Chart 将服务部署到 Kubernetes 集群中。

### 外部依赖

遵循云原生最佳实践，我们的 Helm Chart **不包含** 数据库或对象存储的部署。PostgreSQL、Redis 和 MinIO 必须在外部独立供应（例如通过 RDS/ElastiCache 等托管云服务或专用 Operators 提供）。

请通过 `values.yaml` 或 Kubernetes Secrets 传递连接信息：

```yaml
api:
  env:
    DATABASE_URL: 'postgresql://...'
```

### 安装命令

```bash
helm upgrade --install lg-agent ./deploy/helm/lg-agent -f values-prod.yaml --namespace lg-agent-prod --create-namespace
```
