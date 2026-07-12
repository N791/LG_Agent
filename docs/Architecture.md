# LG-Agent Platform Architecture

## System Overview

LG-Agent is an enterprise-grade AI-assisted learning platform designed around Cloud-Native principles. The platform is comprised of a unified Monorepo utilizing Turborepo and pnpm workspaces.

### 1. Core Services

- **Web Console (`@lg-agent/web`)**: A modern React SPA (Single Page Application) built with Vite and Ant Design. It provides Role-Based Dashboards for Mentors and Trainees.
- **API Server (`@lg-agent/api`)**: A NestJS-based backend adhering to Domain-Driven Design (DDD). It serves as the primary orchestration layer for Auth, Tasks, RAG, and LLM Gateway routing.
- **CLI (`@lg-agent/cli`)**: A Node.js command-line tool allowing developers to pull courses, initialize workspaces, run local tests, and submit their solutions securely.

### 2. Data Persistence (Stateless Architecture)

To ensure the backend API scales horizontally in Kubernetes, state is strictly managed externally:

- **PostgreSQL**: Primary relational database for users, courses, tasks, learning records, and AI logs. Managed via Prisma ORM.
- **Redis**: In-memory data store for JWT blacklisting, rate-limiting, and temporary workspace caching.
- **MinIO (S3 Compatible)**: Object storage for RAG documents, trainee submissions, and system backups.

### 3. AI Gateway & Inference

The AI Gateway standardizes access to multiple LLM Providers (OpenAI, DeepSeek, Qwen).

- **Sensitive Filter**: Employs a Rule Engine to strip PII and internal secrets before transmission.
- **Cost & Audit Logging**: Every prompt is logged, token consumption is aggregated, and metrics are exposed via Prometheus.
- **AI Tutor Pipeline**: Handles RAG retrieval, context building (workspace code), and streams the final response.

### 4. Infrastructure & Platform Operations

- **Docker**: Multi-stage builds produce distroless, non-root Alpine images.
- **Kubernetes (Helm)**: Unified Helm charts manage deployments, exposing the system through an Nginx Ingress.
- **Observability**: Built on Prometheus (Metrics) and Pino (Structured JSON Logging).
- **Quality Engineering**: Playwright E2E, Vitest unit testing, and GitHub Actions CI pipelines enforce strict quality gates on every PR.
