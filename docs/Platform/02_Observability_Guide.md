# Platform Observability Guide

## 1. Structured Logging (Pino)

The `lg-agent` backend completely disables the standard `console.log` in favor of `nestjs-pino`.

- **JSON Format**: In production, all logs are written as JSON objects.
- **Pretty Print**: In development, `pino-pretty` is automatically enabled for readability.
- **Request Traceability**: Every HTTP request is automatically logged with a unique `req.id` to trace the entire lifecycle of a request.

## 2. Prometheus Metrics

We use `@willsoto/nestjs-prometheus` to expose a standard `/metrics` endpoint for Prometheus scraping.

### Available Metrics

- **HTTP Metrics**: Handled automatically (e.g., `http_request_duration_seconds`).
- **AI Token Usage**: A custom counter `ai_token_usage_total` tracks token consumption grouped by `provider` and `model`.

All custom metrics are registered and managed exclusively inside the `MonitoringModule`. Controllers should never instantiate or manipulate Prometheus Counters directly; they must call the `MonitoringService`.

## 3. Health Checks (Terminus)

The application exposes a `/health` endpoint to Kubernetes.

- **Liveness Probe**: Confirms the node process is running and not deadlocked.
- **Readiness Probe**: Confirms database connectivity (via Prisma Health Indicator) before Kubernetes routes traffic to the pod.
