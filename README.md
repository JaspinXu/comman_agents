# 群像 · Persona Lab

一个把 Agent 当作“具体的人”设计的通用多 Agent 工作室。人格、外观、观念、场景和 MCP 权限都以透明字段呈现，能够审计、导出和继续扩展。

## 本地环境约定

本项目固定使用已有的 Conda 环境 `pytorch_env`：

```text
C:\Users\19826\anaconda3\envs\pytorch_env
```

不创建或使用 `venv`、`.venv`、其他 Conda 环境或 Python 虚拟环境。前端依赖仍由 npm 安装在项目的 `node_modules` 中，但 npm、Node 和验证命令都从 `pytorch_env` 执行。

已核对的环境版本：Python 3.11.9、Node 24.18.0、npm 11.18.0。

## 一键运行演示

在 PowerShell 中执行：

```powershell
cd G:\Codex\comman_agents
powershell -ExecutionPolicy Bypass -File .\scripts\run-demo.ps1
```

脚本会验证当前使用的是既有 `pytorch_env`，在缺少依赖时通过该环境执行 `npm ci`，随后启动开发服务器。看到地址后打开：

```text
http://localhost:3000/
```

停止服务请按 `Ctrl+C`。

## 一键完整验证

```powershell
cd G:\Codex\comman_agents
powershell -ExecutionPolicy Bypass -File .\scripts\verify-local.ps1
```

验证脚本会在 `pytorch_env` 中完成干净依赖安装、代码检查、生产构建和服务端渲染测试。它不会创建任何新环境。

如果已经在 Anaconda Prompt 中手动激活环境，也可以使用：

```powershell
conda activate pytorch_env
npm ci
npm run verify
npm run dev
```

## 当前可演示能力

- 三名具象 Agent：身份、职业、服装、表达、世界观和人格维度。
- 自定义人格特质，所有变更实时反映到 JSON 透明配置。
- 每名 Agent 独立授权 MCP 能力，并显示明确的工具 URI。
- 四种对话场景选择和一轮本地模拟对话。
- 配置导出和浏览器本地保存，无需 API Key 即可演示。
- 响应式桌面与移动端布局。

## 项目结构

```text
app/                 Persona Lab 页面、布局和样式
public/              favicon 与社交预览图
scripts/             固定使用 pytorch_env 的运行及验证入口
tests/               产品渲染与透明配置测试
worker/              vinext / Cloudflare Worker 入口
build/               Sites 的 Vite 集成
db/、examples/d1/    后续服务端持久化的可选脚手架，当前演示未启用
```

## SoC LaaS 适配边界

默认 Provider 预留为 `https://soclaas-api.comp.nus.edu.sg/v1`。未来服务端适配应动态读取 `/v1/models`，根据任务选择 Chat Completions 或 Responses，并由本项目持久化运行状态、执行 MCP 工具和处理 401、403、429、503。API Key 只能存放在服务端 Secret 中，不能写入浏览器存储或导出的 Persona 配置。

当前版本是可独立演示的交互原型，尚未发起真实 LLM 请求，因此本地演示不需要 SoC LaaS API Key。
