"use client";

import { useEffect, useRef, useState } from "react";
import { studioApi } from "./studio/api";
import { AgentGallery } from "./studio/components/agent-gallery";
import { AgentInspector } from "./studio/components/agent-inspector";
import { AgentRail } from "./studio/components/agent-rail";
import { ChatDialog, CreateAgentDialog } from "./studio/components/dialogs";
import { EnsemblePanel } from "./studio/components/ensemble-panel";
import { RunHistory } from "./studio/components/run-history";
import { TopBar } from "./studio/components/top-bar";
import { blankAgent, defaultGroupName, defaultStoryBackground, fallbackTools, seedAgents } from "./studio/defaults";
import type { Agent, ChatMessage, EnsembleLine, Health, NewAgentDraft, RunSummary, StudioView } from "./studio/types";

export default function Home() {
  const [agents, setAgents] = useState(seedAgents);
  const [health, setHealth] = useState<Health | null>(null);
  const [activeView, setActiveView] = useState<StudioView>("studio");
  const [groupName, setGroupName] = useState(defaultGroupName);
  const [selectedId, setSelectedId] = useState(seedAgents[0].id);
  const [storyBackground, setStoryBackground] = useState(defaultStoryBackground);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<EnsembleLine[]>([]);
  const [running, setRunning] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [newAgent, setNewAgent] = useState<NewAgentDraft>(blankAgent);
  const [createError, setCreateError] = useState("");
  const [generatingPortraits, setGeneratingPortraits] = useState<string[]>([]);
  const [portraitErrors, setPortraitErrors] = useState<Record<string, string>>({});
  const [deleteError, setDeleteError] = useState("");
  const [deletingAgent, setDeletingAgent] = useState(false);
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState("");
  const saveTimers = useRef<Record<string, number>>({});
  const settingsSaveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    studioApi.bootstrap().then(([healthData, agentData, settingsData]) => {
      if (!active) return;
      setHealth(healthData);
      setAgents(agentData);
      setGroupName(settingsData.groupName);
      setSelectedId((current) => agentData.some((agent) => agent.id === current) ? current : agentData[0].id);
    }).catch(() => { /* Seed data remains visible while the backend is offline. */ });
    return () => { active = false; };
  }, []);

  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0];
  const chatAgent = agents.find((agent) => agent.id === chatAgentId) ?? null;
  const tools = health?.tools ?? fallbackTools;

  function persistAgent(agent: Agent) {
    window.clearTimeout(saveTimers.current[agent.id]);
    saveTimers.current[agent.id] = window.setTimeout(() => {
      void studioApi.updateAgent(agent).catch(() => { /* A later edit retries persistence. */ });
    }, 450);
  }

  function updateSelected(patch: Partial<Agent>) {
    const updated = { ...selected, ...patch };
    setAgents((current) => current.map((agent) => agent.id === selected.id ? updated : agent));
    persistAgent(updated);
  }

  function updateGroupName(value: string) {
    setGroupName(value);
    window.clearTimeout(settingsSaveTimer.current);
    const normalized = value.trim();
    if (!normalized) return;
    settingsSaveTimer.current = window.setTimeout(() => {
      void studioApi.updateSettings({ groupName: normalized }).catch(() => { /* A later edit retries persistence. */ });
    }, 450);
  }

  function commitGroupName() {
    const normalized = groupName.trim() || defaultGroupName;
    window.clearTimeout(settingsSaveTimer.current);
    setGroupName(normalized);
    void studioApi.updateSettings({ groupName: normalized }).catch(() => { /* Keep the current draft visible. */ });
  }

  async function loadRuns() {
    setRunsLoading(true);
    setRunsError("");
    try {
      const records = await studioApi.listRuns();
      setRuns(records);
      if (records.length === 0) {
        setSelectedRun(null);
      } else {
        const detail = await studioApi.getRun(records[0].id);
        setSelectedRun(detail);
      }
    } catch (error) {
      setRunsError(error instanceof Error ? error.message : "无法读取运行记录");
    } finally {
      setRunsLoading(false);
    }
  }

  async function selectRun(runId: string) {
    setRunsLoading(true);
    setRunsError("");
    try {
      setSelectedRun(await studioApi.getRun(runId));
    } catch (error) {
      setRunsError(error instanceof Error ? error.message : "无法读取这条记录");
    } finally {
      setRunsLoading(false);
    }
  }

  function changeView(view: StudioView) {
    setActiveView(view);
    if (view === "runs") void loadRuns();
  }

  async function generatePortrait(agentId: string) {
    if (!health?.image_generation_configured) return;
    setGeneratingPortraits((current) => current.includes(agentId) ? current : [...current, agentId]);
    setPortraitErrors((current) => ({ ...current, [agentId]: "" }));
    try {
      const updated = await studioApi.generatePortrait(agentId);
      setAgents((current) => current.map((agent) => agent.id === updated.id ? updated : agent));
    } catch (error) {
      setPortraitErrors((current) => ({ ...current, [agentId]: error instanceof Error ? error.message : "形象生成失败" }));
    } finally {
      setGeneratingPortraits((current) => current.filter((id) => id !== agentId));
    }
  }

  async function deleteSelectedAgent() {
    if (agents.length <= 1 || deletingAgent) return;
    if (!window.confirm(`确定删除 ${selected.name} 吗？人物配置和生成形象将被永久删除。`)) return;
    setDeleteError("");
    setDeletingAgent(true);
    window.clearTimeout(saveTimers.current[selected.id]);
    delete saveTimers.current[selected.id];
    try {
      await studioApi.deleteAgent(selected.id);
      const remaining = agents.filter((agent) => agent.id !== selected.id);
      setAgents(remaining);
      setSelectedId(remaining[0].id);
      if (chatAgentId === selected.id) setChatAgentId(null);
      setPortraitErrors((current) => { const next = { ...current }; delete next[selected.id]; return next; });
      setGeneratingPortraits((current) => current.filter((id) => id !== selected.id));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "删除失败");
      persistAgent(selected);
    } finally {
      setDeletingAgent(false);
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
      const data = await studioApi.chat(chatAgent.id, message, history);
      setChatMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setChatMessages((current) => [...current, { role: "assistant", content: `暂时无法回复：${error instanceof Error ? error.message : "未知错误"}` }]);
    } finally {
      setChatting(false);
    }
  }

  async function askEnsemble(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const background = storyBackground.trim();
    const prompt = question.trim();
    if (!background || !prompt || running) return;
    const history = conversation.filter((line) => line.speaker_type !== "system");
    setConversation((current) => [...current, { speaker_type: "user", name: "你", content: prompt }]);
    setQuestion("");
    setRunning(true);
    try {
      await studioApi.runEnsemble(background, prompt, agents.map((agent) => agent.id), history, (runEvent) => {
        if (runEvent.type === "message") {
          setConversation((current) => [...current, { speaker_type: "agent", agent_id: runEvent.agent_id, name: runEvent.agent_name ?? "Agent", content: runEvent.content }]);
        } else if (runEvent.type === "error") {
          setConversation((current) => [...current, { speaker_type: "system", name: "系统", content: runEvent.content }]);
        }
      });
    } catch (error) {
      setConversation((current) => [...current, { speaker_type: "system", name: "系统", content: `无法运行：${error instanceof Error ? error.message : "未知错误"}` }]);
    } finally {
      setRunning(false);
    }
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
      customAttributes: [],
    };
    try {
      const created = await studioApi.createAgent(agent);
      setAgents((current) => [...current, created]);
      setSelectedId(created.id);
      setNewAgent(blankAgent);
      setCreatingAgent(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "创建失败，请检查 Python 后端。");
    }
  }

  return <main className="app-shell">
    <TopBar health={health} activeView={activeView} onViewChange={changeView} />
    {activeView === "studio" ? <section className="workspace">
      <AgentRail agents={agents} selectedId={selected.id} onSelect={setSelectedId} onCreate={() => setCreatingAgent(true)} />
      <section className="canvas">
        <AgentGallery groupName={groupName} agents={agents} selectedId={selected.id} health={health} generatingPortraits={generatingPortraits} portraitErrors={portraitErrors} onGroupNameChange={updateGroupName} onGroupNameCommit={commitGroupName} onSelect={setSelectedId} onChat={openChat} />
        <EnsemblePanel agents={agents} health={health} background={storyBackground} question={question} conversation={conversation} running={running} onBackgroundChange={setStoryBackground} onQuestionChange={setQuestion} onSubmit={askEnsemble} />
      </section>
      <AgentInspector agent={selected} agentCount={agents.length} health={health} tools={tools} generatingPortrait={generatingPortraits.includes(selected.id)} portraitError={portraitErrors[selected.id]} deletingAgent={deletingAgent} deleteError={deleteError} onUpdate={updateSelected} onGeneratePortrait={() => void generatePortrait(selected.id)} onDelete={() => void deleteSelectedAgent()} />
    </section> : <RunHistory runs={runs} selectedRun={selectedRun} loading={runsLoading} error={runsError} onSelect={(runId) => void selectRun(runId)} onRefresh={() => void loadRuns()} />}
    {creatingAgent && <CreateAgentDialog draft={newAgent} error={createError} onDraftChange={setNewAgent} onClose={() => setCreatingAgent(false)} onSubmit={createAgent} />}
    {chatAgent && <ChatDialog agent={chatAgent} messages={chatMessages} input={chatInput} chatting={chatting} onInputChange={setChatInput} onClose={() => setChatAgentId(null)} onSubmit={sendChat} />}
  </main>;
}
