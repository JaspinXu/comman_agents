import type { Dispatch, FormEvent, SetStateAction } from "react";
import Image from "next/image";
import { portraitSource } from "../api";
import type { Agent, ChatMessage, NewAgentDraft } from "../types";

type CreateProps = {
  draft: NewAgentDraft;
  error: string;
  onDraftChange: Dispatch<SetStateAction<NewAgentDraft>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CreateAgentDialog({ draft, error, onDraftChange, onClose, onSubmit }: CreateProps) {
  return <div className="modal-backdrop"><section className="create-agent-modal" role="dialog" aria-modal="true" aria-labelledby="create-agent-title">
    <div className="modal-head"><div><span className="eyebrow">NEW PERSON</span><h2 id="create-agent-title">创建一个具体的人</h2></div><button type="button" onClick={onClose} aria-label="关闭创建人物对话框">×</button></div>
    <p className="modal-intro">先定义基本身份。创建后可以继续完善服装、世界观、人格维度和工具权限。</p>
    <form className="create-agent-form" onSubmit={onSubmit}>
      <label className="field"><span>姓名 *</span><input maxLength={80} value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} placeholder="例如：许墨" /></label>
      <label className="field"><span>角色 / 职业 *</span><input maxLength={120} value={draft.role} onChange={(event) => onDraftChange({ ...draft, role: event.target.value })} placeholder="例如：商业分析师" /></label>
      <div className="form-row"><label className="field"><span>英文名</span><input maxLength={80} value={draft.englishName} onChange={(event) => onDraftChange({ ...draft, englishName: event.target.value })} placeholder="XU MO" /></label><label className="field initials-field"><span>头像字</span><input maxLength={4} value={draft.initials} onChange={(event) => onDraftChange({ ...draft, initials: event.target.value })} placeholder="墨" /></label></div>
      <label className="color-field"><span>人物色彩</span><input type="color" value={draft.color} onChange={(event) => onDraftChange({ ...draft, color: event.target.value })} /><b style={{ background: draft.color }}>{draft.initials || draft.name.slice(0, 1) || "新"}</b><code>{draft.color}</code></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" onClick={onClose}>取消</button><button type="submit">创建并继续完善 →</button></div>
    </form>
  </section></div>;
}

type ChatProps = {
  agent: Agent;
  messages: ChatMessage[];
  input: string;
  chatting: boolean;
  onInputChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChatDialog({ agent, messages, input, chatting, onInputChange, onClose, onSubmit }: ChatProps) {
  const portrait = portraitSource(agent);
  return <div className="chat-backdrop"><section className="chat-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
    <header className="chat-head"><div>{portrait ? <Image src={portrait} alt="" width={58} height={58} unoptimized /> : <span style={{ background: agent.color }}>{agent.initials}</span>}<div><small>1 : 1 CONVERSATION</small><h2 id="chat-title">与 {agent.name} 对话</h2><p>{agent.role}</p></div></div><button onClick={onClose} aria-label="关闭一对一对话">×</button></header>
    <div className="chat-stream" aria-live="polite">{messages.length === 0 && <div className="chat-empty"><b>{agent.name}</b><p>“{agent.quote}”</p><span>直接说出你想讨论的事情。</span></div>}{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}><small>{message.role === "user" ? "你" : agent.name}</small><p>{message.content}</p></div>)}{chatting && <div className="chat-bubble assistant pending"><small>{agent.name}</small><p>正在思考…</p></div>}</div>
    <form className="chat-composer" onSubmit={onSubmit}><textarea value={input} onChange={(event) => onInputChange(event.target.value)} placeholder={`给 ${agent.name} 发消息…`} aria-label={`给 ${agent.name} 发消息`} /><button disabled={!input.trim() || chatting}>发送 <span>↑</span></button></form>
  </section></div>;
}
