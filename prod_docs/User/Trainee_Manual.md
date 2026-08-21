# 学员手册

推荐入口是 Trainee Web；CLI package 仅为兼容保留，不作为新流程。

## 登录与课程

1. 打开学员站点并登录。
2. Dashboard 查看已注册 Course、进度和最近活动。
3. 在 Mission Hub 选择 Task，进入 `/course/:courseId/workspace/:taskId`。

页面是否可访问由 permission 决定。出现 403 时联系管理员确认 Course enrollment 与 role，不要反复刷新或更换 URL 绕过。

## Authoring Workspace

Workspace 是你与当前 Task 的持久编辑空间：

- 远端保存 baseline 与文件；
- 浏览器保留离线 snapshot；
- `WorkspaceSession` 统一管理 draft、dirty file、活动文件、版本和执行状态；
- 自动保存失败时界面会保留 dirty 状态，不代表服务器已保存。

若远端版本已变化，系统会报告 conflict。先比较本地与远端内容，再选择保留本地、采用远端或手动合并。不要在冲突提示出现时直接关闭页面。

版本面板可创建和恢复 Workspace version。恢复会改变当前文件集合，执行前先确认目标版本。

## Run 与 Submit

- **Run**：用于当前 Workspace 的练习执行，不创建并行评测生命周期。
- **Submit**：创建 assessed Submission，拥有持久状态、score、日志、取消和恢复语义。

执行使用临时隔离的 Execution Workspace，不会把运行时生成文件自动写回 Authoring Workspace。日志通过 SSE 流式显示；断线后可从最后事件继续。只有 notification 使用 WebSocket。

生产默认只保证平台启用且镜像已验证的语言。遇到“语言未启用”“镜像不允许”或资源限制错误时，联系导师调整 Task，而不是修改系统命令。

## AI 导师与引用

AI 导师可使用 Task、对话和获授权检索证据生成提示。引用可打开时表示你有该 source 的访问权限；缺少引用或答案不可靠时应回到 Task 与原始资料核对。

不要发送凭据、个人隐私或公司机密。系统会执行 masking 和 prompt-injection 规则，但自动过滤不能替代你的判断。AI 输出是学习辅助，不是最终评测结果。

## 常见问题

- **保存后仍显示 dirty**：检查网络，等待重试；若出现 conflict，先完成合并。
- **日志中断**：重新连接，系统会用最后事件 id replay；不要重复 Submit。
- **Submit 状态长时间不变**：记录 Submission id，联系导师/平台查看 lease/recovery。
- **页面功能缺失**：通常是 permission 或 Course enrollment；联系管理员。
