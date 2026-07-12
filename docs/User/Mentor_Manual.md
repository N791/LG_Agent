# Mentor Manual

Welcome to the LG-Agent platform. As a Mentor, you have the ability to create courses, configure automated sandboxes, and monitor trainee progress.

## 1. Dashboard & Analytics

The Mentor Dashboard provides a bird's-eye view of your organization:

- **Trainee Progress**: View pass rates and identify bottlenecks in specific tasks.
- **AI Analytics**: Monitor AI token usage, track costs, and review AI audit logs to see how trainees are interacting with the Tutor.

## 2. Course & Task Management

Courses consist of sequential Tasks.

### Task Editor

When creating a task, you will define:

- **Markdown Instructions**: What the trainee sees.
- **JSON Schema Configuration**: Define the `envConfig` (Node, Python, Java versions required) and `testConfig` (commands run in the Sandbox).
- **Knowledge Base**: Upload markdown/PDF documents that the AI Tutor will use as a reference for this specific task.

## 3. Schema Governance

LG-Agent uses strict JSON Schemas to validate task configurations. When editing a task in the Web Console, the editor automatically pulls the latest schemas from the `@lg-agent/contracts` package to ensure your configuration is valid before saving.
