# 贡献指南 (Contributing Guidelines)

感谢您花时间为 LG Agent 项目做出贡献！我们是一个提倡“自服务”的内源项目，健康的协作流程是我们保持项目质量的关键。

## 1. 分支命名规范 (Branch Naming)

请基于 `main` 分支拉取您的功能分支。分支名请遵循以下格式：

- `feat/xxx`：新功能 (Feature)
- `fix/xxx`：修复 Bug
- `docs/xxx`：文档修改
- `style/xxx`：代码格式、样式调整
- `refactor/xxx`：代码重构
- `test/xxx`：测试用例修改
- `chore/xxx`：构建过程或辅助工具的变动

示例：`feat/add-ai-tutor-api`

## 2. Commit 提交规范

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 规范。提交信息必须包含类型，推荐格式如下：

```
<type>(<scope>): <subject>
```

- **type**：同分支命名中的类型（feat, fix, docs, refactor 等）。
- **scope**（可选）：说明 commit 影响的范围，比如 `api`, `web`, `cli`。
- **subject**：简短描述变更的内容。

示例：`feat(api): 添加 AI 导师评审接口`

_注意：项目中已配置 Husky 和 Commitlint，不符合规范的 commit 将会被拒绝。_

## 3. Pull Request (PR) 流程

1. **更新代码**：在提交 PR 前，请确保您的分支代码与 `main` 分支保持同步（建议使用 `git rebase main`）。
2. **本地测试**：请在本地运行通过所有的 Lint 检查和测试（`pnpm lint`, `pnpm test`）。
3. **提交 PR**：向 `main` 分支发起 PR。
4. **填写模板**：请仔细填写自动加载的 PR 模板，勾选相关清单，并关联对应的 Issue（如：`Fixes #123`）。
5. **代码审查 (Code Review)**：PR 需要至少一名领域专家（由 `CODEOWNERS` 自动指派）的 Approve 才能合并。
6. **自动化检查 (CI)**：PR 必须通过所有的 GitHub Actions 检查。

感谢您的贡献！
