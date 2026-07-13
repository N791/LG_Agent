# 导师手册 (Mentor Manual)

欢迎使用 LG-Agent 平台。作为一名导师，您有权限创建课程、配置自动化沙盒，并监控学员的学习进度。

## 1. 仪表盘与分析 (Dashboard & Analytics)

导师仪表盘为您提供了组织的全局概览：

- **学员进度 (Trainee Progress)**: 查看通过率，并在特定任务中识别学习瓶颈。
- **AI 分析 (AI Analytics)**: 监控 AI Token 使用情况、追踪成本，并审查 AI 审计日志以了解学员如何与 AI 导师进行交互。

## 2. 课程与任务管理 (Course & Task Management)

课程由一系列按顺序排列的任务 (Tasks) 组成。

### 任务编辑器 (Task Editor)

在创建任务时，您需要定义以下内容：

- **Markdown 指南**: 学员将要看到的题目描述和指导。
- **JSON Schema 配置**: 定义 `envConfig` (例如所需的 Node、Python、Java 版本) 以及 `testConfig` (沙盒中运行的测试命令)。
- **知识库 (Knowledge Base)**: 上传 Markdown 或 PDF 文档，AI 导师会将其作为该特定任务的参考资料 (RAG)。

## 3. Schema 治理 (Schema Governance)

LG-Agent 使用严格的 JSON Schema 来验证任务配置。当您在 Web 控制台编辑任务时，编辑器会自动从 `@lg-agent/contracts` 包中提取最新的 Schema，以确保您在保存前配置是有效且合规的。
