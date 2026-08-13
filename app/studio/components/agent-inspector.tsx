import { useMemo, useState } from "react";
import { sliderLabels } from "../defaults";
import type { Agent, CustomAttribute, Health, InspectorTab, Sliders, ToolManifest } from "../types";

type Props = {
  agent: Agent;
  agentCount: number;
  health: Health | null;
  tools: ToolManifest[];
  generatingPortrait: boolean;
  portraitError?: string;
  deletingAgent: boolean;
  deleteError: string;
  onUpdate: (patch: Partial<Agent>) => void;
  onGeneratePortrait: () => void;
  onDelete: () => void;
};

export function AgentInspector({ agent, agentCount, health, tools, generatingPortrait, portraitError, deletingAgent, deleteError, onUpdate, onGeneratePortrait, onDelete }: Props) {
  const [tab, setTab] = useState<InspectorTab>("identity");
  const [newTrait, setNewTrait] = useState("");
  const [newAttributeName, setNewAttributeName] = useState("");
  const [newAttributeContent, setNewAttributeContent] = useState("");
  const attributes = agent.customAttributes ?? [];
  const jsonConfig = useMemo(() => JSON.stringify({ schema: "comman_agents/v1", agent }, null, 2), [agent]);

  function updateAttribute(index: number, patch: Partial<CustomAttribute>) {
    onUpdate({ customAttributes: attributes.map((item, current) => current === index ? { ...item, ...patch } : item) });
  }

  return <aside className="inspector">
    <div className="inspector-head"><div><span className="inspector-avatar" style={{ background: agent.color }}>{agent.initials}</span><span><strong>{agent.name}</strong><small>{agent.role}</small></span></div><span className="db-mark">SQLite</span></div>
    <div className="tabs" role="tablist">
      <button className={tab === "identity" ? "active" : ""} onClick={() => setTab("identity")}>身份</button>
      <button className={tab === "mind" ? "active" : ""} onClick={() => setTab("mind")}>内心</button>
      <button className={tab === "tools" ? "active" : ""} onClick={() => setTab("tools")}>能力</button>
      <button className={tab === "json" ? "active" : ""} onClick={() => setTab("json")}>{"{ }"}</button>
    </div>
    {tab === "identity" && <div className="panel-body">
      <label className="field"><span>角色 / 职业</span><input value={agent.role} onChange={(event) => onUpdate({ role: event.target.value })} /></label>
      <label className="field"><span>外观与服装</span><textarea value={agent.outfit} onChange={(event) => onUpdate({ outfit: event.target.value })} /></label>
      <label className="field"><span>性格</span><textarea value={agent.quote} onChange={(event) => onUpdate({ quote: event.target.value })} /></label>
      <section className="custom-attribute-editor">
        <div className="custom-attribute-head"><span><b>自定义特征</b><small>自由添加任何特征名称及其对应内容</small></span><em>{attributes.length}/64</em></div>
        {attributes.length > 0 && <div className="custom-attribute-list">{attributes.map((attribute, index) => <div className="custom-attribute-row" key={index}>
          <input aria-label={`特征 ${index + 1} 名称`} value={attribute.name} onChange={(event) => updateAttribute(index, { name: event.target.value })} placeholder="特征名称" />
          <textarea aria-label={`特征 ${index + 1} 内容`} value={attribute.content} onChange={(event) => updateAttribute(index, { content: event.target.value })} placeholder="这个特征的具体内容" />
          <button type="button" onClick={() => onUpdate({ customAttributes: attributes.filter((_, current) => current !== index) })} aria-label={`删除特征 ${attribute.name || index + 1}`}>×</button>
        </div>)}</div>}
        <form className="custom-attribute-form" onSubmit={(event) => {
          event.preventDefault();
          const name = newAttributeName.trim();
          const content = newAttributeContent.trim();
          if (!name || !content || attributes.length >= 64) return;
          onUpdate({ customAttributes: [...attributes, { name, content }] });
          setNewAttributeName(""); setNewAttributeContent("");
        }}>
          <input value={newAttributeName} onChange={(event) => setNewAttributeName(event.target.value)} placeholder="特征名称，如：说话习惯" aria-label="新特征名称" />
          <textarea value={newAttributeContent} onChange={(event) => setNewAttributeContent(event.target.value)} placeholder="填写这个特征对应的内容…" aria-label="新特征内容" />
          <button type="submit" disabled={!newAttributeName.trim() || !newAttributeContent.trim() || attributes.length >= 64}>＋ 添加特征</button>
        </form>
      </section>
      <div className="portrait-control"><span className="eyebrow">AGENT IMAGEGEN</span><b>形象来自完整人物配置</b><p>创建人物时自动生成；修改性格、服装或自定义特征后，可按最新配置重新生成。</p><button onClick={onGeneratePortrait} disabled={generatingPortrait || !health?.image_generation_configured}>{generatingPortrait ? "正在生成形象…" : health?.image_generation_configured ? "根据最新配置重新生成" : "未配置形象生成服务"}</button>{portraitError && <small>{portraitError}</small>}</div>
      <div className="delete-agent-control"><span>删除人物</span><p>删除后，该人物不会再参与群聊，也不会在重新启动后恢复。</p><button type="button" onClick={onDelete} disabled={agentCount <= 1 || deletingAgent}>{deletingAgent ? "正在删除…" : agentCount <= 1 ? "至少保留一位人物" : `删除 ${agent.name}`}</button>{deleteError && <small>{deleteError}</small>}</div>
    </div>}
    {tab === "mind" && <div className="panel-body">
      <label className="field"><span>世界观 / 判断原则</span><textarea className="tall" value={agent.worldview} onChange={(event) => onUpdate({ worldview: event.target.value })} /></label>
      <div className="slider-group">{(Object.keys(sliderLabels) as (keyof Sliders)[]).map((key) => <label className="slider" key={key}><span>{sliderLabels[key]} <b>{agent.sliders[key]}</b></span><input type="range" min="0" max="100" value={agent.sliders[key]} onChange={(event) => onUpdate({ sliders: { ...agent.sliders, [key]: Number(event.target.value) } })} /></label>)}</div>
      <div className="trait-editor"><span>核心特质</span><div>{agent.traits.map((trait) => <button key={trait} onClick={() => onUpdate({ traits: agent.traits.filter((item) => item !== trait) })}>{trait} ×</button>)}</div><form onSubmit={(event) => { event.preventDefault(); if (newTrait.trim()) { onUpdate({ traits: [...agent.traits, newTrait.trim()] }); setNewTrait(""); } }}><input placeholder="添加一个特质" value={newTrait} onChange={(event) => setNewTrait(event.target.value)} /><button>＋</button></form></div>
    </div>}
    {tab === "tools" && <div className="panel-body"><div className="tool-summary"><span><b>{agent.tools.length}</b> 个能力已授权</span><small>Python 工具注册边界</small></div><div className="tool-list">{tools.map((tool) => <button key={tool.id} className={agent.tools.includes(tool.id) ? "enabled" : ""} onClick={() => onUpdate({ tools: agent.tools.includes(tool.id) ? agent.tools.filter((item) => item !== tool.id) : [...agent.tools, tool.id] })}><i>{tool.id.slice(0, 2)}</i><span><b>{tool.label}</b><small>{tool.uri}</small></span><em>{agent.tools.includes(tool.id) ? "已允许" : "未授权"}</em></button>)}</div></div>}
    {tab === "json" && <div className="panel-body json-panel"><div className="json-head"><span>comman_agents.config.json</span><button onClick={() => navigator.clipboard?.writeText(jsonConfig)}>复制</button></div><pre>{jsonConfig}</pre><p>界面中的每一项都能在这里找到对应字段。</p></div>}
    <div className="provider-card"><div><span className="status-dot" /><b>{health?.provider === "soclaas" ? "SoC LaaS 已连接" : "离线模式"}</b></div><code>Python :8000 → {health?.model ?? "等待连接"}</code><p>{health?.live_provider_configured ? "真实模型推理 · SQLite 运行记录 · 本地工具边界" : "设置 SOCLAAS_API_KEY 后重启即可启用真实推理"}</p></div>
  </aside>;
}
