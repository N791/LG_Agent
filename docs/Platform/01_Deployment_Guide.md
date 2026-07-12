# Platform Deployment Guide

## 1. Registry Agnostic Configuration

All CI/CD workflows and deployment manifests use environment variables to define the container registry, ensuring we are not locked into any specific vendor (like Docker Hub or GitHub Container Registry).

### Core Environment Variables

When deploying or building, the following variables govern image naming:

- `IMAGE_REGISTRY`: The domain of the registry (e.g., `ghcr.io`, `docker.io`, `0123456789.dkr.ecr.us-east-1.amazonaws.com`).
- `IMAGE_NAMESPACE`: The organization or user namespace (e.g., `lg-agent`, `my-company`).
- `IMAGE_NAME`: The base name of the image (e.g., `lg-agent-api`).
- `IMAGE_TAG`: The specific version or commit SHA (e.g., `v1.0.0`).

## 2. Docker Multi-stage Builds

We use multi-stage Dockerfiles leveraging `turbo prune` to keep images lightweight and secure.

- **Pruner Stage**: Extracts only the packages required for the target workspace.
- **Installer Stage**: Installs dependencies and runs builds.
- **Runner Stage**: Uses Alpine Linux, copies only the compiled output, and runs under a non-root user (`nestjs` for API, `nginx` for Web).

## 3. Kubernetes Deployment (Helm)

We deploy to Kubernetes using the unified Helm Chart located in `deploy/helm/lg-agent`.

### External Dependencies

Following cloud-native best practices, our Helm chart **does not** embed databases or object storage. PostgreSQL, Redis, and MinIO must be provisioned externally (via managed cloud services like RDS/ElastiCache or dedicated operators).

Pass connection details via `values.yaml` or secrets:

```yaml
api:
  env:
    DATABASE_URL: 'postgresql://...'
```

### Installation

```bash
helm upgrade --install lg-agent ./deploy/helm/lg-agent -f values-prod.yaml --namespace lg-agent-prod --create-namespace
```
