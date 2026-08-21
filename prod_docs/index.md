# LG-Agent 使用与生产运维文档

本目录面向平台用户和生产运维。所有“已实现”能力均以当前代码、Helm chart 与发布脚本为准；规划能力会明确标注。

## 用户手册

- [导师/管理员手册](./User/Mentor_Manual.md)：课程、任务、Submission、授权、检索与审计。
- [学员手册](./User/Trainee_Manual.md)：Trainee Web、Workspace 保存/版本、运行、提交和 AI 导师。

## 生产运维

- [系统拓扑](./System_Topology.md)：三工作负载、外部依赖和真实流量路径。
- [部署指南](./Platform/01_Deployment_Guide.md)：镜像、Secret、Helm 三阶段发布和运行前提。
- [可观测性](./Platform/02_Observability_Guide.md)：日志、指标、健康检查与观察窗。
- [发布与回滚](./Platform/03_Release_Guide.md)：不可变镜像、证据、smoke 和应用回滚。
- [安全指南](./Platform/04_Security_Guide.md)：JWT、permission RBAC、租户隔离、AI 与 Sandbox。
- [备份与恢复](./Platform/05_Backup_Restore.md)：PostgreSQL 主备份、对象存储契约和演练。

## 交付基线

- [Release Notes](../Design_docs/Release_Notes.md)
- [MVP Sign-Off](../Design_docs/MVP_Sign_Off.md)
- [生产架构 runbook](../docs/architecture/)
- [开发与架构文档](../dev_docs/index.md)
