# API 设计规范 (API Guidelines)

LG-Agent 的后端 API 基于 **NestJS** 构建，遵循 RESTful 标准，并通过 OpenAPI (Swagger) 提供自动化的 API 文档和类型安全契约。

## 1. 路由与命名规范

- **基础前缀**: 所有的业务 API 都必须以 `/api/v1` 作为路由前缀（通常在 `main.ts` 中通过全局前缀配置）。
- **资源命名**: 路由应当是名词复数。
  - ✅ `/api/v1/courses`
  - ✅ `/api/v1/courses/:courseId/tasks`
  - ❌ `/api/v1/getCourse`

## 2. 请求入参校验 (DTO & ValidationPipe)

我们严格采用白名单模式过滤掉不受信任的请求负载。所有的入参必须使用 `class-validator` 配合 `Data Transfer Object (DTO)` 进行定义。

```typescript
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ description: '任务标题', example: '初识 Node.js' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;
}
```

所有的 DTO 定义必须放在 `@lg-agent/contracts` 包中，以便前端和 CLI 工具可以直接复用这些类型，保持单一真实数据源。

## 3. 标准响应格式与错误处理

不要手动构造包含 `code` 和 `data` 的响应体，请利用 NestJS 内置的 HTTP 状态码。

- **成功响应**:
  - `200 OK`: 用于绝大多数 GET/PUT 成功请求。
  - `201 Created`: 仅用于 POST 请求成功创建资源时。
- **异常响应**:
  - 如果业务逻辑发生可预期的错误，请抛出适当的 `HttpException` (如 `BadRequestException`, `NotFoundException`)。NestJS 的全局过滤器会自动将它们序列化为标准格式：

```json
{
  "statusCode": 400,
  "message": ["title must be shorter than or equal to 100 characters"],
  "error": "Bad Request"
}
```

## 4. Swagger 文档生成

我们使用 `@nestjs/swagger` 根据装饰器自动生成 OpenAPI 规范文件 (`swagger.json`)。在本地开发时，可以通过访问 `http://localhost:3000/api/docs` 查看交互式接口文档。

开发者有责任在编写每一个 Controller 和 DTO 属性时，附加必要的 `@ApiOperation` 和 `@ApiProperty` 装饰器，以便前端开发人员可以清晰地了解接口的作用和数据结构。
