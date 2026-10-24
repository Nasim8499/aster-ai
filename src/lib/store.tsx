import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AgentEngine, createRun } from "./agent";
import { emptyBrowse, startBrowse, type BrowseSession } from "./browse";
import { streamReply } from "./chat";
import {
  DEFAULT_SETTINGS,
  PLANS,
  type AgentRun,
  type BrowseState,
  type Conversation,
  type Message,
  type Mode,
  type PlanId,
  type Project,
  type Settings,
  type Theme,
  type Usage,
  type User,
} from "./types";

const NS = "aster:";
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}
/**
 * Keep persisted history small: live screenshots are base64 and would blow the
 * localStorage quota after a couple of runs. The UI keeps them in memory; a
 * reloaded conversation shows the answer, timeline and sources without images.
 */
function sanitizeForStorage(key: string, value: unknown) {
  if (key !== "conversations") return value;
  const convos = value as Conversation[];
  return convos.slice(0, 60).map((c) => ({
    ...c,
    messages: c.messages.slice(-120).map((m) =>
      m.browse
        ? {
            ...m,
            content: m.content.slice(0, 20000),
            browse: {
              ...m.browse,
              screenshot: null,
              screenshotLoading: false,
              sources: m.browse.sources.slice(-8).map((s) => ({ ...s, screenshot: undefined, excerpt: s.excerpt.slice(0, 1200) })),
              timeline: m.browse.timeline.slice(-40),
              logs: m.browse.logs.slice(-40),
            },
          }
        : { ...m, content: m.content.slice(0, 20000) },
    ),
  }));
}

function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => load(key, initial));
  // Debounced writes: streaming browse events mutate conversations rapidly and
  // each message can carry page excerpts, so avoid serialising on every tick.
  useEffect(() => {
    const t = window.setTimeout(() => save(key, sanitizeForStorage(key, value)), 350);
    return () => window.clearTimeout(t);
  }, [key, value]);
  return [value, setValue] as const;
}

async function hash(text: string) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `plain:${text}`;
  }
}

export type Page = "home" | "chat" | "agent" | "plans" | "settings" | "admin";

interface StoredUser extends User {
  passwordHash?: string;
}

interface Session {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface Ctx {
  user: User | null;
  allUsers: User[];
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  googleSignIn: () => Promise<string | null>;
  enterDemo: (admin?: boolean) => void;
  signOut: () => void;
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  toggleTheme: () => void;
  theme: Theme;
  page: Page;
  setPage: (p: Page) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeConversationId: string | null;
  openConversation: (id: string) => void;
  newConversation: () => string;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  togglePin: (id: string) => void;
  sendChat: (prompt: string) => void;
  stopChat: () => void;
  regenerate: (messageId: string) => void;
  startBrowseTask: (prompt: string) => void;
  pauseBrowse: () => void;
  resumeBrowse: () => void;
  stopBrowse: () => void;
  browseBusy: boolean;
  browseMessageId: string | null;
  chatBusy: boolean;
  chatProvider: string | null;
  runs: AgentRun[];
  activeRun: AgentRun | null;
  startAgent: (task: string) => void;
  pauseAgent: () => void;
  resumeAgent: () => void;
  stopAgent: () => void;
  approveStep: () => void;
  rejectStep: () => void;
  regenerateAgent: () => void;
  openRun: (id: string) => void;
  deleteRun: (id: string) => void;
  agentBusy: boolean;
  projects: Project[];
  usage: Usage;
  planId: PlanId;
  limits: { chat: number; agent: number };
  canUse: (kind: "chat" | "agent") => boolean;
  upgrade: (plan: PlanId) => void;
  toast: { id: string; text: string; tone: "ok" | "err" | "info" } | null;
  pushToast: (text: string, tone?: "ok" | "err" | "info") => void;
  exportData: () => void;
  resetData: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

const ADMIN_SEED = { name: "Aster Admin", email: "admin@aster.ai", password: "aster123" };
const DEMO_SEED = { name: "Demo User", email: "demo@aster.ai", password: "demo123" };
const COLORS = ["#6c5ce7", "#0ea5e9", "#f97316", "#10b981", "#ec4899"];

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<StoredUser[]>(() => {
    const existing = load<StoredUser[]>("users", []);
    if (existing.length) return existing;
    const seeded: StoredUser[] = [
      {
        id: "usr_admin",
        email: ADMIN_SEED.email,
        name: ADMIN_SEED.name,
        provider: "password",
        role: "admin",
        plan: "pro",
        createdAt: Date.now(),
        avatarColor: COLORS[0],
        passwordHash: undefined,
      },
      {
        id: "usr_demo",
        email: DEMO_SEED.email,
        name: DEMO_SEED.name,
        provider: "password",
        role: "member",
        plan: "free",
        createdAt: Date.now(),
        avatarColor: COLORS[1],
      },
    ];
    // Seed hashes asynchronously on first mount; sessions remain usable meanwhile.
    void Promise.all([hash(`${ADMIN_SEED.email}:${ADMIN_SEED.password}`), hash(`${DEMO_SEED.email}:${DEMO_SEED.password}`)]).then(([a, d]) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === "usr_admin" ? { ...u, passwordHash: u.passwordHash ?? a } : u.id === "usr_demo" ? { ...u, passwordHash: u.passwordHash ?? d } : u,
        ),
      );
    });
    return seeded;
  });
  const [session, setSession] = usePersistent<Session | null>("session", null);
  const [settings, setSettingsState] = usePersistent<Settings>("settings", DEFAULT_SETTINGS);
  const [conversations, setConversations] = usePersistent<Conversation[]>("conversations", []);
  const [runs, setRuns] = usePersistent<AgentRun[]>("runs", []);
  const [projects, setProjects] = usePersistent<Project[]>("projects", []);
  const [usageMap, setUsageMap] = usePersistent<Record<string, Usage>>("usage", {});
  const [page, setPage] = useState<Page>("home");
  const [mode, setMode] = useState<Mode>("chat");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [chatProvider, setChatProvider] = useState<string | null>(null);
  const [toast, setToast] = useState<Ctx["toast"]>(null);

  const abortRef = useRef<AbortController | null>(null);
  const engineRef = useRef<AgentEngine | null>(null);
  const browseRef = useRef<BrowseSession | null>(null);
  const [browseMessageId, setBrowseMessageId] = useState<string | null>(null);
  const [browseBusy, setBrowseBusy] = useState(false);

  useEffect(() => save("users", users), [users]);

  const user = useMemo(() => {
    const s = session && session.expiresAt > Date.now() ? session : null;
    if (!s) return null;
    const found = users.find((u) => u.id === s.userId);
    if (!found) return null;
    const { passwordHash: _omit, ...clean } = found;
    void _omit;
    return clean;
  }, [session, users]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", settings.theme === "dark" ? "#08080a" : "#f7f7f4");
  }, [settings.theme]);

  useEffect(() => () => {
    abortRef.current?.abort();
    browseRef.current?.stop();
  }, []);

  const setSettings = useCallback((p: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...p })), [setSettingsState]);
  const toggleTheme = useCallback(
    () => setSettingsState((s) => ({ ...s, theme: s.theme === "light" ? "dark" : "light" })),
    [setSettingsState],
  );

  const pushToast = useCallback((text: string, tone: "ok" | "err" | "info" = "info") => {
    const id = uid("t");
    setToast({ id, text, tone });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4200);
  }, []);

  const startSession = useCallback(
    (userId: string) => {
      setSession({ userId, createdAt: Date.now(), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    },
    [setSession],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const clean = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(clean)) return "Enter a valid email address.";
      if (!password) return "Enter your password.";
      const found = users.find((u) => u.email.toLowerCase() === clean);
      if (!found) return "No account with that email. Create one below.";
      if (!found.passwordHash) {
        // First sign-in before seeding finished — accept the seeded demo credentials once.
        const seed = clean === ADMIN_SEED.email ? ADMIN_SEED.password : clean === DEMO_SEED.email ? DEMO_SEED.password : null;
        if (!seed || seed !== password) return "Incorrect password.";
        const h = await hash(`${clean}:${password}`);
        setUsers((prev) => prev.map((u) => (u.id === found.id ? { ...u, passwordHash: h } : u)));
        startSession(found.id);
        return null;
      }
      const h = await hash(`${clean}:${password}`);
      if (h !== found.passwordHash) return "Incorrect password.";
      startSession(found.id);
      return null;
    },
    [startSession, users],
  );

  const createUser = useCallback(
    async (name: string, email: string, password: string, provider: "password" | "google"): Promise<{ id: string } | { error: string }> => {
      const clean = email.trim().toLowerCase();
      if (users.some((u) => u.email.toLowerCase() === clean)) return { error: "An account with that email already exists." as string };
      if (provider === "password" && password.length < 6) return { error: "Password must be at least 6 characters." };
      const next: StoredUser = {
        id: uid("usr"),
        email: clean,
        name: name.trim() || clean.split("@")[0],
        provider,
        role: users.length === 0 ? "admin" : "member",
        plan: "free",
        createdAt: Date.now(),
        avatarColor: COLORS[users.length % COLORS.length],
        passwordHash: provider === "password" ? await hash(`${clean}:${password}`) : undefined,
      };
      setUsers((prev) => [...prev, next]);
      startSession(next.id);
      return { id: next.id };
    },
    [startSession, users],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      if (!name.trim()) return "Enter your name.";
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email address.";
      if (password.length < 6) return "Password must be at least 6 characters.";
      const res = await createUser(name, email, password, "password");
      return "error" in res ? (res.error as string) : null;
    },
    [createUser],
  );

  const googleSignIn = useCallback(async () => {
    // Local demo of the Google flow: no external identity provider is called.
    const seeded = users.find((u) => u.provider === "google");
    if (seeded) {
      startSession(seeded.id);
      return null;
    }
    const email = `google.user.${String(Date.now()).slice(-5)}@gmail.com`;
    const res = await createUser("Google User", email, "", "google");
    return "error" in res ? (res.error as string) : null;
  }, [createUser, startSession, users]);

  const enterDemo = useCallback(
    (admin = false) => {
      const target = users.find((u) => (admin ? u.role === "admin" : u.email === DEMO_SEED.email)) ?? users[0];
      if (target) startSession(target.id);
    },
    [startSession, users],
  );

  const signOut = useCallback(() => {
    abortRef.current?.abort();
    engineRef.current?.stop();
    setSession(null);
    setActiveConversationId(null);
    setActiveRunId(null);
    setPage("home");
    setMode("chat");
  }, [setSession]);

  /* ---------------- usage & plan ---------------- */

  const planId: PlanId = user?.plan ?? "free";
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[0];
  const period = monthKey();
  const usage: Usage = usageMap[user?.id ?? "anon"]?.period === period ? usageMap[user?.id ?? "anon"] : { chat: 0, agent: 0, period };
  const limits = { chat: plan.chatLimit, agent: plan.agentLimit };

  const bumpUsage = useCallback(
    (kind: "chat" | "agent") => {
      if (!user) return;
      setUsageMap((map) => {
        const cur = map[user.id]?.period === period ? map[user.id] : { chat: 0, agent: 0, period };
        return { ...map, [user.id]: { ...cur, [kind]: cur[kind] + 1 } };
      });
    },
    [period, setUsageMap, user],
  );

  const canUse = useCallback(
    (kind: "chat" | "agent") => {
      if (!user) return false;
      return kind === "chat" ? usage.chat < limits.chat : usage.agent < limits.agent;
    },
    [limits.agent, limits.chat, usage.agent, usage.chat, user],
  );

  const upgrade = useCallback(
    (next: PlanId) => {
      if (!user) return;
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, plan: next } : u)));
      pushToast(next === "free" ? "Switched to the Free plan" : `Your workspace is now on ${PLANS.find((p) => p.id === next)?.name}`, "ok");
    },
    [pushToast, user],
  );

  /* ---------------- conversations ---------------- */

  const myConversations = useMemo(
    () => conversations.filter((c) => c.userId === user?.id).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt),
    [conversations, user?.id],
  );
  const activeConversation = useMemo(
    () => myConversations.find((c) => c.id === activeConversationId) ?? null,
    [activeConversationId, myConversations],
  );

  const patchConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
    },
    [setConversations],
  );

  const newConversation = useCallback(() => {
    const id = uid("conv");
    const conv: Conversation = {
      id,
      userId: user?.id ?? "anon",
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: "chat",
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(id);
    return id;
  }, [setConversations, user?.id]);

  const openConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setPage("chat");
  }, []);

  const renameConversation = useCallback(
    (id: string, title: string) => {
      patchConversation(id, (c) => ({ ...c, title: title.trim() || "Untitled chat" }));
      pushToast("Chat renamed", "ok");
    },
    [patchConversation, pushToast],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) setActiveConversationId(null);
      pushToast("Chat deleted", "ok");
    },
    [activeConversationId, pushToast, setConversations],
  );

  const togglePin = useCallback(
    (id: string) => patchConversation(id, (c) => ({ ...c, pinned: !c.pinned })),
    [patchConversation],
  );

  const agentContext = useCallback(() => {
    const last = runs.find((r) => r.userId === user?.id && r.status === "completed");
    if (!last) return undefined;
    return `**${last.artifact.title}**\n\n- Task: ${last.task}\n- Status: completed\n- Files: ${last.artifact.files.map((f) => f.name).join(", ")}\n\n${last.artifact.content.slice(0, 900)}`;
  }, [runs, user?.id]);

  const runStream = useCallback(
    async (conversationId: string, prompt: string, history: Message[], assistantId: string, provider: "new" | "auto") => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setChatBusy(true);
      setChatProvider(null);
      const update = (fn: (m: Message) => Message) =>
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === assistantId ? fn(m) : m)) } : c,
          ),
        );

      try {
        const result = await streamReply(
          settings,
          history,
          prompt,
          agentContext(),
          (chunk) => update((m) => ({ ...m, content: m.content + chunk, streaming: true })),
          controller.signal,
        );
        update((m) => ({ ...m, streaming: false, model: result.provider }));
        setChatProvider(result.note ?? result.provider);
        bumpUsage("chat");
        if (provider === "new") save("lastPrompt", prompt);
      } catch (e) {
        if (!controller.signal.aborted) {
          update((m) => ({ ...m, streaming: false, error: e instanceof Error ? e.message : "The model request failed." }));
        }
      } finally {
        setChatBusy(false);
        abortRef.current = null;
      }
    },
    [agentContext, bumpUsage, settings, setConversations],
  );

  const sendChat = useCallback(
    (raw: string) => {
      const prompt = raw.trim();
      if (!prompt || !user) return;
      if (!canUse("chat")) {
        pushToast(`Chat limit reached (${limits.chat}/month). Upgrade your plan to continue.`, "err");
        setPage("plans");
        return;
      }
      let conversationId = activeConversationId;
      if (!conversationId || !conversations.some((c) => c.id === conversationId)) conversationId = newConversation();
      const history = conversations.find((c) => c.id === conversationId)?.messages ?? [];
      const now = Date.now();
      const userMsg: Message = { id: uid("msg"), role: "user", content: prompt, createdAt: now };
      const assistantId = uid("msg");
      const assistant: Message = { id: assistantId, role: "assistant", content: "", createdAt: now + 1, streaming: true };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                title: c.messages.length ? c.title : prompt.slice(0, 48),
                updatedAt: now,
                messages: [...c.messages, userMsg, assistant],
              }
            : c,
        ),
      );
      setPage("chat");
      void runStream(conversationId, prompt, history, assistantId, "new");
    },
    [activeConversationId, canUse, conversations, limits.chat, newConversation, pushToast, runStream, setConversations, user],
  );

  const stopChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setChatBusy(false);
    setConversations((prev) =>
      prev.map((c) => ({ ...c, messages: c.messages.map((m) => (m.streaming ? { ...m, streaming: false, content: m.content || "_Stopped._" } : m)) })),
    );
  }, [setConversations]);

  const regenerate = useCallback(
    (messageId: string) => {
      const conv = activeConversation;
      if (!conv || chatBusy) return;
      const idx = conv.messages.findIndex((m) => m.id === messageId);
      const userIdx = [...conv.messages.slice(0, idx)].map((m) => m.role).lastIndexOf("user");
      if (idx < 0 || userIdx < 0) return;
      const prompt = conv.messages[userIdx].content;
      const history = conv.messages.slice(0, userIdx);
      patchConversation(conv.id, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, content: "", streaming: true, error: undefined } : m)),
      }));
      void runStream(conv.id, prompt, history, messageId, "auto");
    },
    [activeConversation, chatBusy, patchConversation, runStream],
  );

  /* ---------------- live browsing ---------------- */

  const patchMessage = useCallback(
    (conversationId: string, messageId: string, updater: (m: Message) => Message) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === messageId ? updater(m) : m)) }
            : c,
        ),
      );
    },
    [setConversations],
  );

  const startBrowseTask = useCallback(
    (raw: string) => {
      const prompt = raw.trim();
      if (!prompt || !user) return;
      if (!canUse("agent")) {
        pushToast(`Agent run limit reached (${limits.agent}/month). Upgrade your plan to continue.`, "err");
        setPage("plans");
        return;
      }
      browseRef.current?.stop();

      let conversationId = activeConversationId;
      if (!conversationId || !conversations.some((c) => c.id === conversationId)) conversationId = newConversation();
      const now = Date.now();
      const userMessage: Message = { id: uid("msg"), role: "user", content: prompt, createdAt: now };
      const assistantId = uid("msg");
      const assistant: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: now + 1,
        streaming: true,
        kind: "browse",
        browse: emptyBrowse(prompt),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, title: c.messages.length ? c.title : prompt.slice(0, 48), updatedAt: now, mode: "agent", messages: [...c.messages, userMessage, assistant] }
            : c,
        ),
      );
      setPage("chat");
      setBrowseMessageId(assistantId);
      setBrowseBusy(true);
      bumpUsage("agent");

      const current = () => conversations.find((c) => c.id === conversationId)?.messages.find((m) => m.id === assistantId)?.browse;

      const finish = (patch: Partial<BrowseState>) => {
        patchMessage(conversationId!, assistantId, (m) => ({
          ...m,
          streaming: false,
          browse: m.browse ? { ...m.browse, ...patch } : m.browse,
        }));
        setBrowseBusy(false);
        setBrowseMessageId(null);
      };

      const session = startBrowse(prompt, settings, {
        onPatch: (patch) => {
          patchMessage(conversationId!, assistantId, (m) => {
            if (!m.browse) return m;
            let next: BrowseState = { ...m.browse };
            if (patch.state) next = { ...next, ...patch.state };
            if (patch.log) next = { ...next, logs: [...next.logs, patch.log] };
            if (patch.step) next = { ...next, steps: next.steps.map((s) => (s.id === patch.step!.id ? { ...s, status: patch.step!.status } : s)) };
            if (patch.source) next = { ...next, sources: [...next.sources.filter((s) => s.url !== patch.source!.url), patch.source] };
            if (patch.timelineEntry) next = { ...next, timeline: [...next.timeline, patch.timelineEntry] };
            if (patch.answerChunk) next = { ...next, answer: next.answer + patch.answerChunk };
            return { ...m, browse: next, content: next.answer };
          });
        },
        onDone: (patch) => {
          finish(patch);
          if (patch.status === "done") pushToast("Agent finished browsing", "ok");
          if (patch.status === "error") pushToast(patch.error ?? "Browsing failed", "err");
        },
      });
      browseRef.current = session;
      void current;
    },
    [activeConversationId, bumpUsage, canUse, conversations, limits.agent, newConversation, patchMessage, pushToast, setConversations, settings, user],
  );

  const pauseBrowse = useCallback(() => browseRef.current?.pause(), []);
  const resumeBrowse = useCallback(() => browseRef.current?.resume(), []);
  const stopBrowse = useCallback(() => {
    browseRef.current?.stop();
    browseRef.current = null;
    setBrowseBusy(false);
    setBrowseMessageId(null);
  }, []);

  /* ---------------- agent ---------------- */

  const myRuns = useMemo(() => runs.filter((r) => r.userId === user?.id).sort((a, b) => b.createdAt - a.createdAt), [runs, user?.id]);
  const activeRun = useMemo(() => myRuns.find((r) => r.id === activeRunId) ?? null, [activeRunId, myRuns]);

  const persistRun = useCallback(
    (run: AgentRun) => {
      setRuns((prev) => {
        const exists = prev.some((r) => r.id === run.id);
        return exists ? prev.map((r) => (r.id === run.id ? run : r)) : [run, ...prev];
      });
      setActiveRunId(run.id);
    },
    [setRuns],
  );

  const createProjectFor = useCallback(
    (run: AgentRun) => {
      if (!user) return;
      const project: Project = {
        id: `proj_${run.id.slice(-8)}`,
        userId: user.id,
        name: run.artifact.title,
        kind: run.artifact.kind === "html" ? "website" : run.task.toLowerCase().includes("checklist") ? "checklist" : "report",
        status: "active",
        artifactCount: run.artifact.files.length,
        createdAt: run.createdAt,
        updatedAt: Date.now(),
        runIds: [run.id],
      };
      setProjects((prev) => [project, ...prev.filter((p) => p.id !== project.id)]);
    },
    [setProjects, user],
  );

  const startAgent = useCallback(
    (raw: string) => {
      const task = raw.trim();
      if (!task || !user) return;
      if (!canUse("agent")) {
        pushToast(`Agent run limit reached (${limits.agent}/month). Upgrade your plan to continue.`, "err");
        setPage("plans");
        return;
      }
      engineRef.current?.stop();
      const run = createRun(task, user.id, settings.autoApprove);
      persistRun(run);
      setPage("agent");
      setAgentBusy(true);
      bumpUsage("agent");

      const engine = new AgentEngine(run, {
        onChange: (next) => {
          setRuns((prev) => prev.map((r) => (r.id === next.id ? next : r)));
        },
        onComplete: (done) => {
          setAgentBusy(false);
          setRuns((prev) => prev.map((r) => (r.id === done.id ? done : r)));
          if (done.status === "completed") {
            createProjectFor(done);
            pushToast("Agent finished — your files are ready to download", "ok");
          }
        },
      });
      engineRef.current = engine;
      void engine.start().finally(() => setAgentBusy(false));
    },
    [bumpUsage, canUse, createProjectFor, limits.agent, persistRun, pushToast, setPage, setRuns, settings.autoApprove, user],
  );

  const pauseAgent = useCallback(() => engineRef.current?.pause(), []);
  const resumeAgent = useCallback(() => engineRef.current?.resume(), []);
  const stopAgent = useCallback(() => engineRef.current?.stop(), []);

  const approveStep = useCallback(() => {
    const run = activeRun;
    const step = run?.steps.find((s) => s.status === "awaiting_approval");
    if (step) engineRef.current?.approve(step.id);
  }, [activeRun]);

  const rejectStep = useCallback(() => {
    const run = activeRun;
    const step = run?.steps.find((s) => s.status === "awaiting_approval");
    if (step) engineRef.current?.reject(step.id);
  }, [activeRun]);

  const regenerateAgent = useCallback(() => {
    if (!activeRun) return;
    startAgent(activeRun.task);
  }, [activeRun, startAgent]);

  const openRun = useCallback(
    (id: string) => {
      setActiveRunId(id);
      setPage("agent");
    },
    [],
  );

  const deleteRun = useCallback(
    (id: string) => {
      setRuns((prev) => prev.filter((r) => r.id !== id));
      if (activeRunId === id) setActiveRunId(null);
      pushToast("Run deleted", "ok");
    },
    [activeRunId, pushToast, setRuns],
  );

  useEffect(() => {
    if (page === "agent" && !activeRunId && myRuns[0]) setActiveRunId(myRuns[0].id);
  }, [activeRunId, myRuns, page]);

  const myProjects = useMemo(() => projects.filter((p) => p.userId === user?.id).sort((a, b) => b.updatedAt - a.updatedAt), [projects, user?.id]);

  /* ---------------- data ---------------- */

  const exportData = useCallback(() => {
    if (!user) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      user: { ...user },
      conversations: myConversations,
      runs: myRuns,
      projects: myProjects,
      usage,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aster-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Workspace exported as JSON", "ok");
  }, [myConversations, myProjects, myRuns, pushToast, usage, user]);

  const resetData = useCallback(() => {
    if (!user) return;
    setConversations((prev) => prev.filter((c) => c.userId !== user.id));
    setRuns((prev) => prev.filter((r) => r.userId !== user.id));
    setProjects((prev) => prev.filter((p) => p.userId !== user.id));
    setActiveConversationId(null);
    setActiveRunId(null);
    pushToast("Your workspace data has been cleared", "ok");
  }, [pushToast, setConversations, setProjects, setRuns, user]);

  const allUsers = useMemo(() => users.map(({ passwordHash: _p, ...u }) => u), [users]);

  const value = useMemo<Ctx>(
    () => ({
      user,
      allUsers,
      signIn,
      signUp,
      googleSignIn,
      enterDemo,
      signOut,
      settings,
      setSettings,
      toggleTheme,
      theme: settings.theme,
      page,
      setPage,
      mode,
      setMode,
      conversations: myConversations,
      activeConversation,
      activeConversationId,
      openConversation,
      newConversation,
      renameConversation,
      deleteConversation,
      togglePin,
      sendChat,
      stopChat,
      regenerate,
      startBrowseTask,
      pauseBrowse,
      resumeBrowse,
      stopBrowse,
      browseBusy,
      browseMessageId,
      chatBusy,
      chatProvider,
      runs: myRuns,
      activeRun,
      startAgent,
      pauseAgent,
      resumeAgent,
      stopAgent,
      approveStep,
      rejectStep,
      regenerateAgent,
      openRun,
      deleteRun,
      agentBusy,
      projects: myProjects,
      usage,
      planId,
      limits,
      canUse,
      upgrade,
      toast,
      pushToast,
      exportData,
      resetData,
    }),
    [
      activeConversation, activeConversationId, activeRun, agentBusy, allUsers, approveStep, canUse, chatBusy, chatProvider,
      deleteConversation, deleteRun, enterDemo, exportData, googleSignIn, limits, mode, myConversations, newConversation,
      openConversation, openRun, page, pauseAgent, planId, pushToast, regenerate, regenerateAgent, rejectStep, renameConversation,
      resetData, resumeAgent, sendChat, setMode, setPage, setSettings, settings, signIn, signOut, signUp, startAgent, stopAgent,
      startBrowseTask, pauseBrowse, resumeBrowse, stopBrowse, browseBusy, browseMessageId,
      stopChat, toast, togglePin, toggleTheme, upgrade, usage, user, myProjects, myRuns,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
