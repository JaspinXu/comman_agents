import type { FormEvent } from "react";
import type { Agent, EnsembleLine, Health } from "../types";

type Props = {
  agents: Agent[];
  health: Health | null;
  background: string;
  question: string;
  conversation: EnsembleLine[];
  running: boolean;
  onBackgroundChange: (value: string) => void;
  onQuestionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function EnsemblePanel({ agents, health, background, question, conversation, running, onBackgroundChange, onQuestionChange, onSubmit }: Props) {
  return <section className="ensemble-section">
    <div className="section-title"><div><span className="eyebrow">STORY BACKGROUND</span><h2>设定所有人共同身处的背景</h2></div><span className="conversation-rule">依次回答 · 自主交流</span></div>
    <label className="background-field"><span>整体故事背景</span><textarea value={background} onChange={(event) => onBackgroundChange(event.target.value)} placeholder="例如：三位成员受邀来到一座封闭研究站，需要在资源有限的情况下共同作出决定……" aria-label="整体故事背景" /><small>这个背景会在每一轮完整提供给所有 Agent。后回答者能看到前面成员的发言，可以主动补充、追问或反驳。</small></label>
    {conversation.length > 0 && <div className="ensemble-stream" aria-live="polite">{conversation.map((line, index) => {
      const agent = line.agent_id ? agents.find((item) => item.id === line.agent_id) : null;
      return <div key={`${line.speaker_type}-${index}`} className={`ensemble-line ${line.speaker_type}`}>
        {line.speaker_type === "agent" && agent ? <span className="line-avatar" style={{ background: agent.color }}>{agent.initials}</span> : <span className="line-avatar neutral">{line.speaker_type === "user" ? "你" : "!"}</span>}
        <div><small>{line.name}</small><p>{line.content}</p></div>
      </div>;
    })}{running && <div className="ensemble-thinking"><span /><span /><span /> Agent 正在依次思考与回应…</div>}</div>}
    <form className="ensemble-composer" onSubmit={onSubmit}><textarea value={question} onChange={(event) => onQuestionChange(event.target.value)} placeholder="在这个背景下，向所有 Agent 提问……" aria-label="向所有 Agent 提问" /><button type="submit" disabled={running || !health || !background.trim() || !question.trim()}><span>{running ? "…" : "↑"}</span>{running ? "回答中" : "问所有人"}</button></form>
  </section>;
}
