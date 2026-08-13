# comman_agents · 群像

`comman_agents` 是一个前后端完整的多 Agent 工作室。用户可以创建和删除人物，透明编辑每个 Agent 的身份、性格、服装、世界观、自定义特征和工具权限，并在统一故事背景下让多个 Agent 依次回答、互相补充或反驳。人物配置、对话和运行记录持久化到本地 SQLite。

## 技术结构

```text
浏览器 :3000
    │ REST + NDJSON 流式事件
    ▼
FastAPI :8000
    ├── Agent / 1v1 / 多 Agent API
    ├── SoC LaaS Chat Completions
    ├── Multi-Agent Orchestrator
    ├── Tool Registry（MCP 扩展边界）
    └── SQLite 持久化
```

- 前端：React 19、vinext、TypeScript
- 后端：Python、FastAPI、Pydantic、HTTPX
- 模型：SoC LaaS OpenAI-compatible API
- 数据：SQLite
- Python 环境：只使用现有 Conda 环境 `pytorch_env`

## 快速启动（在线 SoC API 模式）

### 1. 打开项目目录

在 PowerShell 中执行：

```powershell
Set-Location G:\Codex\comman_agents
```

无需手动执行 `conda activate`。项目脚本会始终通过 `conda run -n pytorch_env` 使用：

```text
C:\Users\19826\anaconda3\envs\pytorch_env
```

项目不会创建 `venv`、`.venv` 或新的 Conda 环境。

### 2. 首次安装依赖

确认 `pytorch_env` 已存在：

```powershell
conda env list
```

安装 Python 依赖：

```powershell
conda run --no-capture-output -n pytorch_env python -m pip install -r .\backend\requirements.txt
```

安装前端依赖：

```powershell
conda run --no-capture-output -n pytorch_env npm ci --ignore-scripts --no-audit --no-fund
```

依赖已安装时可以跳过本步骤；启动脚本发现 `node_modules` 不存在时也会自动执行 `npm ci`。

### 3. 配置 SoC LaaS API

首次运行时复制配置模板：

```powershell
Copy-Item .env.example .env
```

如果 `.env` 已存在，不要覆盖。编辑 `.env`：

```dotenv
SOCLAAS_API_KEY=clsk_你的真实密钥
SOCLAAS_BASE_URL=https://soclaas-api.comp.nus.edu.sg/v1
SOCLAAS_MODEL=qwen3.6:35b
SOCLAAS_TIMEOUT=90
COMMAN_AGENTS_DB=data/comman_agents.db
```

`.env` 已被 Git 忽略，真实密钥不会被提交。不要把 Key 写入 `.env.example`、源码或 README。

### 4. 启动整个项目

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-demo.ps1
```

脚本会依次：

1. 检查 Python 是否来自 `pytorch_env`。
2. 从 `.env` 读取 SoC API Key。
3. 启动 FastAPI 后端。
4. 等待 `/api/health` 就绪。
5. 启动前端开发服务器。

启动成功后访问：

- 工作室：http://localhost:3000/
- API 文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/api/health

终端应显示类似：

```text
Backend provider: soclaas / qwen3.6:35b
Starting web studio at http://localhost:3000/
```

### 5. 确认不是离线模式

另开一个 PowerShell 终端：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health |
  Select-Object provider, live_provider_configured, model
```

在线模式的预期结果：

```text
provider                 soclaas
live_provider_configured True
model                    qwen3.6:35b
```

如果显示 `local-demo`，说明运行进程没有读取到 `SOCLAAS_API_KEY`。检查 `.env` 是否位于项目根目录、变量名是否正确，然后按 `Ctrl+C` 停止并重新启动。

### 6. 停止项目

在运行启动脚本的终端按：

```text
Ctrl+C
```

脚本会同时清理它启动的 Python 后端进程。

## 常见启动问题

### 端口被占用

如果提示 `8000` 或 `3000` 已被使用，先停止旧的演示终端，再重新执行启动脚本。不要同时运行两个 `run-demo.ps1`。

### PowerShell 显示 `(base)`

这不会影响项目运行。启动和验证脚本都显式使用 `conda run -n pytorch_env`，实际 Python 路径会在启动时打印出来。可用以下命令独立确认：

```powershell
conda run --no-capture-output -n pytorch_env python -c "import sys; print(sys.executable)"
```

输出应为：

```text
C:\Users\19826\anaconda3\envs\pytorch_env\python.exe
```

### SoC API 调用失败

检查模型列表和 Key 是否有效：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/models
```

后端实际调用：

- `GET https://soclaas-api.comp.nus.edu.sg/v1/models`
- `POST https://soclaas-api.comp.nus.edu.sg/v1/chat/completions`

## 人物图片

当前创建新 Agent 时统一使用固定默认图片 `/agent-images/linxi.webp`，不会自动发送生图请求。已有图片和默认图片不依赖外部图像服务。

`qwen3.6:27b` 可通过 Chat Completions 接收图片并进行视觉理解，但当前 SoC API 不提供图像输出模型，因此不能用它生成头像。以后配置真正支持图像输出的服务后，可以使用：

```dotenv
IMAGEGEN_MODEL=生图模型ID
IMAGEGEN_API_KEY=图像服务密钥
IMAGEGEN_BASE_URL=https://图像服务/v1
```

若单独的 Key 和 Base URL 留空，生图模块会复用 SoC 配置，并在发现模型只有 `chat` 能力时明确拒绝，不会暗中切换到 GPT 模型。

## 完整验证

执行一次全栈验证：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-local.ps1
```

验证内容包括：

1. `pytorch_env` Python 路径。
2. 后端 Agent、SQLite、工具和多 Agent 编排测试。
3. 前端 ESLint。
4. vinext 生产构建。
5. 服务端页面渲染测试。

## 主要 API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | Provider、模型、数据库和工具状态 |
| GET / POST | `/api/agents` | 查询和创建 Agent |
| PUT / DELETE | `/api/agents/{id}` | 保存或永久删除 Agent |
| POST | `/api/agents/{id}/chat` | 与指定 Agent 进行 1v1 对话 |
| POST | `/api/agents/{id}/portrait` | 尝试按人物配置生成形象 |
| GET | `/api/models` | 查询 SoC Key 可见模型 |
| POST | `/api/tools/{name}/execute` | 按 Agent 权限执行工具 |
| POST | `/api/runs` | 发起多 Agent 对话并返回 NDJSON 事件流 |
| GET | `/api/runs` | 查询历史运行 |
| GET | `/api/runs/{id}` | 查询一次运行及其全部事件 |

## 项目目录

```text
app/
  page.tsx                  前端状态编排入口
  studio/
    api.ts                  API 客户端
    defaults.ts             默认数据
    types.ts                领域类型
    components/             页面组件
backend/
  main.py                   FastAPI 应用工厂
  api.py                    HTTP 路由
  runtime.py                依赖装配
  providers.py              SoC LaaS Provider
  orchestrator.py           多 Agent 编排器
  repository.py             SQLite 仓库
  prompts.py                Agent 提示词
  imagegen.py               可选图像服务边界
  tools.py                  工具注册边界
  tests/                    后端测试
scripts/
  run-demo.ps1              本地启动入口
  verify-local.ps1          全栈验证入口
data/                       本地 SQLite 和生成图片（Git 忽略）
tests/                      前端构建与渲染测试
worker/                     Sites / Cloudflare 前端入口
```

## MCP 与工具扩展

`backend/tools.py` 是本地工具注册边界，当前包含 `current_time`、`calculator` 和 `memory`。每个 Agent 只能看到自己配置中授权的工具。后续接入 MCP transport 时，应继续在该边界实施 schema 校验、授权和副作用审批。
