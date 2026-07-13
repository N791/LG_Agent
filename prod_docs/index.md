# LG-Agent 平台使用与部署指南

欢迎阅读 LG-Agent 的使用与部署文档。本目录包含了面向**终端用户（导师与学员）**以及**平台运维人员**的所有参考资料。

## 目录索引 (Table of Contents)

### 🧑‍💻 用户手册 (User Manuals)

针对平台最终用户的功能指南。

- [导师手册 (Mentor Manual)](./User/Mentor_Manual.md) - 介绍如何创建课程、配置测试沙盒，以及查看学员的统计数据与 AI 审计日志。
- [学员手册 (Trainee Manual)](./User/Trainee_Manual.md) - 介绍如何使用 CLI 拉取代码、在本地沙盒环境中测试以及与 AI 导师交互。

### ⚙️ 平台运维 (Platform Operations)

面向 DevOps 和系统管理员的指南，涵盖部署、监控与安全管理。

- [系统拓扑图 (System Topology)](./System_Topology.md) - LG-Agent 在生产环境下的高可用网络拓扑与组件交互。
- [部署指南 (Deployment Guide)](./Platform/01_Deployment_Guide.md) - Docker 多阶段构建与 Kubernetes (Helm) 部署指南。
- [可观测性指南 (Observability Guide)](./Platform/02_Observability_Guide.md) - Pino 日志结构、Prometheus 指标与 Terminus 健康检查配置。
- [发布管理 (Release Guide)](./Platform/03_Release_Guide.md) - 基于 Changeset 的自动化版本管理与回滚策略。
- [安全指南 (Security Guide)](./Platform/04_Security_Guide.md) - 生产环境中的密钥管理、RBAC 权限及网络隔离最佳实践。
- [数据备份与恢复 (Backup & Restore)](./Platform/05_Backup_Restore.md) - PostgreSQL 与 MinIO 数据的定时备份及灾备策略。

---

> **内部开发文档？**
> 如果您是核心研发人员，正在寻找环境搭建、API 设计或数据库结构等开发相关信息，请参阅 [`dev_docs/index.md`](../dev_docs/index.md)。
