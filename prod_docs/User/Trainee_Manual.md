# 学员手册 (Trainee Manual)

欢迎来到 LG-Agent 平台！本指南将帮助您了解如何浏览培训课程、在本地完成代码编写，并与您的 AI 导师进行交互。

## 1. 快速入门 (Getting Started)

1. **登录 (Login)**: 访问 Web 控制台，并使用您的导师提供的凭据进行登录。
2. **仪表盘 (Dashboard)**: 您的仪表盘会显示您当前注册的课程、总体进度以及最近与 AI 导师的交互记录。

> **此处预留占位符**: `[Screenshot: Trainee Dashboard]`

## 2. 使用命令行工具 (Using the CLI)

为了模拟真实的开发环境，您的大部分实际编码工作都将在您的本地计算机上使用 LG-Agent CLI 完成。

### 安装与登录 (Installation)

请确保您已安装 Node.js (建议 v18+)，然后进行登录：

```bash
npx @lg-agent/cli login
```

CLI 会提示您输入 Web 控制台的账号和密码，或者通过浏览器进行 OAuth 鉴权。

### 拉取工作区 (Pulling a Workspace)

当您在 Web 界面上选定一个任务后，记录下它的 `Task ID`，然后执行：

```bash
npx @lg-agent/cli pull <task-id>
```

这将为您自动创建一个本地文件夹，并下载：

- 初始代码 (Starter code)
- 必要的依赖配置文件 (`package.json`, `requirements.txt` 等)
- 本地测试脚本

### 提交作业 (Submitting Work)

一旦您在本地完成了编码并且 `npm run test` (或相应的测试命令) 在本地通过，您可以将代码提交到云端沙盒进行正式的验证：

```bash
npx @lg-agent/cli submit
```

CLI 会将您的代码打包上传。此时，您可以回到 Web 控制台的“提交记录”页面查看云端沙盒的执行进度和评分。

## 3. 与 AI 导师交互 (Interacting with the AI Tutor)

如果您在学习或编码过程中遇到困难，随时可以通过 CLI 和 Web 控制台向 AI 导师寻求帮助。

> **此处预留占位符**: `[Screenshot: AI Chat Interface in Web Console]`

- **上下文感知**: AI 导师可以访问您当前拉取的任务对应的专属知识库 (RAG)，因此它的回答会紧扣您正在学习的内容。
- **启发式教学**: 导师被设计为“苏格拉底式”的教学风格，它会通过提供提示、指出潜在逻辑错误来引导您自己找出答案，而不是直接帮您写出完整的代码。
- **安全与合规**: **注意**：您与 AI 的所有对话都会被记录以供导师评估您的学习情况。请勿发送企业机密或个人隐私信息，系统内置的安全拦截器会自动脱敏这些数据。
