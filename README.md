# comman_agents · 群像

一个真正具备前后端运行链路的多 Agent 工作室。用户可以透明编辑每个 Agent 的身份、服装、人格、世界观和工具权限，设定一段共同故事背景，再连续向全体 Agent 提问。Python 编排器会让每位 Agent 依次回答，并允许后回答者主动回应、补充或反驳其他 Agent；完整运行记录会持久化。

## 架构

```text
React / vinext :3000
        │  REST + NDJSON streaming
        ▼
FastAPI :8000
        ├── Agent / Ensemble API
        ├── Multi-Agent Orchestrator
        ├── SoC LaaS Provider
        ├── Local Demo Provider
        ├── Tool Registry（MCP 扩展边界）
        └── SQLite（人物、故事背景、提问、发言事件）
```

后端不依赖前端保存状态。人物配置通过 `PUT /api/agents/{id}` 写入 SQLite；每轮提问都会携带故事背景与此前对话，生成独立 Run，并逐条保存背景、问题、发言和错误事件。

人物卡片形象并非通用占位图：后端会把职业、服装、世界观、核心特质、人格维度和人物色彩组合为透明的 ImageGen Prompt。创建新人物后前端自动请求生成；已有三位演示人物使用同一套配置生成的项目内置形象，因此未配置图像 Key 时仍可完整演示。每张人物卡片可直接进入该 Agent 的 1v1 对话。

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

## 连接人物 ImageGen

SoC DocHub 页面需要校内账号登录，当前无法从公开文档确认 SoC LaaS 是否提供图像生成端点。因此图像能力与 SoC 文本模型分开配置，默认使用兼容 `/images/generations` 的接口：

```dotenv
IMAGEGEN_API_KEY=你的图像服务密钥
IMAGEGEN_BASE_URL=https://api.openai.com/v1
IMAGEGEN_MODEL=gpt-image-2
```

新人物创建后会自动生成形象。人物配置更新后，可在右侧“身份”页按最新配置重新生成。Prompt 与最终图片地址会一并保存在 Agent 的透明配置中。未配置 Key 时不会伪装生成成功，接口会明确返回 `503`，同时已有演示人物仍使用项目内置生成图。

## API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | Provider、模型、数据库和工具状态 |
| GET/POST/PUT | `/api/agents`、`/api/agents/{id}` | 创建、读取和保存透明人物配置 |
| POST | `/api/agents/{id}/portrait` | 根据完整人物配置生成并保存形象 |
| POST | `/api/agents/{id}/chat` | 与指定 Agent 进行 1v1 对话 |
| GET | `/api/models` | 获取 SoC Key 可见模型或离线模型 |
| POST | `/api/tools/{name}/execute` | 按 Agent 授权执行本地工具 |
| POST | `/api/runs` | 基于故事背景和历史对话，让全部 Agent 依次回答并返回 NDJSON 事件流 |
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
