"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Sliders = { autonomy: number; empathy: number; creativity: number; rigor: number };
type Agent = {
  id: string; name: string; englishName: string; role: string; color: string;
  initials: string; quote: string; outfit: string; worldview: string;
  traits: string[]; sliders: Sliders; tools: string[]; portraitUrl?: string | null; portraitPrompt?: string | null;
};
type ToolManifest = { id: string; label: string; description: string; uri: string };
type Health = { status: string; provider: string; live_provider_configured: boolean; model: string; tools: ToolManifest[]; image_provider: string; image_generation_configured: boolean };
type RunEvent = { type: "status" | "message" | "tool" | "error" | "complete"; agent_id?: string; agent_name?: string; content: string; metadata?: Record<string, unknown> };
type NewAgentDraft = { name: string; role: string; englishName: string; initials: string; color: string };
type ChatMessage = { role: "user" | "assistant"; content: string };
type EnsembleLine = { speaker_type: "user" | "agent" | "system"; name: string; content: string; agent_id?: string };

const seedAgents: Agent[] = [
  { id: "linxi", name: "林溪", englishName: "LIN XI", role: "用户研究员", color: "#3155d9", initials: "溪", quote: "我关注真实的用户需求，用证据推动决策。", outfit: "钴蓝针织背心、白衬衫、银色耳钉", worldview: "好问题比过早的答案更有价值。证据优先，但不忽略人的感受。", traits: ["好奇", "严谨", "善于提问"], sliders: { autonomy: 72, empathy: 84, creativity: 61, rigor: 88 }, tools: ["current_time", "calculator", "memory"], portraitUrl: "/agent-images/linxi.webp" },
  { id: "chengye", name: "程野", englishName: "CHENG YE", role: "系统架构师", color: "#24231f", initials: "野", quote: "我设计可扩展的系统，让复杂变得有序。", outfit: "石墨色工装衬衫、圆框眼镜、机械表", worldview: "所有抽象都应当经得起边界条件的追问，可靠性也是一种善意。", traits: ["系统性", "可靠", "长远思维"], sliders: { autonomy: 86, empathy: 46, creativity: 68, rigor: 94 }, tools: ["calculator", "memory"], portraitUrl: "/agent-images/chengye.webp" },
  { id: "shenzhi", name: "沈知", englishName: "SHEN ZHI", role: "共创引导者", color: "#ef5b38", initials: "知", quote: "我让每个人的想法被看见，一起创造更好的答案。", outfit: "朱红围巾、米白亚麻上衣、金色耳环", worldview: "分歧不是噪音，而是尚未被组织起来的创造力。", traits: ["共情", "开放", "激发创意"], sliders: { autonomy: 64, empathy: 95, creativity: 91, rigor: 58 }, tools: ["current_time", "memory"], portraitUrl: "/agent-images/shenzhi.webp" },
];
const fallbackTools: ToolManifest[] = [
  { id: "current_time", label: "Current Time", description: "返回当前 UTC 时间", uri: "mcp://local/current_time" },
  { id: "calculator", label: "Calculator", description: "安全算术计算", uri: "mcp://local/calculator" },
  { id: "memory", label: "Memory", description: "持久化运行记忆", uri: "mcp://local/memory" },
];
const sliderLabels: Record<keyof Sliders, string> = { autonomy: "自主性", empathy: "共情倾向", creativity: "创造力", rigor: "严谨性" };
const blankAgent: NewAgentDraft = { name: "", role: "", englishName: "", initials: "", color: "#6b5cff" };

function apiBase(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8000";
  return `http://${window.location.hostname}:8000`;
}

export default function Home() {
  const [agents, setAgents] = useState(seedAgents);
  const [health, setHealth] = useState<Health | null>(null);
  const [selectedId, setSelectedId] = useState(seedAgents[0].id);
  const [tab, setTab] = useState<"identity" | "mind" | "tools" | "json">("identity");
  const [storyBackground, setStoryBackground] = useState("三位成员正在共同参与一次开放讨论。他们拥有不同专业背景，可以互相补充、追问或反驳，并需要在保留各自立场的同时推动讨论向前发展。");
  const [question, setQuestion] = useState("");
  const [ensembleConversation, setEnsembleConversation] = useState<EnsembleLine[]>([]);
  const [running, setRunning] = useState(false);
  const [newTrait, setNewTrait] = useState("");
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgentDraft>(blankAgent);
  const [createError, setCreateError] = useState("");
  const [generatingPortraits, setGeneratingPortraits] = useState<string[]>([]);
  const [portraitErrors, setPortraitErrors] = useState<Record<string, string>>({});
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const saveTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${apiBase()}/api/health`).then((response) => response.ok ? response.json() : Promise.reject(new Error("后端不可用"))),
      fetch(`${apiBase()}/api/agents`).then((response) => response.json()),
    ]).then(([healthData, agentData]: [Health, Agent[]]) => {
      if (!active) return;
      setHealth(healthData); setAgents(agentData);
      agentData.filter((agent) => !agent.portraitUrl).forEach((agent) => { void generatePortrait(agent.id); });
    }).catch(() => { /* The provider badge remains in its connecting state. */ });
    return () => { active = false; };
  }, []);

  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0];
  const chatAgent = agents.find((agent) => agent.id === chatAgentId) ?? null;
  const tools = health?.tools ?? fallbackTools;
  const jsonConfig = useMemo(() => JSON.stringify({ schema: "comman_agents/v1", agent: selected }, null, 2), [selected]);

  function persistAgent(agent: Agent) {
    window.clearTimeout(saveTimers.current[agent.id]);
    saveTimers.current[agent.id] = window.setTimeout(async () => {
      try {
        const response = await fetch(`${apiBase()}/api/agents/${agent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(agent) });
        if (!response.ok) throw new Error(await response.text());
      } catch { /* A later edit retries persistence. */ }
    }, 450);
  }

  function updateSelected(patch: Partial<Agent>) {
    const updated = { ...selected, ...patch };
    setAgents((current) => current.map((agent) => agent.id === selected.id ? updated : agent));
    persistAgent(updated);
  }

  function toggleTool(id: string) {
    updateSelected({ tools: selected.tools.includes(id) ? selected.tools.filter((tool) => tool !== id) : [...selected.tools, id] });
  }

  function portraitSrc(agent: Agent): string {
    if (!agent.portraitUrl) return "";
    return agent.portraitUrl.startsWith("/api/") ? `${apiBase()}${agent.portraitUrl}` : agent.portraitUrl;
  }

  async function generatePortrait(agentId: string) {
    setGeneratingPortraits((current) => current.includes(agentId) ? current : [...current, agentId]);
    setPortraitErrors((current) => ({ ...current, [agentId]: "" }));
    try {
      const response = await fetch(`${apiBase()}/api/agents/${agentId}/portrait`, { method: "POST" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail ?? "形象生成失败");
      const updated = await response.json() as Agent;
      setAgents((current) => current.map((agent) => agent.id === updated.id ? updated : agent));
    } catch (error) {
      setPortraitErrors((current) => ({ ...current, [agentId]: error instanceof Error ? error.message : "形象生成失败" }));
    } finally {
      setGeneratingPortraits((current) => current.filter((id) => id !== agentId));
    }
  }

  function openChat(agent: Agent) {
    setSelectedId(agent.id);
    setChatAgentId(agent.id);
    setChatMessages([]);
    setChatInput("");
  }

  async function sendChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatAgent || !chatInput.trim() || chatting) return;
    const message = chatInput.trim();
    const history = chatMessages;
    setChatMessages((current) => [...current, { role: "user", content: message }]);
    setChatInput("");
    setChatting(true);
    try {
      const response = await fetch(`${apiBase()}/api/agents/${chatAgent.id}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail ?? "对话失败");
      const data = await response.json() as { reply: string };
      setChatMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setChatMessages((current) => [...current, { role: "assistant", content: `暂时无法回复：${error instanceof Error ? error.message : "未知错误"}` }]);
    } finally { setChatting(false); }
  }

  async function askEnsemble(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const background = storyBackground.trim();
    const prompt = question.trim();
    if (!background || !prompt || running) return;
    const history = ensembleConversation.filter((line) => line.speaker_type !== "system");
    setEnsembleConversation((current) => [...current, { speaker_type: "user", name: "你", content: prompt }]);
    setQuestion("");
    setRunning(true);
    try {
      const response = await fetch(`${apiBase()}/api/runs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background, prompt, agent_ids: agents.map((agent) => agent.id), history }),
      });
      if (!response.ok || !response.body) throw new Error(await response.text());
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) {
          const event = JSON.parse(line) as RunEvent;
          if (event.type === "message") {
            setEnsembleConversation((current) => [...current, { speaker_type: "agent", agent_id: event.agent_id, name: event.agent_name ?? "Agent", content: event.content }]);
          } else if (event.type === "error") {
            setEnsembleConversation((current) => [...current, { speaker_type: "system", name: "系统", content: event.content }]);
          }
        }
        if (done) break;
      }
    } catch (error) {
      setEnsembleConversation((current) => [...current, { speaker_type: "system", name: "系统", content: `无法运行：${error instanceof Error ? error.message : "未知错误"}` }]);
    } finally { setRunning(false); }
  }

  async function createAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    const name = newAgent.name.trim();
    const role = newAgent.role.trim();
    if (!name || !role) { setCreateError("姓名和角色不能为空。"); return; }
    const agent: Agent = {
      id: `agent_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      name,
      englishName: newAgent.englishName.trim() || `AGENT ${agents.length + 1}`,
      role,
      color: newAgent.color,
      initials: newAgent.initials.trim().slice(0, 4) || name.slice(0, 1),
      quote: "我会以自己的经验和判断参与这场对话。",
      outfit: "尚未设置，可在创建后继续补充。",
      worldview: "保持独立判断，尊重事实，并对自己的建议负责。",
      traits: ["独立", "开放"],
      sliders: { autonomy: 70, empathy: 65, creativity: 70, rigor: 70 },
      tools: ["memory"],
    };
    try {
      const response = await fetch(`${apiBase()}/api/agents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(agent) });
      if (!response.ok) throw new Error(await response.text());
      const created = await response.json() as Agent;
      setAgents((current) => [...current, created]);
      setSelectedId(created.id);
      setTab("identity");
      setNewAgent(blankAgent);
      setCreatingAgent(false);
      void generatePortrait(created.id);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "创建失败，请检查 Python 后端。");
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-block"><span className="brand-name">comman agents</span></div>
      <nav className="primary-nav" aria-label="主导航"><button className="nav-item active">工作室</button><button className="nav-item">运行记录</button></nav>
      <div className="top-actions"><div className={`provider-pill ${health ? "online" : ""}`}><i /> {health?.provider === "soclaas" ? "SoC LaaS" : "Local Engine"} <span>{health?.model ?? "connecting"}</span></div><a className="icon-button api-doc" href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer" aria-label="打开后端 API 文档">API</a><button className="avatar-mini">ZB</button></div>
    </header>
    <section className="workspace">
      <aside className="rail">
        <div className="rail-heading"><span>你的成员</span><b>{agents.length}</b></div>
        <div className="agent-rail-list">{agents.map((agent) => <button key={agent.id} className={`rail-agent ${agent.id === selected.id ? "selected" : ""}`} onClick={() => setSelectedId(agent.id)}><span className="rail-avatar" style={{ background: agent.color }}>{agent.initials}</span><span><strong>{agent.name}</strong><small>{agent.role}</small></span><i aria-hidden="true" /></button>)}</div>
        <button className="add-agent" onClick={() => setCreatingAgent(true)}><span>＋</span> 添加新人物</button>
      </aside>
      <section className="canvas">
        <div className="canvas-head"><div><span className="eyebrow">ENSEMBLE / LIVE</span><h1>产品共创小组</h1><p>由 Python 编排器驱动，运行与发言持久化到 SQLite。</p></div><div className="presence"><span className="stacked-avatars">{agents.map((agent) => <i key={agent.id} style={{ background: agent.color }}>{agent.initials}</i>)}</span><b>{health ? "后端在线" : "等待后端"}</b></div></div>
        <div className="people-grid">{agents.map((agent) => <article key={agent.id} className={`person-card ${agent.id === selected.id ? "focused" : ""}`} style={{ "--agent": agent.color } as React.CSSProperties}><button className="portrait" onClick={() => setSelectedId(agent.id)} aria-label={`编辑 ${agent.name} 的人物配置`}>{portraitSrc(agent) ? <img src={portraitSrc(agent)} alt={`${agent.name}，${agent.role}`} /> : <span className="portrait-pending"><b>{generatingPortraits.includes(agent.id) ? "生成中…" : agent.initials}</b><small>{portraitErrors[agent.id] || "Agent 正在准备自己的形象"}</small></span>}</button><div className="person-actions"><h2>{agent.name}</h2><button onClick={() => openChat(agent)} aria-label={`与 ${agent.name} 进行一对一对话`}>1v1 对话 <span>→</span></button></div></article>)}</div>
        <section className="ensemble-section">
          <div className="section-title"><div><span className="eyebrow">STORY BACKGROUND</span><h2>设定所有人共同身处的背景</h2></div><span className="conversation-rule">依次回答 · 自主交流</span></div>
          <label className="background-field"><span>整体故事背景</span><textarea value={storyBackground} onChange={(event) => setStoryBackground(event.target.value)} placeholder="例如：三位成员受邀来到一座封闭研究站，需要在资源有限的情况下共同作出决定……" aria-label="整体故事背景" /><small>这个背景会在每一轮完整提供给所有 Agent。后回答者能看到前面成员的发言，可以主动补充、追问或反驳。</small></label>
          {ensembleConversation.length > 0 && <div className="ensemble-stream" aria-live="polite">{ensembleConversation.map((line, index) => { const agent = line.agent_id ? agents.find((item) => item.id === line.agent_id) : null; return <div key={`${line.speaker_type}-${index}`} className={`ensemble-line ${line.speaker_type}`}>{line.speaker_type === "agent" && agent ? <span className="line-avatar" style={{ background: agent.color }}>{agent.initials}</span> : <span className="line-avatar neutral">{line.speaker_type === "user" ? "你" : "!"}</span>}<div><small>{line.name}</small><p>{line.content}</p></div></div>; })}{running && <div className="ensemble-thinking"><span /><span /><span /> Agent 正在依次思考与回应…</div>}</div>}
          <form className="ensemble-composer" onSubmit={askEnsemble}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="在这个背景下，向所有 Agent 提问……" aria-label="向所有 Agent 提问" /><button type="submit" disabled={running || !health || !storyBackground.trim() || !question.trim()}><span>{running ? "…" : "↑"}</span>{running ? "回答中" : "问所有人"}</button></form>
        </section>
      </section>
      <aside className="inspector">
        <div className="inspector-head"><div><span className="inspector-avatar" style={{ background: selected.color }}>{selected.initials}</span><span><strong>{selected.name}</strong><small>{selected.role}</small></span></div><span className="db-mark">SQLite</span></div>
        <div className="tabs" role="tablist"><button className={tab === "identity" ? "active" : ""} onClick={() => setTab("identity")}>身份</button><button className={tab === "mind" ? "active" : ""} onClick={() => setTab("mind")}>内心</button><button className={tab === "tools" ? "active" : ""} onClick={() => setTab("tools")}>能力</button><button className={tab === "json" ? "active" : ""} onClick={() => setTab("json")}>{"{ }"}</button></div>
        {tab === "identity" && <div className="panel-body"><label className="field"><span>角色 / 职业</span><input value={selected.role} onChange={(event) => updateSelected({ role: event.target.value })} /></label><label className="field"><span>外观与服装</span><textarea value={selected.outfit} onChange={(event) => updateSelected({ outfit: event.target.value })} /></label><label className="field"><span>代表性表达</span><textarea value={selected.quote} onChange={(event) => updateSelected({ quote: event.target.value })} /></label><div className="portrait-control"><span className="eyebrow">AGENT IMAGEGEN</span><b>形象来自完整人物配置</b><p>创建人物时自动生成；修改性格或服装后，可按最新配置重新生成。</p><button onClick={() => void generatePortrait(selected.id)} disabled={generatingPortraits.includes(selected.id)}>{generatingPortraits.includes(selected.id) ? "正在生成形象…" : "根据最新配置重新生成"}</button>{portraitErrors[selected.id] && <small>{portraitErrors[selected.id]}</small>}</div><div className="callout"><b>服务端透明持久化</b><p>字段通过 PUT /api/agents/:id 写入 SQLite，没有隐藏人格层。</p></div></div>}
        {tab === "mind" && <div className="panel-body"><label className="field"><span>世界观 / 判断原则</span><textarea className="tall" value={selected.worldview} onChange={(event) => updateSelected({ worldview: event.target.value })} /></label><div className="slider-group">{(Object.keys(sliderLabels) as (keyof Sliders)[]).map((key) => <label className="slider" key={key}><span>{sliderLabels[key]} <b>{selected.sliders[key]}</b></span><input type="range" min="0" max="100" value={selected.sliders[key]} onChange={(event) => updateSelected({ sliders: { ...selected.sliders, [key]: Number(event.target.value) } })} /></label>)}</div><div className="trait-editor"><span>核心特质</span><div>{selected.traits.map((trait) => <button key={trait} onClick={() => updateSelected({ traits: selected.traits.filter((item) => item !== trait) })}>{trait} ×</button>)}</div><form onSubmit={(event) => { event.preventDefault(); if (newTrait.trim()) { updateSelected({ traits: [...selected.traits, newTrait.trim()] }); setNewTrait(""); } }}><input placeholder="添加一个特质" value={newTrait} onChange={(event) => setNewTrait(event.target.value)} /><button>＋</button></form></div></div>}
        {tab === "tools" && <div className="panel-body"><div className="tool-summary"><span><b>{selected.tools.length}</b> 个能力已授权</span><small>Python 工具注册边界</small></div><div className="tool-list">{tools.map((tool) => <button key={tool.id} className={selected.tools.includes(tool.id) ? "enabled" : ""} onClick={() => toggleTool(tool.id)}><i>{tool.id.slice(0, 2)}</i><span><b>{tool.label}</b><small>{tool.uri}</small></span><em>{selected.tools.includes(tool.id) ? "已允许" : "未授权"}</em></button>)}</div></div>}
        {tab === "json" && <div className="panel-body json-panel"><div className="json-head"><span>comman_agents.config.json</span><button onClick={() => navigator.clipboard?.writeText(jsonConfig)}>复制</button></div><pre>{jsonConfig}</pre><p>界面中的每一项都能在这里找到对应字段。</p></div>}
        <div className="provider-card"><div><span className="status-dot" /><b>{health?.provider === "soclaas" ? "SoC LaaS 已连接" : "离线模式"}</b></div><code>Python :8000 → {health?.model ?? "等待连接"}</code><p>{health?.live_provider_configured ? "真实模型推理 · SQLite 运行记录 · 本地工具边界" : "设置 SOCLAAS_API_KEY 后重启即可启用真实推理"}</p></div>
      </aside>
    </section>
    {creatingAgent && <div className="modal-backdrop">
      <section className="create-agent-modal" role="dialog" aria-modal="true" aria-labelledby="create-agent-title">
        <div className="modal-head"><div><span className="eyebrow">NEW PERSON</span><h2 id="create-agent-title">创建一个具体的人</h2></div><button type="button" onClick={() => setCreatingAgent(false)} aria-label="关闭创建人物对话框">×</button></div>
        <p className="modal-intro">先定义基本身份。创建后可以继续完善服装、世界观、人格维度和工具权限。</p>
        <form className="create-agent-form" onSubmit={createAgent}>
          <label className="field"><span>姓名 *</span><input maxLength={80} value={newAgent.name} onChange={(event) => setNewAgent({ ...newAgent, name: event.target.value })} placeholder="例如：许墨" /></label>
          <label className="field"><span>角色 / 职业 *</span><input maxLength={120} value={newAgent.role} onChange={(event) => setNewAgent({ ...newAgent, role: event.target.value })} placeholder="例如：商业分析师" /></label>
          <div className="form-row"><label className="field"><span>英文名</span><input maxLength={80} value={newAgent.englishName} onChange={(event) => setNewAgent({ ...newAgent, englishName: event.target.value })} placeholder="XU MO" /></label><label className="field initials-field"><span>头像字</span><input maxLength={4} value={newAgent.initials} onChange={(event) => setNewAgent({ ...newAgent, initials: event.target.value })} placeholder="墨" /></label></div>
          <label className="color-field"><span>人物色彩</span><input type="color" value={newAgent.color} onChange={(event) => setNewAgent({ ...newAgent, color: event.target.value })} /><b style={{ background: newAgent.color }}>{newAgent.initials || newAgent.name.slice(0, 1) || "新"}</b><code>{newAgent.color}</code></label>
          {createError && <p className="form-error" role="alert">{createError}</p>}
          <div className="modal-actions"><button type="button" onClick={() => setCreatingAgent(false)}>取消</button><button type="submit">创建并继续完善 →</button></div>
        </form>
      </section>
    </div>}
    {chatAgent && <div className="chat-backdrop">
      <section className="chat-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
        <header className="chat-head"><div>{portraitSrc(chatAgent) ? <img src={portraitSrc(chatAgent)} alt="" /> : <span style={{ background: chatAgent.color }}>{chatAgent.initials}</span>}<div><small>1 : 1 CONVERSATION</small><h2 id="chat-title">与 {chatAgent.name} 对话</h2><p>{chatAgent.role}</p></div></div><button onClick={() => setChatAgentId(null)} aria-label="关闭一对一对话">×</button></header>
        <div className="chat-stream" aria-live="polite">{chatMessages.length === 0 && <div className="chat-empty"><b>{chatAgent.name}</b><p>“{chatAgent.quote}”</p><span>直接说出你想讨论的事情。</span></div>}{chatMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}><small>{message.role === "user" ? "你" : chatAgent.name}</small><p>{message.content}</p></div>)}{chatting && <div className="chat-bubble assistant pending"><small>{chatAgent.name}</small><p>正在思考…</p></div>}</div>
        <form className="chat-composer" onSubmit={sendChat}><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder={`给 ${chatAgent.name} 发消息…`} aria-label={`给 ${chatAgent.name} 发消息`} /><button disabled={!chatInput.trim() || chatting}>发送 <span>↑</span></button></form>
      </section>
    </div>}
  </main>;
}
