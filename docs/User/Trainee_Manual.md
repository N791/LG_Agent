# Trainee Manual

Welcome to the LG-Agent platform! This guide will help you navigate your training courses and interact with your AI Tutor.

## 1. Getting Started

1. **Login**: Access the Web Console and sign in with the credentials provided by your Mentor.
2. **Dashboard**: Your dashboard displays your current enrolled courses, overall progress, and recent AI Tutor interactions.

## 2. Using the CLI

Most of your practical coding will be done using the LG-Agent CLI on your local machine.

### Installation

Ensure you have Node.js installed, then log in:

```bash
npx @lg-agent/cli login
```

### Pulling a Workspace

To start working on a task:

```bash
npx @lg-agent/cli pull <task-id>
```

This will download the starter code, necessary environment files, and local test scripts.

### Submitting Work

Once your tests pass locally, submit your work:

```bash
npx @lg-agent/cli submit
```

## 3. Interacting with the AI Tutor

If you get stuck, the AI Tutor is available both via the CLI and the Web Console.

- The Tutor has access to your course's specific knowledge base (RAG).
- The Tutor will guide you with hints rather than just giving you the answer.
- **Note**: All interactions are monitored for quality and sensitive information masking is enforced automatically.
