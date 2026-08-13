import type { RunSummary } from "../types";

type Props = {
  runs: RunSummary[];
  selectedRun: RunSummary | null;
  loading: boolean;
  error: string;
  onSelect: (runId: string) => void;
  onRefresh: () => void;
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function RunHistory({ runs, selectedRun, loading, error, onSelect, onRefresh }: Props) {
  const transcript = selectedRun?.events.filter((event) => event.type === "message" || event.type === "error" || event.type === "tool") ?? [];
  return <section className="run-history-view">
    <header className="run-history-head">
      <div><span className="eyebrow">ARCHIVE / SQLITE</span><h1>运行记录</h1><p>每次多 Agent 对话的背景、问题、模型和发言均从 SQLite 读取。</p></div>
      <button type="button" onClick={onRefresh} disabled={loading}>{loading ? "读取中…" : "↻ 刷新记录"}</button>
    </header>
    {error && <p className="run-history-error">{error}</p>}
    {!loading && !error && runs.length === 0 && <div className="run-history-empty"><b>还没有运行记录</b><p>返回工作室向所有 Agent 提问，完成后的对话会出现在这里。</p></div>}
    {runs.length > 0 && <div className="run-history-layout">
      <aside className="run-list" aria-label="历史运行列表">{runs.map((run) => <button type="button" key={run.id} className={selectedRun?.id === run.id ? "active" : ""} onClick={() => onSelect(run.id)}>
        <span><i className={`run-status ${run.status}`} />{run.status === "completed" ? "已完成" : run.status}</span>
        <b>{run.prompt}</b>
        <small>{formatTime(run.created_at)} · {run.model}</small>
      </button>)}</aside>
      <article className="run-detail">
        {!selectedRun && <div className="run-detail-loading">选择一条记录查看完整对话。</div>}
        {selectedRun && <>
          <div className="run-detail-meta"><span>{formatTime(selectedRun.created_at)}</span><span>{selectedRun.provider} / {selectedRun.model}</span><code>{selectedRun.id.slice(0, 12)}</code></div>
          <section><small>故事背景</small><p>{selectedRun.background}</p></section>
          <section className="run-question"><small>用户提问</small><h2>{selectedRun.prompt}</h2></section>
          <div className="run-transcript">{transcript.length === 0 ? <p className="run-detail-loading">这条记录没有可展示的发言。</p> : transcript.map((event, index) => <div className={`run-event ${event.type}`} key={event.id ?? `${event.sequence}-${index}`}>
            <span>{event.agent_name?.slice(0, 1) ?? (event.type === "error" ? "!" : "·")}</span>
            <div><small>{event.agent_name ?? (event.type === "error" ? "系统错误" : "工具")}</small><p>{event.content}</p></div>
          </div>)}</div>
        </>}
      </article>
    </div>}
  </section>;
}
