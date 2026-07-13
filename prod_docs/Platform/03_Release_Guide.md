# 发布与版本管理

本项目严格遵循 **语义化版本规范 (Semantic Versioning)** 并使用 **Changesets** 和 GitHub Actions 自动化整个发布流程。

## 1. 版本策略 (Version Strategy)

开发者绝对不要手动修改 `package.json` 中的版本号。
相反，当您提交更改时，请生成一个 changeset：

```bash
pnpm changeset
```

按照提示选择受影响的包以及变更的类型 (patch, minor, major)。将生成的 markdown 文件与您的代码一并提交。

## 2. 自动化发布流水线 (Automated Release Pipeline)

当一个 Pull Request 被合并到 `main` 分支时，会触发 `Release Pipeline`：

1. 它会聚合所有未发布的 `.changeset` markdown 文件。
2. 创建一个新的“Release Pull Request”，名称通常为 `chore(release): version packages`。
3. 当您合并这个 Release PR 时：
   - `package.json` 中的版本号将被永久更新。
   - 会向代码库推送一个 Git Tag (例如：`v1.2.0`)。
   - 会创建一个包含自动生成的变更日志 (changelog) 的 GitHub Release。
   - 触发 `Docker Build & Push` 流水线以为该新 Tag 构建镜像。

## 3. Docker 标签策略 (Docker Tagging Strategy)

每次发布都会自动生成多个标签，以保证可追溯性并方便回滚：

- `latest`
- `vX.Y.Z` (例如: `v1.2.0`)
- `Git SHA` (例如: `3fa2b8c`)

## 4. 回滚策略 (Rollback Strategy)

如果在生产环境中发生灾难性故障：

1. **基础设施回滚 (Infrastructure Rollback)**: 执行 `helm rollback lg-agent 0` 以将 Kubernetes 部署回滚到上一个稳定的修订版本。
2. **代码回滚 (Code Rollback)**: 由于我们对每个版本都打上了 Tag，您可以将 Git 代码库回退到上一个稳定的 Tag，并可选择通过 changesets 发布一个热修复版本 (hotfix)。
