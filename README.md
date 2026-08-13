# 群像 · Persona Lab

一个把 Agent 当作“具体的人”来设计的通用多 Agent 工作室。首版重点验证三件事：人格配置完全透明、对话场景可以编排、模型与 MCP 工具可以替换。

## 产品模型

- **Persona**：身份、职业、外观、服装、表达方式、世界观、人格维度与自定义特质。
- **Capability**：每个 Agent 独立授权 MCP 工具；授权状态和每次调用都应可审计。
- **Scene**：目标、阶段、参与者、发言规则、终止条件和产出格式。
- **Relationship**：角色之间的信任、分歧、权力和历史；下一阶段加入。
- **Provider**：推理服务适配层，不让 Persona 或 Scene 依赖某一家模型厂商。
- **Run**：一次场景执行的事件流；应由本项目持久化，而不是依赖模型网关的临时状态。

## SoC LaaS 适配

默认 Provider 预留为 `https://soclaas-api.comp.nus.edu.sg/v1`。它提供 OpenAI 兼容的模型列表、Chat Completions 与 Responses API，支持 SSE；function/custom/shell/apply_patch 等工具由客户端执行，正好适合让本项目承担 MCP 编排。

实现服务端适配时应：

1. 从 `GET /v1/models` 动态读取当前 API Key 可见模型，不硬编码模型清单。
2. 普通对话优先走 `/v1/chat/completions`；需要 Responses 兼容工具回合时走 `/v1/responses`。
3. 不依赖 `previous_response_id` 做长期记忆；网关状态只有约 15 分钟且重启后不保留。
4. 对 401、403、429、503 做结构化错误处理，并尊重 10 RPM 与预算窗口。
5. API Key 仅存放在服务端 Secret 中，绝不写进浏览器存储或导出的 Persona 配置。

## 当前版本

当前是交互式产品原型：支持成员切换、人格字段编辑、人格滑杆、自定义特质、逐 Agent 工具授权、场景切换、模拟对话、JSON 透明视图、配置导出和设备本地保存。真实 LLM 调用、服务端持久化、MCP transport 与关系图谱是下一阶段。

```bash
npm run dev
npm run build
```
