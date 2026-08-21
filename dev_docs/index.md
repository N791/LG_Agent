# LG-Agent 开发与架构文档

本目录面向研发、架构和贡献者。内容以当前代码、`CONTEXT.md` 与 `docs/adr/` 为准；产品设计基线位于 `Design_docs/`。

## 开发者指南

- [本地环境搭建](./Developer_Guide/01_Local_Setup.md)：依赖、环境变量、数据库迁移、启动与验证。
- [Monorepo 结构](./Developer_Guide/02_Monorepo_Structure.md)：六个 package 的职责、依赖方向和公共 interface。

## 架构

- [系统架构](./Architecture/01_System_Architecture.md)：模块化单体、Authoring Workspace、Submission 与 Sandbox 的 seam。
- [数据库设计](./Architecture/02_Database_Design.md)：租户数据、执行生命周期、检索、权限和保留策略。
- [API 规范](./Architecture/03_API_Guidelines.md)：路由、契约、错误、SSE 与权限治理。
- [AI 集成](./Architecture/04_AI_Integration.md)：LLM adapter、规则引擎、Prompt 治理和版本化检索。

## 质量与决策

- [质量门禁](./test/11_Quality_Gate.md)：本地、CI、数据库、契约、架构和 E2E 门禁。
- [领域词汇](../CONTEXT.md)：Organization、Task、Workspace、Submission、Sandbox 等规范名称。
- [ADR](../docs/adr/)：模块化单体、Submission 单入口和持久执行 adapter。
- [设计文档](../Design_docs/Design/)：受 CI 一致性检查的 01–09 设计基线。
- [MVP 验收](../Design_docs/MVP_Sign_Off.md)。

生产部署与用户操作请见 [prod_docs](../prod_docs/index.md)。
