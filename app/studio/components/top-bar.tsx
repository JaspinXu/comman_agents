import type { Health, StudioView } from "../types";

type Props = {
  health: Health | null;
  activeView: StudioView;
  onViewChange: (view: StudioView) => void;
};

export function TopBar({ health, activeView, onViewChange }: Props) {
  return <header className="topbar">
    <div className="brand-block"><span className="brand-name">comman agents</span></div>
    <nav className="primary-nav" aria-label="主导航"><button type="button" className={`nav-item ${activeView === "studio" ? "active" : ""}`} onClick={() => onViewChange("studio")}>工作室</button><button type="button" className={`nav-item ${activeView === "runs" ? "active" : ""}`} onClick={() => onViewChange("runs")}>运行记录</button></nav>
    <div className="top-actions">
      <div className={`provider-pill ${health ? "online" : ""}`}><i /> {health?.provider === "soclaas" ? "SoC LaaS" : "Local Engine"} <span>{health?.model ?? "connecting"}</span></div>
      <a className="icon-button api-doc" href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer" aria-label="打开后端 API 文档">API</a>
      <button className="avatar-mini">ZB</button>
    </div>
  </header>;
}
