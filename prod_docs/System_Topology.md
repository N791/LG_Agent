# 生产环境高可用系统拓扑图 (System Topology)

LG-Agent 作为一个企业级的 AI 辅助学习平台，其生产环境部署依赖于高可用和可扩展的 Kubernetes 架构。

## 部署拓扑图

以下 Mermaid 图表展示了流量从外部客户端到内部微服务，再到持久化存储层的完整生命周期。

```mermaid
graph TD
    %% External Traffic
    subgraph External ["外部环境 (External)"]
        Users[导师 & 学员终端]
        CLI[LG-Agent CLI 客户端 (已废弃)]
        LLM_Providers((LLM 供应商<br/>OpenAI/DeepSeek))
    end

    %% Kubernetes Cluster
    subgraph K8s ["Kubernetes Cluster (Production)"]
        Ingress[Nginx Ingress Controller]

        %% Frontend Services
        subgraph Frontend ["前端服务组"]
            Web_Svc[Admin Web Console]
            Trainee_Svc[Trainee Web Workspace]
            Web_Pod(Web Pods)
            Trainee_Pod(Trainee Pods)
            Web_Svc --> Web_Pod
            Trainee_Svc --> Trainee_Pod
        end

        %% Backend Services
        subgraph Backend ["后端服务组 (API)"]
            API_Svc[API Service]
            API_Pod1(API Pod 1)
            API_Pod2(API Pod 2)
            API_Pod3(API Pod 3 - HPA 弹性伸缩)
            API_Svc --> API_Pod1
            API_Svc --> API_Pod2
            API_Svc -.-> API_Pod3
        end
    end

    %% Persistence Layer (Managed Services)
    subgraph CloudServices ["云托管基础设施 (Managed Cloud Services)"]
        RDS[(PostgreSQL / RDS<br/>多 AZ 高可用)]
        ElastiCache[(Redis / ElastiCache<br/>集群模式)]
        S3[(MinIO / AWS S3<br/>对象存储)]
    end

    %% Routing
    Users -->|HTTPS| Ingress
    CLI -.->|HTTPS| Ingress

    Ingress -->|/| Web_Svc
    Ingress -->|/workspace| Trainee_Svc
    Ingress -->|/api (HTTP/WS)| API_Svc

    %% Internal Connections
    API_Pod1 --> RDS
    API_Pod2 --> RDS

    API_Pod1 --> ElastiCache
    API_Pod2 --> ElastiCache

    API_Pod1 --> S3
    Web_Pod --> S3
    Trainee_Pod --> S3

    %% AI Outbound
    API_Pod1 -->|HTTPS Outbound| LLM_Providers
    API_Pod2 -->|HTTPS Outbound| LLM_Providers
```

## 拓扑说明

1. **流量入口**: 所有外部流量通过统一的 `Nginx Ingress` 进入集群，并根据路由规则分发到相应的 Service。静态资源请求路由至 Web Service，而数据与业务请求路由至 API Service。
2. **无状态计算节点**:
   - 前端 Web 节点主要负责托管由 Vite 构建的静态产物（包含 Admin Web 与 Trainee Workspace，基于 Nginx Alpine）。
   - 后端 API 节点运行 NestJS 服务。API 节点完全无状态，因此可以通过 HPA (Horizontal Pod Autoscaler) 根据 CPU/内存使用率或并发请求量进行弹性伸缩。
   - **WebSocket**: 沙盒执行日志 (Terminal) 需要通过 WebSocket 推送至前端 Trainee Workspace，需确保 Ingress 已配置支持 `Upgrade` 协议头，并正确设置超时时间。
3. **外部持久化存储**:
   - 为了确保数据的安全性和集群的轻量化，数据库（PostgreSQL）、缓存（Redis）和对象存储（MinIO/S3）不在 Kubernetes 内运行，而是依托于云服务提供商的托管服务（如 AWS RDS, ElastiCache 等），以保证跨可用区 (Multi-AZ) 的高可用。
4. **AI 外网请求**:
   - 后端 API 节点通过出网 NAT 与外部大型语言模型 (LLM) 提供商通信。建议为这些请求配置固定的出口 IP，以便在企业网络中进行统一的访问控制与审计。
