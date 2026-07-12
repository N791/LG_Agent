# 11. Quality Gate & Testing Strategy

本文档定义了 LG-Agent 项目的企业级测试策略与质量门禁规范。

## 1. 测试策略 (Testing Strategy)

本项目采用基于风险的测试策略（Risk-based Testing），而非单一的固定覆盖率。

### 1.1 覆盖率要求

- **核心平台模块 (Core Domain Services)**
  - **模块**: AI Gateway, Rule Engine, Schema Validation, Model Registry, Prompt Builder, Export Service, Cost Calculator
  - **目标**: `≥ 90%` Code Coverage
  - **策略**: 必须包含详尽的 Unit Test 和边界条件处理。
- **普通业务模块 (Business Services & Repositories)**
  - **模块**: Course Service, Task Service 等常规 CRUD 模块
  - **目标**: `≥ 80%` Code Coverage
- **Web 客户端 (React UI)**
  - **策略**: 不强制要求极高的单元测试覆盖率。重点通过 E2E (Playwright) 验证关键业务流程。

### 1.2 测试类型 (Testing Pyramid)

1.  **Unit Tests (Jest / Vitest)**: 测试单个函数或类的方法，完全 Mock 外部依赖。
2.  **Integration Tests (Jest + TestingModule)**: 测试模块间的组合，或连接真实测试数据库。
3.  **E2E Tests (Playwright)**: 在浏览器中端到端模拟用户操作。

---

## 2. 质量门禁 (Quality Gates)

质量门禁通过 `Husky` 和 `GitHub Actions` 强制执行。

### 2.1 Pre-Commit Gate (本地拦截)

通过 `lint-staged` 在提交前执行，必须通过：

- ESLint (代码规范校验)
- TypeScript Type Check (类型校验)
- Unit Test (受影响的代码)

### 2.2 Pull Request Gate (CI 拦截)

所有合并至主分支的 PR 必须在 GitHub Actions 中全量执行并全部通过：

- `turbo build`
- `eslint`
- `tsc --noEmit`
- `unit test & integration test`
- `playwright smoke test`
- `prisma validate & generate`

### 2.3 Main Branch (发布门禁)

合并到 Main 后，执行自动化部署流水线：

- Release / Semantic Versioning
- Deploy (Docker Build, Kubernetes/Server Deploy)

---

## 3. 测试目录规范

保持前后端一致的企业级测试目录结构：

### `@lg-agent/api`

```text
packages/api/test/
├── unit/         # 单元测试
├── integration/  # 集成测试
├── fixtures/     # 测试数据 (User, Course, Task 等)
├── mocks/        # 外部依赖 Mock (MockLLMProvider, MockRepository)
└── helpers/      # 测试助手 (TestFactory, TestDatabaseHelper)
```

### `@lg-agent/web`

```text
packages/web/tests/
├── e2e/          # Playwright 端到端测试 (POM, Smoke/Regression)
├── fixtures/     # 测试数据
├── pages/        # 页面组件测试
├── helpers/      # 测试助手
└── setup/        # 测试配置和初始化脚本
```

禁止将测试相关的辅助工具散落在业务模块的 `src` 目录下。

---

## 4. Testing Standards (测试规范)

建立统一测试质量标准，确保测试能够真实反映系统质量，而不是仅满足 CI 或覆盖率要求。

### 4.1 Testing Philosophy

采用 **Behavior-driven Testing（行为驱动测试）**。
每个测试都必须验证一个明确的业务行为（Behavior），而不是仅验证代码存在。
遵循 **AAA Pattern (Arrange -> Act -> Assert)** 保持测试结构统一。

### 4.2 Meaningful Tests

禁止提交无业务价值（Meaningless Tests）的测试。
❌ `expect(true).toBe(true)`
❌ 仅验证模块能够实例化（除 Framework Smoke Test 外）
❌ 没有任何业务断言的占位测试
❌ 仅为了提升 Coverage 而编写的测试

允许 **Framework Smoke Test**（例如：Module 正常启动、Controller 注册成功、Dependency Injection 正常），但必须数量有限，仅用于验证框架配置。

### 4.3 Testing Scaffold

对于尚未开发完成的模块，允许建立 Testing Scaffold：

- Test Directory
- Test File
- Mock Structure
- Fixtures
- Helper

Testing Scaffold 不等同于 Dummy Test。禁止使用无意义断言替代真实测试。

### 4.4 Smoke Test

所有已完成模块必须至少提供 **Smoke Test**。
例如：

- Service 基本调用成功
- Controller 返回正常响应
- Repository 完成 Mock CRUD
- AI Gateway 完成 Mock Provider 调用
- Rule Engine 完成规则匹配
- Prompt Engine 完成模板渲染

Smoke Test 应具备真实业务断言。

### 4.5 Progressive Testing Strategy

测试应随着功能同步演进。禁止项目完成后一次性补测试。
每个 Epic 完成时应同步完成：

- Unit Test
- Integration Test（适用时）
- E2E（关键业务流程）

保证持续集成始终具有真实质量反馈。

### 4.6 Test Quality Review

Code Review 时增加测试检查项：

- [ ] 是否验证真实业务行为
- [ ] 是否包含有效断言
- [ ] 是否存在 Meaningless Test
- [ ] 是否复用 Shared Fixtures
- [ ] 是否符合 AAA Pattern
- [ ] 是否符合 Mock Strategy

测试代码与业务代码具有相同质量要求。

### 4.7 Coverage Strategy

覆盖率不是唯一目标，采用 **Risk-based Coverage**。
建议：

- 核心平台模块：`≥ 90%`
- 普通业务模块：`≥ 80%`
- React 页面：重点保证关键业务流程，通过 Playwright E2E 验证。

### 4.8 CI Quality Gate

CI 中增加测试质量要求，禁止空测试、Dummy Test、无断言测试。
所有新增 Feature 必须伴随对应测试。未提供必要测试的 Pull Request 不应通过 Quality Gate。

---

## 5. Definition of Done (Testing)

每个 Epic 完成时至少满足：

- [x] Testing Scaffold 已建立
- [x] 新增业务逻辑具备 Unit Test
- [x] 核心模块具备 Smoke Test
- [x] 关键流程纳入 Integration Test（适用时）
- [x] 关键用户流程纳入 Playwright E2E（适用时）
- [x] Build、Test、CI 全部通过
