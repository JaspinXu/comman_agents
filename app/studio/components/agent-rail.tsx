import type { Agent } from "../types";

type Props = {
  agents: Agent[];
  selectedId: string;
  onSelect: (agentId: string) => void;
  onCreate: () => void;
};

export function AgentRail({ agents, selectedId, onSelect, onCreate }: Props) {
  return <aside className="rail">
    <div className="rail-heading"><span>你的成员</span><b>{agents.length}</b></div>
    <div className="agent-rail-list">{agents.map((agent) => <button key={agent.id} className={`rail-agent ${agent.id === selectedId ? "selected" : ""}`} onClick={() => onSelect(agent.id)}>
      <span className="rail-avatar" style={{ background: agent.color }}>{agent.initials}</span>
      <span><strong>{agent.name}</strong><small>{agent.role}</small></span><i aria-hidden="true" />
    </button>)}</div>
    <button className="add-agent" onClick={onCreate}><span>＋</span> 添加新人物</button>
  </aside>;
}
