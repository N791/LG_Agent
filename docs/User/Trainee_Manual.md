# 学员手册 (Trainee Manual)

欢迎来到 LG-Agent 平台！本指南将帮助您了解如何浏览培训课程并与您的 AI 导师进行交互。

## 1. 快速入门 (Getting Started)

1. **登录 (Login)**: 访问 Web 控制台，并使用您的导师提供的凭据进行登录。
2. **仪表盘 (Dashboard)**: 您的仪表盘会显示您当前注册的课程、总体进度以及最近与 AI 导师的交互记录。

## 2. 使用命令行工具 (Using the CLI)

您的大部分实际编码工作都将在您的本地计算机上使用 LG-Agent CLI 完成。

### 安装与登录 (Installation)

请确保您已安装 Node.js，然后进行登录：

```bash
npx @lg-agent/cli login
```

### 拉取工作区 (Pulling a Workspace)

开始一个任务：

```bash
npx @lg-agent/cli pull <task-id>
```

这将下载初始代码、必要的环境文件以及本地测试脚本。

### 提交作业 (Submitting Work)

一旦您的测试在本地通过，请提交您的作业：

```bash
npx @lg-agent/cli submit
```

## 3. 与 AI 导师交互 (Interacting with the AI Tutor)

如果您在学习过程中遇到困难，可以通过 CLI 和 Web 控制台向 AI 导师寻求帮助。

- 导师可以访问您课程的专属知识库 (RAG)。
- 导师会通过提供提示和引导来帮助您，而不是直接给出答案。
- **注意**: 所有的交互记录都会被监控以保证质量，并且系统会自动执行敏感信息的脱敏过滤。
