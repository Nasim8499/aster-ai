export type Theme = "light" | "dark";
export type Mode = "chat" | "agent";

export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  tagline: string;
  chatLimit: number;
  agentLimit: number;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    tagline: "For trying things out",
    chatLimit: 30,
    agentLimit: 5,
    features: ["30 chat messages / month", "5 agent runs / month", "Markdown & HTML previews", "Local history"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$20",
    tagline: "For everyday builders",
    chatLimit: 2000,
    agentLimit: 200,
    features: ["2,000 chat messages / month", "200 agent runs / month", "All export formats", "Gemini & custom models", "Priority agent execution"],
  },
  {
    id: "team",
    name: "Team",
    price: "$49",
    tagline: "For small studios",
    chatLimit: 10000,
    agentLimit: 1000,
    features: ["10,000 chat messages / month", "1,000 agent runs / month", "Shared projects", "Admin dashboard", "Usage analytics"],
  },
];

export interface User {
  id: string;
  email: string;
  name: string;
  provider: "password" | "google";
  role: "admin" | "member";
  plan: PlanId;
  createdAt: number;
  avatarColor: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  streaming?: boolean;
  error?: string;
  model?: string;
  kind?: "chat" | "browse";
  browse?: BrowseState;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  mode: Mode;
  pinned?: boolean;
}

export type StepStatus = "pending" | "active" | "awaiting_approval" | "done" | "failed" | "skipped";

export interface LogLine {
  id: string;
  ts: number;
  text: string;
  tone: "info" | "success" | "warn" | "error" | "tool";
}

export interface AgentStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  tools: string[];
  logs: LogLine[];
  startedAt?: number;
  endedAt?: number;
  requiresApproval?: boolean;
}

export type AgentStatus =
  | "idle"
  | "thinking"
  | "researching"
  | "writing"
  | "building"
  | "reviewing"
  | "awaiting_approval"
  | "paused"
  | "completed"
  | "failed"
  | "stopped";

export type ArtifactKind = "html" | "markdown" | "code" | "table";

export interface ArtifactFile {
  name: string;
  mime: string;
  content: string;
}

export interface Artifact {
  kind: ArtifactKind;
  title: string;
  language: string;
  filename: string;
  /** Rendered source: HTML document, markdown, or code. */
  content: string;
  files: ArtifactFile[];
  outline: { level: number; text: string }[];
  updatedAt: number;
}

export interface AgentRun {
  id: string;
  userId: string;
  task: string;
  mode: "agent";
  status: AgentStatus;
  steps: AgentStep[];
  artifact: Artifact;
  logs: LogLine[];
  createdAt: number;
  updatedAt: number;
  endedAt: number | null;
  currentStepId: string | null;
  autoApprove: boolean;
  followUps: { role: "user" | "assistant"; content: string; ts: number }[];
  error?: string;
  projectId: string | null;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  kind: "website" | "report" | "checklist" | "workflow";
  status: "draft" | "active" | "archived";
  artifactCount: number;
  createdAt: number;
  updatedAt: number;
  runIds: string[];
}

export interface Usage {
  chat: number;
  agent: number;
  period: string;
}

export type BrowseEngine = "real" | "reader";

export interface BrowseStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
}

export interface BrowseSource {
  url: string;
  title: string;
  excerpt: string;
  screenshot?: string;
  statusCode?: number;
  fetchedAt: number;
}

export interface BrowseLog {
  id: string;
  ts: number;
  text: string;
  tone: "info" | "success" | "warn" | "error" | "network";
}

export interface BrowseTimelineEntry {
  id: string;
  ts: number;
  kind: "thought" | "action" | "url" | "status";
  text: string;
  url?: string;
  step?: number;
}

export interface BrowseState {
  task: string;
  status: "idle" | "running" | "paused" | "done" | "error" | "stopped";
  engine: "real" | "reader";
  engineNote?: string;
  currentUrl: string | null;
  currentTitle: string | null;
  screenshot: string | null;
  screenshotLoading: boolean;
  steps: BrowseStep[];
  logs: BrowseLog[];
  sources: BrowseSource[];
  answer: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
  pagesVisited: number;
  timeline: BrowseTimelineEntry[];
  result?: string | null;
  hint?: string | null;
}

export interface Settings {
  theme: Theme;
  /** "demo" runs the built-in deterministic model; "server" streams from /api/chat. */
  provider: "demo" | "server";
  proxyBase: string;
  geminiKey: string;
  geminiModel: string;
  autoApprove: boolean;
  reduceMotion: boolean;
  browseEngine: BrowseEngine;
  agentApiUrl: string;
  agentToken: string;
  maxSources: number;
  maxSteps: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  provider: "gemini",
  proxyBase: "https://aster-api.visamotion365.workers.dev",
  geminiKey: "",
  geminiModel: "gemini-2.5-flash",
  autoApprove: false,
  reduceMotion: false,
  browseEngine: "reader",
  agentApiUrl: "http://127.0.0.1:8000",
  agentToken: "",
  maxSources: 3,
  maxSteps: 25,
};

export const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
];

export const modeCopy: Record<Mode, { label: string; hint: string; placeholder: string }> = {
  chat: {
    label: "Chat",
    hint: "Ask anything and get an instant answer.",
    placeholder: "Ask anything…",
  },
  agent: {
    label: "Agent",
    hint: "Give a task. The agent will plan, work step-by-step, and show a live preview of the result.",
    placeholder: "Describe a task for your browser agent…",
  },
};
