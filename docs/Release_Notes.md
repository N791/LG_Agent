# Release Notes: v1.0.0-MVP

We are thrilled to announce the v1.0.0-MVP release of the LG-Agent Platform!
This release marks the completion of 28 Epics, establishing a robust, enterprise-grade AI-assisted learning environment.

## 🚀 Key Features

### User & Course Management

- Complete Role-Based Access Control (RBAC) supporting Mentors and Trainees.
- Dynamic Course and Task creation with support for JSON Schema-validated configurations.

### AI Gateway & Tutor

- Unified integration with OpenAI, DeepSeek, and Qwen via the Provider Adapter pattern.
- **AI Tutor**: Context-aware assistance utilizing RAG (Retrieval-Augmented Generation).
- **Security**: Rule Engine integration for PII and Sensitive Data Masking before any LLM API call.
- **Analytics**: Detailed Cost Tracking and Audit Logging for all AI interactions.

### CLI & Sandbox

- `@lg-agent/cli` allows trainees to pull workspaces, run local tests, and securely submit code.
- Automated Sandbox Engine capable of evaluating Node, Python, and Java submissions.

### Enterprise Platform Foundation

- **Monorepo**: Turborepo + pnpm workspaces.
- **API Governance**: OpenAPI/Swagger integration generating the platform contract (`@lg-agent/contracts`).
- **DevOps**: Multi-stage Docker builds, externalized persistence dependencies, and a unified Helm Chart.
- **Observability**: Prometheus metrics, Pino structured logging, and Terminus health checks.
- **Quality**: GitHub Actions CI with Playwright E2E and Vitest unit testing.
