# LG-Agent 双端浏览器功能审计

- 日期：2026-08-01
- 浏览器：Codex 应用内浏览器（browser@openai-bundled）
- 管理端：`http://localhost:8080`，账号 `admin`
- 学员端：`http://localhost:8081`，账号 `trainee`
- 依据：`Design_docs/02_需求分析__Requirement_Analysis.md`、`Design_docs/Design/04_4._核心业务流程（Core_Business_Flow）.md`、`Design_docs/MVP_Sign_Off.md`、`Design_docs/Design/10_3._可执行任务清单（Task_Breakdown）.md`
- 本记录替代同目录的 `2026-08-01-browser-audit-blocked.md`；此前浏览器连接阻塞已恢复。

## 测试范围

已验证：双端登录、仪表盘、通知、课程与任务列表、用户表单、Markdown/环境/测试/Prompt 编辑页、学习分析与 AI 评审、监控与审计日志、Retrieval、角色权限、任务中心、Workspace 文件/目标/AI/版本/提交/知识/讨论面板，以及 Run/Build/Lint/Test 动作。

为避免污染业务数据，本轮未执行用户/课程/任务删除、课程上下架、角色或成员变更、讨论发送、CSV 下载和最终 Submit。测试产生了一次无敏感信息的 AI Tutor 问答，以及 Run/Build/Lint/Test 执行/版本记录。

## 通过项

- 两端有效凭据均可登录并进入正确首页。
- 管理端仪表盘、用户列表、课程/任务列表、Markdown 编辑器、Prompt 表单、学习分析、审计日志、角色权限矩阵可加载。
- 学员端通知、目标说明、提交历史、知识搜索和导师提问表单可打开。
- Build、代码检查与 Test 操作可结束并返回状态；提交历史与管理端分析数据一致。

## 缺陷记录

### AUD-01 [P0] Golden Case 目标、模板与评测不一致

- 复现：进入“企业网关鉴权开发”工作区。
- 预期：根据任务说明提供 `index.js`、`authMiddleware`、JWT 依赖和对应安全测试。
- 实际：资源管理器只有 `index.ts`，内容为 `var message = "Hello World"; console.log(message)`；不存在任务要求的代码。
- 影响：学员无法按任务说明完成训练，学习闭环失真。
- 代码线索：`packages/api/prisma/seed.ts` 把模板写入 `sandboxConfig.template`，而 `packages/api/src/modules/workspace/workspace.initializer.ts` 只从 `envConfig.files` 初始化并在缺失时生成 `index.ts`。

### AUD-02 [P0] 缺失真实验收脚本时 Build/Lint/Test 仍成功

- 复现：保持上述 Hello World 工作区不变，依次执行 Build、代码检查和 Test。
- 实际：三项均显示 `SUCCESS`，耗时约 6 秒；当前内容明显不满足 JWT 鉴权验收标准。
- 影响：空操作或错误模板可以得到成功结果，历史提交出现 `PASSED / 100`，评分不可信。
- 代码线索：`NodeRuntimeProfile` 对非 run 动作执行 `npm run <action> --if-present`；缺少脚本时被当作成功。

### AUD-03 [P1] Node 20 的 TypeScript Run 命令使用不兼容参数

- 复现：工作区点击“运行”。
- 实际：状态 `FAILED`，控制台输出 `node: bad option: --experimental-strip-types`。
- 代码线索：`packages/api/src/modules/sandbox/node-runtime.profile.ts` 声明 Node 20，却对 `.ts` 入口追加 `--experimental-strip-types`。

### AUD-04 [P0] 高级任务编辑器的三类 JSON Schema 全部 404

- 复现：管理端课程 → 任务管理 → 高级编辑，打开 Environment & Sandbox、Testing。
- 实际：`lg-agent:schema:env`、`lg-agent:schema:sandbox`、`lg-agent:schema:test` 均显示 `Failed to load schema`，控制台为 HTTP 404，并重复出现 `errors.schema.notFound`。
- 影响：环境、沙盒和测试配置无法通过 Schema 编辑器维护。
- 代码线索：前端按 Schema `$id` 请求；`FileSchemaRepository` 只按 `env/sandbox/test/prompt` 短键注册。

### AUD-05 [P0] 组织管理员无法在新增用户表单选择所属企业

- 复现：管理端用户管理 → 新增用户 → 展开“所属企业”。
- 实际：下拉显示“暂无数据”；审计日志同步出现 `authorization.denied`，资源 `/api/v1/organizations`。
- 影响：核心 User CRUD 的创建路径不可用。
- 代码线索：`OrganizationsController` 在类级要求 `platform-organization:manage`，而组织管理员表单调用全平台组织列表；不能通过放宽全平台权限修复。

### AUD-06 [P1] AI Tutor 与 Retrieval 仍处于 Mock/降级状态

- 复现：学员端询问“这个任务的验收标准是什么？”；管理端用当前 Task ID 预览检索。
- 实际：AI 只返回 `[MOCK STREAM RESPONSE]`、`证据不足`、`索引降级`；Retrieval 显示 `retrieval-unavailable`、0/0 证据且无活动索引版本。知识库搜索 `JWT` 只返回无关的示例 `ide_guidelines`（Score 0.25）。
- 影响：不满足上下文感知 AI 导师、可追溯证据和知识检索设计。
- 相关配置：默认 `RETRIEVAL_ROLLOUT_MODE=LEGACY`，当前模型为 `mock-model-v1`。

### AUD-07 [P1] 学员打开讨论面板触发统计接口 500

- 复现：工作区打开“讨论”。
- 实际：页面显示全 0 概览，但控制台记录两次 `/discussions/analytics` HTTP 500。
- 影响：错误被静默降级为可信的 0，监控噪声与用户认知均错误。
- 代码线索：`DiscussionsController` 的 `@Get(':id')` 声明在 `@Get('analytics')` 之前；同时学员端无条件请求仅面向 `discussion:manage` 的组织级统计。

### AUD-08 [P2] AI 评审报告仅呈现原始执行 JSON

- 复现：管理端学习分析 → 任一通过记录 → AI 评审。
- 实际：弹窗仅显示 `{ "message": "All tests passed", "exitCode": 0 }`，没有结构化问题、证据、改进建议或学习反馈。
- 影响：不满足数字导师评审与可执行学习建议设计。

## 回归基线

修复后至少应满足：Golden Case 模板与测试一致；Hello World 不得通过 JWT 任务；Node 运行命令与声明版本一致；Schema 编辑器无 404；组织管理员可在本组织内新增用户但不能读取全平台组织；讨论面板无 500；AI/Retrieval 在验收环境提供非 Mock、可引用回答，或明确呈现未配置状态而非伪成功。
