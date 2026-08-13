import type { CSSProperties } from "react";
import Image from "next/image";
import { portraitSource } from "../api";
import type { Agent, Health } from "../types";

type Props = {
  agents: Agent[];
  selectedId: string;
  health: Health | null;
  generatingPortraits: string[];
  portraitErrors: Record<string, string>;
  onSelect: (agentId: string) => void;
  onChat: (agent: Agent) => void;
};

export function AgentGallery({ agents, selectedId, health, generatingPortraits, portraitErrors, onSelect, onChat }: Props) {
  return <>
    <div className="canvas-head"><div><span className="eyebrow">ENSEMBLE / LIVE</span><h1>产品共创小组</h1><p>由 Python 编排器驱动，运行与发言持久化到 SQLite。</p></div><div className="presence"><span className="stacked-avatars">{agents.map((agent) => <i key={agent.id} style={{ background: agent.color }}>{agent.initials}</i>)}</span><b>{health ? "后端在线" : "等待后端"}</b></div></div>
    <div className="people-grid">{agents.map((agent) => {
      const portrait = portraitSource(agent);
      return <article key={agent.id} className={`person-card ${agent.id === selectedId ? "focused" : ""}`} style={{ "--agent": agent.color } as CSSProperties}>
        <button className="portrait" onClick={() => onSelect(agent.id)} aria-label={`编辑 ${agent.name} 的人物配置`}>
          {portrait ? <Image src={portrait} alt={`${agent.name}，${agent.role}`} width={1024} height={1280} unoptimized /> : <span className="portrait-pending"><b>{generatingPortraits.includes(agent.id) ? "生成中…" : agent.initials}</b><small>{portraitErrors[agent.id] || "尚未生成 Agent 形象"}</small></span>}
        </button>
        <div className="person-actions"><h2>{agent.name}</h2><button onClick={() => onChat(agent)} aria-label={`与 ${agent.name} 进行一对一对话`}>1v1 对话 <span>→</span></button></div>
      </article>;
    })}</div>
  </>;
}
