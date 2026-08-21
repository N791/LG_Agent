## 描述 (Description)

<!-- 请在此处简要描述您的 PR 解决了什么问题，以及做了哪些主要的更改。 -->

## 关联 Issue (Related Issue)

<!-- 如果有对应的 Issue，请使用关键字关联，例如：Fixes #123 或 Resolves #123 -->

Fixes #

## 自测清单 (Self Check)

请在提交 PR 前确保完成以下事项，并在完成后打勾 [x]：

- [ ] 我的代码遵循该项目的代码规范 (Code Guidelines)。
- [ ] 我已经仔细审查了我自己的代码 (Code Review)。
- [ ] 我已经为我的更改添加了适当的注释（如果需要）。
- [ ] 我的更改不会产生新的警告 (Warnings) 或 Lint 错误。
- [ ] 我在本地运行并通过了所有的测试和构建。
- [ ] 我已经更新了相关的文档（如适用）。

## 架构检查 (Architecture)

- [ ] Module depth：新增/修改领域通过公开 `index.ts` 暴露 interface，未跨域深路径导入 implementation。
- [ ] Seam：Controller 只调用所属领域的公开 interface，并为新增行为补充 contract test。
- [ ] Adapter：具体 adapter 仅在 composition root 选择，业务代码依赖 token/interface。
- [ ] Tenant scope：所有组织级读写携带并验证 organization scope，测试覆盖跨租户拒绝。
- [ ] Migration：Schema 变更包含只前进 migration、空库/升级路径验证与回滚/恢复说明。

## 附加信息 (Additional context)

<!-- 请提供审核此 PR 时可能需要的任何其他信息或上下文。例如：UI 截图等。 -->

## Sprint 18 Release Sign-off

仅发布 Sprint 18 时填写；审批必须来自真实 reviewer。

- [ ] 已附上绿色 staging release drill workflow 与制品链接。
- [ ] Security (`@lg-agent-core-team`) 已批准。
- [ ] Backend (`@backend-team`) 已批准。
- [ ] Frontend (`@frontend-team`) 已批准。
- [ ] Platform (`@devops-team`) 已批准。
