"use client";

import { useEffect, useMemo, useState } from "react";

type Agent = {
  id: string;
  name: string;
  englishName: string;
  role: string;
  color: string;
  initials: string;
  quote: string;
  outfit: string;
  worldview: string;
  traits: string[];
  sliders: { autonomy: number; empathy: number; creativity: number; rigor: number };
  tools: string[];
};

const seedAgents: Agent[] = [
  {
    id: "linxi",
    name: "林溪",
    englishName: "LIN XI",
    role: "用户研究员",
    color: "#3155d9",
    initials: "溪",
    quote: "我关注真实的用户需求，用证据推动决策。",
    outfit: "钴蓝针织背心、白衬衫、银色耳钉",
    worldview: "好问题比过早的答案更有价值。证据优先，但不忽略人的感受。",
    traits: ["好奇", "严谨", "善于提问"],
    sliders: { autonomy: 72, empathy: 84, creativity: 61, rigor: 88 },
    tools: ["web_search", "notion", "memory"],
  },
  {
    id: "chengye",
    name: "程野",
    englishName: "CHENG YE",
    role: "系统架构师",
    color: "#24231f",
    initials: "野",
    quote: "我设计可扩展的系统，让复杂变得有序。",
    outfit: "石墨色工装衬衫、圆框眼镜、机械表",
    worldview: "所有抽象都应当经得起边界条件的追问，可靠性也是一种善意。",
    traits: ["系统性", "可靠", "长远思维"],
    sliders: { autonomy: 86, empathy: 46, creativity: 68, rigor: 94 },
    tools: ["filesystem", "github", "terminal"],
  },
  {
    id: "shenzhi",
    name: "沈知",
    englishName: "SHEN ZHI",
    role: "共创引导者",
    color: "#ef5b38",
    initials: "知",
    quote: "我让每个人的想法被看见，一起创造更好的答案。",
    outfit: "朱红围巾、米白亚麻上衣、金色耳环",
    worldview: "分歧不是噪音，而是尚未被组织起来的创造力。",
    traits: ["共情", "开放", "激发创意"],
    sliders: { autonomy: 64, empathy: 95, creativity: 91, rigor: 58 },
    tools: ["whiteboard", "calendar", "memory"],
  },
];

const toolCatalog = [
  { id: "web_search", label: "网络检索", mark: "⌕" },
  { id: "memory", label: "长期记忆", mark: "◉" },
  { id: "notion", label: "知识库", mark: "▤" },
  { id: "filesystem", label: "文件系统", mark: "▱" },
  { id: "github", label: "GitHub", mark: "⌘" },
  { id: "terminal", label: "终端", mark: ">_" },
  { id: "whiteboard", label: "白板", mark: "✦" },
  { id: "calendar", label: "日历", mark: "□" },
];

const scenes = [
  { id: "discovery", index: "01", title: "需求探索", subtitle: "理解真实问题" },
  { id: "design", index: "02", title: "方案设计", subtitle: "形成可行路径" },
  { id: "debate", index: "03", title: "观点辩论", subtitle: "让分歧产生价值" },
  { id: "review", index: "04", title: "风险评审", subtitle: "挑战边界条件" },
];

const sliderLabels: Record<keyof Agent["sliders"], string> = {
  autonomy: "自主性",
  empathy: "共情倾向",
  creativity: "创造力",
  rigor: "严谨性",
};

export default function Home() {
  const [agents, setAgents] = useState(seedAgents);
  const [selectedId, setSelectedId] = useState(seedAgents[0].id);
  const [scene, setScene] = useState(scenes[0].id);
  const [tab, setTab] = useState<"identity" | "mind" | "tools" | "json">("identity");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [notice, setNotice] = useState("本地草稿已保存");
  const [newTrait, setNewTrait] = useState("");

  useEffect(() => {
    const cached = window.localStorage.getItem("persona-lab-agents");
    if (cached) {
      try { setAgents(JSON.parse(cached)); } catch { /* keep safe seed */ }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("persona-lab-agents", JSON.stringify(agents));
  }, [agents]);

  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0];
  const activeScene = scenes.find((item) => item.id === scene) ?? scenes[0];
  const jsonConfig = useMemo(() => JSON.stringify({ schema: "persona-lab/v1", agent: selected }, null, 2), [selected]);

  function updateSelected(patch: Partial<Agent>) {
    setAgents((current) => current.map((agent) => agent.id === selected.id ? { ...agent, ...patch } : agent));
    setNotice("更改已写入透明配置");
  }

  function toggleTool(id: string) {
    const tools = selected.tools.includes(id)
      ? selected.tools.filter((tool) => tool !== id)
      : [...selected.tools, id];
    updateSelected({ tools });
  }

  function runScene() {
    const turns = [
      `林溪：先别急着定义答案。我们还缺少用户在什么时刻真正感到困难。`,
      `程野：我会把结论拆成可验证的假设，并标出系统边界。`,
      `沈知：很好。我们先保留分歧，再找一个三个人都愿意验证的最小行动。`,
    ];
    setTranscript(turns);
    setNotice(`“${activeScene.title}”已完成一次模拟`);
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify({ schema: "persona-lab/v1", agents, scene }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "persona-lab.config.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("配置已导出，可审计、可迁移");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">群像</span>
          <div><strong>PERSONA LAB</strong><small>AGENT COMPOSITION STUDIO</small></div>
        </div>
        <nav className="primary-nav" aria-label="主导航">
          <button className="nav-item active">工作室</button>
          <button className="nav-item">场景库</button>
          <button className="nav-item">运行记录</button>
        </nav>
        <div className="top-actions">
          <div className="provider-pill"><i /> SoC LaaS <span>qwen3.6:35b</span></div>
          <button className="icon-button" aria-label="帮助">?</button>
          <button className="avatar-mini">ZB</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="rail">
          <div className="rail-heading"><span>你的成员</span><b>{agents.length}</b></div>
          <div className="agent-rail-list">
            {agents.map((agent) => (
              <button key={agent.id} className={`rail-agent ${agent.id === selected.id ? "selected" : ""}`} onClick={() => setSelectedId(agent.id)}>
                <span className="rail-avatar" style={{ background: agent.color }}>{agent.initials}</span>
                <span><strong>{agent.name}</strong><small>{agent.role}</small></span>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
          <button className="add-agent"><span>＋</span> 创建一个具体的人</button>
          <div className="rail-note">
            <span className="eyebrow">设计原则 01</span>
            <p>Agent 不是提示词容器。身份、观念、关系与能力都应当可见。</p>
          </div>
          <button className="export-button" onClick={exportConfig}>⇩ 导出全部配置</button>
        </aside>

        <section className="canvas">
          <div className="canvas-head">
            <div><span className="eyebrow">ENSEMBLE / 001</span><h1>产品共创小组</h1><p>三种视角，一场有结构的对话。</p></div>
            <div className="presence"><span className="stacked-avatars">{agents.map((a) => <i key={a.id} style={{ background: a.color }}>{a.initials}</i>)}</span><b>{notice}</b></div>
          </div>

          <div className="people-grid">
            {agents.map((agent) => (
              <article key={agent.id} className={`person-card ${agent.id === selected.id ? "focused" : ""}`} onClick={() => setSelectedId(agent.id)} style={{ "--agent": agent.color } as React.CSSProperties}>
                <div className="portrait">
                  <span className="portrait-index">{agent.englishName}</span>
                  <div className="portrait-figure"><b>{agent.initials}</b><i /></div>
                  <span className="role-stamp">{agent.role}</span>
                </div>
                <div className="person-copy">
                  <div className="name-row"><h2>{agent.name}</h2><span>正在场</span></div>
                  <div className="trait-row">{agent.traits.slice(0, 3).map((trait) => <em key={trait}>{trait}</em>)}</div>
                  <blockquote>“{agent.quote}”</blockquote>
                  <div className="tool-dots">{agent.tools.slice(0, 4).map((tool) => <i key={tool} title={tool}>{toolCatalog.find((item) => item.id === tool)?.mark ?? "·"}</i>)}</div>
                </div>
              </article>
            ))}
          </div>

          <section className="scene-section">
            <div className="section-title"><div><span className="eyebrow">SCENES</span><h2>把他们放进一个具体场景</h2></div><button className="text-button">管理场景 →</button></div>
            <div className="scene-flow">
              {scenes.map((item, index) => (
                <div className="scene-wrap" key={item.id}>
                  <button className={`scene-card ${scene === item.id ? "active" : ""}`} onClick={() => setScene(item.id)}>
                    <span>{item.index}</span><b>{item.title}</b><small>{item.subtitle}</small><i>{scene === item.id ? "●" : "○"}</i>
                  </button>
                  {index < scenes.length - 1 && <span className="flow-arrow">→</span>}
                </div>
              ))}
              <button className="run-button" onClick={runScene}><span>▶</span> 开始模拟</button>
            </div>
            {transcript.length > 0 && <div className="transcript"><div><span>本轮输出</span><b>{activeScene.title} · 3 个发言</b></div>{transcript.map((line) => <p key={line}>{line}</p>)}</div>}
          </section>
        </section>

        <aside className="inspector">
          <div className="inspector-head"><div><span className="inspector-avatar" style={{ background: selected.color }}>{selected.initials}</span><span><strong>{selected.name}</strong><small>{selected.role}</small></span></div><button aria-label="更多">•••</button></div>
          <div className="tabs" role="tablist">
            <button className={tab === "identity" ? "active" : ""} onClick={() => setTab("identity")}>身份</button>
            <button className={tab === "mind" ? "active" : ""} onClick={() => setTab("mind")}>内心</button>
            <button className={tab === "tools" ? "active" : ""} onClick={() => setTab("tools")}>能力</button>
            <button className={tab === "json" ? "active" : ""} onClick={() => setTab("json")}>{"{ }"}</button>
          </div>

          {tab === "identity" && <div className="panel-body">
            <label className="field"><span>角色 / 职业</span><input value={selected.role} onChange={(e) => updateSelected({ role: e.target.value })} /></label>
            <label className="field"><span>外观与服装</span><textarea value={selected.outfit} onChange={(e) => updateSelected({ outfit: e.target.value })} /></label>
            <label className="field"><span>代表性表达</span><textarea value={selected.quote} onChange={(e) => updateSelected({ quote: e.target.value })} /></label>
            <div className="callout"><b>完全透明</b><p>这些字段会原样进入 Agent 配置。没有隐藏人格层。</p></div>
          </div>}

          {tab === "mind" && <div className="panel-body">
            <label className="field"><span>世界观 / 判断原则</span><textarea className="tall" value={selected.worldview} onChange={(e) => updateSelected({ worldview: e.target.value })} /></label>
            <div className="slider-group">
              {(Object.keys(sliderLabels) as (keyof Agent["sliders"])[]).map((key) => <label className="slider" key={key}><span>{sliderLabels[key]} <b>{selected.sliders[key]}</b></span><input type="range" min="0" max="100" value={selected.sliders[key]} onChange={(e) => updateSelected({ sliders: { ...selected.sliders, [key]: Number(e.target.value) } })} /></label>)}
            </div>
            <div className="trait-editor"><span>核心特质</span><div>{selected.traits.map((trait) => <button key={trait} onClick={() => updateSelected({ traits: selected.traits.filter((item) => item !== trait) })}>{trait} ×</button>)}</div><form onSubmit={(e) => { e.preventDefault(); if (newTrait.trim()) { updateSelected({ traits: [...selected.traits, newTrait.trim()] }); setNewTrait(""); } }}><input placeholder="添加一个特质" value={newTrait} onChange={(e) => setNewTrait(e.target.value)} /><button>＋</button></form></div>
          </div>}

          {tab === "tools" && <div className="panel-body">
            <div className="tool-summary"><span><b>{selected.tools.length}</b> 个能力已授权</span><small>每个调用都写入运行记录</small></div>
            <div className="tool-list">{toolCatalog.map((tool) => <button key={tool.id} className={selected.tools.includes(tool.id) ? "enabled" : ""} onClick={() => toggleTool(tool.id)}><i>{tool.mark}</i><span><b>{tool.label}</b><small>mcp://{tool.id}</small></span><em>{selected.tools.includes(tool.id) ? "已允许" : "未授权"}</em></button>)}</div>
          </div>}

          {tab === "json" && <div className="panel-body json-panel"><div className="json-head"><span>persona.config.json</span><button onClick={() => navigator.clipboard?.writeText(jsonConfig)}>复制</button></div><pre>{jsonConfig}</pre><p>界面中的每一项都能在这里找到对应字段。</p></div>}

          <div className="provider-card"><div><span className="status-dot" /><b>SoC LaaS Provider</b></div><code>https://soclaas-api.comp.nus.edu.sg/v1</code><p>推理可替换 · 状态由本项目持久化 · MCP 在本地编排</p></div>
        </aside>
      </section>
    </main>
  );
}
