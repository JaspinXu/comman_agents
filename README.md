# comman_agents · 群像

一个真正具备前后端运行链路的多 Agent 工作室。用户可以透明编辑每个 Agent 的身份、服装、人格、世界观和工具权限，再把多名 Agent 放进场景，由 Python 编排器逐个调用模型、实时返回事件并将完整运行记录持久化。

## 架构

```text
React / vinext :3000
        │  REST + NDJSON streaming
        ▼
FastAPI :8000
        ├── Agent / Scene API
        ├── Multi-Agent Orchestrator
        ├── SoC LaaS Provider
        ├── Local Demo Provider
        ├── Tool Registry（MCP 扩展边界）
        └── SQLite（人物、场景、运行、事件）
```

后端不依赖前端保存状态。人物配置通过 `PUT /api/agents/{id}` 写入 SQLite；每次场景运行生成独立 Run，并逐条保存状态、发言和错误事件。

## 固定使用 pytorch_env

项目只使用已有环境：

```text
C:\Users\19826\anaconda3\envs\pytorch_env
```

不会创建 `venv`、`.venv` 或其他 Conda 环境。当前环境已具备 FastAPI、Uvicorn、HTTPX、Pydantic 和 OpenAI SDK；SQLite 使用 Python 标准库。

## 本地运行

```powershell
cd G:\Codex\comman_agents
powershell -ExecutionPolicy Bypass -File .\scripts\run-demo.ps1
```

脚本会在 `pytorch_env` 中启动两个服务，并在退出时清理 Python 后端进程：

- Web 工作室：[http://localhost:3000](http://localhost:3000)
- Python API：[http://127.0.0.1:8000](http://127.0.0.1:8000)
- Swagger 文档：[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

按 `Ctrl+C` 停止。若提示端口被占用，应先停止旧的演示进程，不要重复启动。

## 连接 SoC LaaS

复制示例配置：

```powershell
Copy-Item .env.example .env
```

编辑 `.env`：

```dotenv
SOCLAAS_API_KEY=clsk_你的真实密钥
SOCLAAS_BASE_URL=https://soclaas-api.comp.nus.edu.sg/v1
SOCLAAS_MODEL=qwen3.6:35b
```

不要把真实 Key 提交到 Git。`.env` 已被忽略，只有不含秘密的 `.env.example` 会被提交。

重启项目后，`GET /api/health` 的结果应包含：

```json
{
  "provider": "soclaas",
  "live_provider_configured": true,
  "model": "qwen3.6:35b"
}
```

后端会使用 Bearer Token 调用：

- `GET https://soclaas-api.comp.nus.edu.sg/v1/models`
- `POST https://soclaas-api.comp.nus.edu.sg/v1/chat/completions`

Key 未配置时，系统明确显示 `local-demo`，使用离线规则引擎完成整个编排、流式返回和持久化链路，不会伪装成真实模型回答。

## API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | Provider、模型、数据库和工具状态 |
| GET/PUT | `/api/agents`、`/api/agents/{id}` | 读取和保存透明人物配置 |
| GET | `/api/scenes` | 获取场景定义 |
| GET | `/api/models` | 获取 SoC Key 可见模型或离线模型 |
| POST | `/api/tools/{name}/execute` | 按 Agent 授权执行本地工具 |
| POST | `/api/runs` | 启动多 Agent 运行，返回 NDJSON 事件流 |
| GET | `/api/runs` | 查询历史运行 |
| GET | `/api/runs/{id}` | 查询一次运行及全部事件 |

## MCP 与工具扩展

`backend/tools.py` 是安全工具注册边界。当前提供：

- `current_time`
- `calculator`（AST 白名单计算，不使用 `eval`）
- `memory`（声明持久化记忆能力）

新的本地工具或 MCP Client 可以注册到 `ToolRegistry`。每个 Agent 只看到自己配置中授权的工具。当前 SoC Chat Completions 回合不会自动执行工具，避免模型文本触发未经确认的本地副作用；后续可在该边界加入严格 schema、审批和 MCP transport。

## 完整验证

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-local.ps1
```

验证内容：

1. 确认 Python 来自 `pytorch_env`。
2. 后端 SQLite、人物持久化、安全计算器、多 Agent 运行测试。
3. 前端 ESLint。
4. vinext 生产构建。
5. 服务端产品页面渲染测试。

## 目录

```text
app/                    React 工作室
backend/
  main.py               FastAPI 路由
  models.py             透明领域模型
  repository.py         SQLite 仓库
  providers.py          SoC LaaS / 离线 Provider
  orchestrator.py       多 Agent 运行引擎
  tools.py              MCP 工具注册边界
  tests/                Python 后端测试
scripts/                pytorch_env 启动与验证入口
data/                   本地 SQLite 数据（Git 忽略）
tests/                   前端构建与渲染测试
```
