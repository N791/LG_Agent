# 平台安全与防护指南 (Security Guide)

LG-Agent 作为一个企业级平台，处理着大量的用户数据和商业机密（如敏感的代码、提示词和模型凭据）。本指南列出了在生产环境中部署时必须遵循的安全最佳实践。

## 1. 凭据与 Secret 管理

在任何情况下，**绝对不要**将密码、API Key 等敏感信息硬编码到代码或配置文件中，也**不要**明文存放在 Helm Chart 的 `values.yaml` 中。

- **Kubernetes Secrets**: 所有的环境变量中涉及凭据的部分（如 `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`）必须通过 Kubernetes Secrets 注入。
- **Secret 注入方案**: 我们推荐使用 External Secrets Operator (ESO) 或 HashiCorp Vault 进行自动化注入，而不是手动创建 Secret。

## 2. 身份验证与 RBAC

平台内置了严格的基于角色的访问控制 (Role-Based Access Control, RBAC)。

- **JWT 签名**: 必须使用长度至少为 256 位的强随机字符串作为 `JWT_SECRET`，并定期轮换。
- **Redis 黑名单**: 用户登出后，其 JWT Token 会被立即加入 Redis 黑名单，直到过期。因此，Redis 的高可用性对安全拦截至关重要。
- **角色权限**:
  - `ADMIN`: 平台管理员，拥有全部权限。
  - `MENTOR`: 导师，仅能管理自身创建的课程和查看归属学员的数据。
  - `TRAINEE`: 学员，仅能拉取任务和提交作业。

## 3. 敏感信息防泄漏 (PII Masking)

为了防止学员在与 AI 导师交互时泄露企业敏感信息，LG-Agent 内置了**数据防泄漏 (DLP)** 机制。

- **规则引擎拦截**: 在 Prompt 发送到外部模型提供商（如 OpenAI）之前，平台会经过内部的规则引擎。
- **默认过滤**: 默认会通过正则表达式过滤身份证号、手机号、企业内网 IP 和常见密钥格式。
- **自定义词库**: 管理员可以通过控制台配置企业特定的敏感词库。当命中的敏感词触发拦截阈值时，该 AI 请求将被直接阻断并生成审计告警。

## 4. 网络安全与隔离

- **Nginx Ingress**: 应开启 SSL/TLS 终止，并配置强化的 Cipher Suite。
- **内部网络隔离**:
  - Web 节点和 API 节点不应直接暴露给公网。
  - 数据库 (PostgreSQL) 和 缓存 (Redis) 必须放在私有子网 (Private Subnet) 中，仅允许 API 节点的安全组/网络策略 (Network Policy) 访问。
- **出站流量 (Outbound)**: 限制 API 节点只能访问指定的外部域名（如 `api.openai.com`）。

## 5. 沙盒安全性 (Sandbox Security)

当学员通过 CLI 提交代码时，系统会在沙盒中执行这些不受信任的代码。

- **进程隔离**: 评测沙盒必须运行在与主业务集群物理/逻辑隔离的环境中。
- **权限限制**: 沙盒容器以只读文件系统和 `nobody` 权限运行，并且必须禁用外网访问权限 (`--network none`)，以防恶意代码执行网络攻击或内网穿透。
