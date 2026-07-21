# AI 集成与实现原理 (AI Integration)

LG-Agent 作为一个 AI 辅助平台，集成了多种大语言模型，并实现了严格的安全审查与成本控制机制。
所有的 AI 相关逻辑都封装在 `@lg-agent/api` 的 `AiModule` 及 `GatewayModule` 中。

## 1. 供应商适配器模式 (Provider Adapter Pattern)

为了防止对单一 LLM 供应商的强绑定，我们在设计中使用了 **适配器模式**。

所有的 AI 请求必须通过 `AIGatewayService` 发起，该服务内部维护了一个供应商列表（如 `OpenAiProvider`, `DeepSeekProvider`, `QwenProvider`）。

这些具体的 Provider 类都必须实现统一的 `ILLMProvider` 接口：

```typescript
export interface ILLMProvider {
  /** 模型名称，例如 mock, openai, deepseek */
  name: string;
  /** 流式返回文本，兼容 OpenAI 的 SSE 格式，包含 tokens 使用量和模型名称 */
  stream(request: LLMRequest, providerName?: string): AsyncGenerator<StreamEvent, void, unknown>;
}
```

**如何新增模型？**
开发者只需实现一个新的 Provider 类，并将其注册到 `AiModule` 的 Provider 数组中即可，无需修改上游的调用逻辑。

## 2. 规则引擎与 PII 脱敏 (Rule Engine & Masking)

在企业环境中，防止源代码或内部员工信息泄露至关重要。

在 `AIGatewayService` 将 Prompt 真正发送给供应商之前，它会先调用 `RuleEngineService`：

1. **敏感词拦截**: 使用正则表达式或预定义的黑名单词库扫描 Prompt。
2. **脱敏处理**: 如果发现电话号码、身份证号或内部 IP 格式，规则引擎会将其替换为 `[REDACTED]`。
3. **阈值阻断**: 如果一段文本中出现的敏感词超过了配置的阈值，网关将直接抛出异常，并记录一条 `High Severity` 的安全审计日志 (Audit Log)。

## 3. Token 统计与审计 (Cost & Audit Logging)

每次调用模型结束后，系统都会执行后置拦截器记录详细的开销：

- **LlmRequestLog**: 每一次请求都会往 PostgreSQL 的 `llm_request_logs` 表插入一条记录，包含使用的模型、消耗的 `promptTokens`、`completionTokens` 以及基于费率表估算的 `estimated_cost`（以美元计）。
- **Prometheus Metrics**: Token 消耗也会实时增加到 Prometheus 的 `ai_token_usage_total` 计数器中，以便运维人员通过 Grafana 监控大盘。

## 4. RAG (检索增强生成) 与上下文构建

在学员请求帮助（Ask）时，系统并不只发送用户的输入，而是构建一个增强的上下文：

- **内容分块提取**: 将长文本或文档内容使用 `MarkdownChunker` 进行分块。
- **动态配置提取**: 从后台加载 `RAG_ENABLED`、`RAG_TOP_K` 和 `RAG_CHUNK_SIZE` 等系统配置，这些配置可以在 Web 管理后台 `/ai-settings` 页面中实时更改。
- **向量检索与混合**: 通过内存向量存储 (`MemoryVectorStore`) 进行语义检索，检索最相关的文档内容并追加到 Prompt 中，以引导模型给出更符合当前任务上下文的提示（Hints）。
