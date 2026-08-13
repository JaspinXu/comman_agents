export type Sliders = {
  autonomy: number;
  empathy: number;
  creativity: number;
  rigor: number;
};

export type CustomAttribute = { name: string; content: string };

export type Agent = {
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
  sliders: Sliders;
  tools: string[];
  customAttributes: CustomAttribute[];
  portraitUrl?: string | null;
  portraitPrompt?: string | null;
};

export type ToolManifest = {
  id: string;
  label: string;
  description: string;
  uri: string;
};

export type Health = {
  status: string;
  provider: string;
  live_provider_configured: boolean;
  model: string;
  tools: ToolManifest[];
  image_provider: string;
  image_generation_configured: boolean;
};

export type StudioSettings = {
  groupName: string;
};

export type RunEvent = {
  id?: number;
  run_id?: string;
  sequence?: number;
  type: "status" | "message" | "tool" | "error" | "complete";
  agent_id?: string;
  agent_name?: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

export type RunSummary = {
  id: string;
  background: string;
  prompt: string;
  provider: string;
  model: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  events: RunEvent[];
};

export type StudioView = "studio" | "runs";

export type NewAgentDraft = {
  name: string;
  role: string;
  englishName: string;
  initials: string;
  color: string;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type EnsembleLine = {
  speaker_type: "user" | "agent" | "system";
  name: string;
  content: string;
  agent_id?: string;
};

export type InspectorTab = "identity" | "mind" | "tools" | "json";
