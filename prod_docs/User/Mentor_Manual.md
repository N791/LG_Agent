# 导师与管理员手册

实际可见页面由账号 permission 决定。管理员通常可访问 Organization、用户、课程、任务、Submission、授权、检索、AI 设置与可观测性；导师账号只显示获授权范围。

## 课程与任务

1. 在“课程”创建或选择 Course。
2. 进入 Task 列表，创建/编辑 Task，填写标题、说明、阶段、难度及环境/沙盒/测试/Prompt 配置。
3. 可使用“AI 生成任务”，但生成结果仍需人工校验后保存。
4. JSON 配置由 contracts/schema 验证；保存失败时按字段错误修正。

可用运行时由平台 `SANDBOX_ENABLED_LANGUAGES`、image allowlist 与签名 digest 决定。代码支持 Node、Java、Python、Go、Rust profile，但生产默认只启用 Node；不要仅凭界面文本承诺其他语言。

## Submission 与学习数据

“Submission”页面可按授权范围查看 assessed attempt、状态、score 与执行日志。Submission 是唯一评测生命周期，支持管理员 replay；学员普通 run 与正式 submit 的语义不同。日志通过 SSE 与 durable ExecutionEvent 提供，长日志可能归档。

Dashboard/统计页面提供训练与 AI 使用概览。数据只反映当前实现采集的指标，不能把图表推断为个人绩效结论。

## 授权管理

授权页面支持：

- 查看 permission registry；
- 创建/复制 role；
- impact preview；
- 更新 role permissions；
- 更新 role members。

高风险变更需要确认 role name。变更后检查目标用户 `/me/permissions`、跨 Organization 隔离和 audit event。不要只修改旧 `users.role` 字段。

## AI 设置与检索

AI 设置可管理已实现的 provider/RAG 参数。检索页面可查看 index、health、shadow comparison、trace，以及激活/重试操作。当前没有导师上传 PDF/Markdown 的 Web/API 流程；知识 source 由平台既定导入流程提供，不能向用户承诺界面上传。

## 运维与审计

拥有对应 permission 的人员可查看 telemetry、audit 和 AI request audit。导出、复制或共享日志前必须确认 Organization 范围并移除敏感信息。发现 registry mismatch、跨租户可见或 Sandbox 异常时立即停止相关操作并联系平台团队。
