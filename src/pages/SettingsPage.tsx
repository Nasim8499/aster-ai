import { useState } from "react";
import { AlertTriangle, Check, Database, Download, Globe2, KeyRound, Loader2, Moon, Play, Server, Shield, Sparkles, Sun, Trash2 } from "lucide-react";
import { Avatar, Badge, Button, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { useApp } from "@/lib/store";
import { GEMINI_MODELS, type BrowseEngine } from "@/lib/types";
import { webSearch } from "@/lib/browse";
import { cn } from "@/utils/cn";

export default function SettingsPage() {
  const { user, settings, setSettings, toggleTheme, exportData, resetData, planId, signOut, pushToast } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [engineTest, setEngineTest] = useState<{ state: "idle" | "loading" | "ok" | "err"; message?: string }>({ state: "idle" });

  const testBrowser = async () => {
    setEngineTest({ state: "loading" });
    if (settings.browseEngine === "reader") {
      try {
        const results = await webSearch("visa requirements Singapore");
        setEngineTest(
          results.length
            ? { state: "ok", message: `Live reader online — found ${results.length} real results` }
            : { state: "err", message: "Search returned no results — check your network" },
        );
      } catch (e) {
        setEngineTest({ state: "err", message: e instanceof Error ? e.message : "Reader engine unavailable" });
      }
      return;
    }
    const base = (settings.agentApiUrl.trim() || "http://127.0.0.1:8000").replace(/\/+$/, "");
    try {
      const headers: Record<string, string> = {};
      if (settings.agentToken.trim()) headers["x-agent-token"] = settings.agentToken.trim();
      const res = await fetch(`${base}/health`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEngineTest({
        state: json.ok ? "ok" : "err",
        message: json.ok
          ? `Real Chrome agent ready · ${json.llm_provider}/${json.llm_model} · profile “${json.chrome_profile}”`
          : `Backend reachable but browser_use unavailable: ${json.import_error ?? "unknown error"}`,
      });
    } catch (e) {
      setEngineTest({
        state: "err",
        message: e instanceof Error && /fetch/i.test(e.message) ? `No agent backend at ${base}. Run: cd backend && uvicorn main:app --port 8000` : e instanceof Error ? e.message : "Agent backend unreachable",
      });
    }
  };

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-pri">Settings</h1>
        <p className="mt-1 text-[13px] text-sec">Profile, appearance, model provider and workspace data.</p>

        <div className="mt-6 space-y-3">
          {/* profile */}
          <section className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-[13px] font-semibold text-pri">Profile</h2>
              <Badge tone={planId === "free" ? "neutral" : "accent"} className="ml-auto">{planId} plan</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={user?.name ?? "A"} color={user?.avatarColor} size={44} />
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-pri">{user?.name}</div>
                <div className="truncate text-[12px] text-ter">{user?.email}</div>
              </div>
              <div className="ml-auto flex gap-2">
                <Badge tone="neutral">{user?.provider === "google" ? "Google account" : "Email & password"}</Badge>
                {user?.role === "admin" && <Badge tone="accent">Admin</Badge>}
              </div>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ter">
              This build stores accounts on this device. In production, replace the local repository with the provided database schema
              (<code className="rounded bg-[rgb(var(--text)/0.06)] px-1">db/schema.sql</code>) and server session routes.
            </p>
          </section>

          {/* appearance */}
          <section className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
            <div className="mb-3 flex items-center gap-2">
              {settings.theme === "light" ? <Sun className="h-4 w-4 text-[var(--accent)]" /> : <Moon className="h-4 w-4 text-[var(--accent)]" />}
              <h2 className="text-[13px] font-semibold text-pri">Appearance</h2>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12.5px] font-medium text-pri">Theme</div>
                <div className="text-[11.5px] text-ter">Light and dark are stored with your workspace settings.</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-ter">{settings.theme === "light" ? "Light" : "Dark"}</span>
                <Switch checked={settings.theme === "dark"} onChange={toggleTheme} label="Dark mode" />
              </div>
            </div>
          </section>

          {/* model provider */}
          <section className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-[13px] font-semibold text-pri">AI model provider</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provider">
                <Select
                  value={settings.provider}
                  onChange={(v) => {
                    setSettings({ provider: v as "demo" | "server" });
                    pushToast(v === "server" ? "Using the server model proxy" : "Using the built-in demo model", "ok");
                  }}
                  options={[
                    { value: "demo", label: "Built-in demo model" },
                    { value: "server", label: "Server proxy (Gemini)" },
                  ]}
                />
              </Field>
              <Field label="Gemini model">
                <Select value={settings.geminiModel} onChange={(v) => setSettings({ geminiModel: v })} options={GEMINI_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="API base URL (optional)" hint="Leave empty for same-origin /api routes. Keys belong in server environment variables — this client never sends one.">
                <Input value={settings.proxyBase} onChange={(e) => setSettings({ proxyBase: e.target.value })} placeholder="https://your-app.vercel.app" className="font-mono text-[12.5px]" />
              </Field>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--text)/0.025)] p-2.5">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ter" />
              <p className="text-[11px] leading-relaxed text-ter">
                Server routes: <code className="font-mono">/api/chat</code>, <code className="font-mono">/api/agent/start</code>,{" "}
                <code className="font-mono">/api/agent/status</code>, <code className="font-mono">/api/agent/result</code>,{" "}
                <code className="font-mono">/api/projects</code>. Set <code className="font-mono">GEMINI_API_KEY</code> there to enable live
                answers; otherwise Chat falls back to the demo model with a visible note.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[rgb(var(--line))] px-3 py-2">
              <div>
                <div className="text-[12.5px] font-medium text-pri">Auto-approve agent steps</div>
                <div className="text-[11px] text-ter">Skip the approval gates on major steps.</div>
              </div>
              <Switch checked={settings.autoApprove} onChange={(v) => setSettings({ autoApprove: v })} label="Auto approve steps" />
            </div>
          </section>

          {/* real Chrome agent */}
          <section className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
            <div className="mb-3 flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-[13px] font-semibold text-pri">Real Chrome agent</h2>
              <Badge tone={engineTest.state === "ok" ? "green" : "accent"} className="ml-auto">
                {settings.browseEngine === "real" ? "Browser Use" : "Live reader"}
              </Badge>
            </div>

            <div className="mb-3 flex items-start gap-2 rounded-lg border border-[rgb(245_158_11/0.3)] bg-[rgb(245_158_11/0.07)] px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a16207] dark:text-[#fbbf24]" />
              <p className="text-[11.5px] leading-relaxed text-[#8a5a06] dark:text-[#fbbf24]">
                <b>Fully close Chrome before starting.</b> The Python backend drives your real Chrome profile with Browser Use, so Chrome must not already be running.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Agent engine" hint="Real Chrome runs the Python Browser Use backend. Live reader is the no-backend fallback (real page text + screenshots).">
                <Select
                  value={settings.browseEngine}
                  onChange={(v) => { setSettings({ browseEngine: v as BrowseEngine }); setEngineTest({ state: "idle" }); }}
                  options={[
                    { value: "real", label: "Real Chrome (Browser Use)" },
                    { value: "reader", label: "Live reader (fallback)" },
                  ]}
                />
              </Field>
              <Field label="Max agent steps" hint="Passed to agent.run(max_steps=…).">
                <Select value={String(settings.maxSteps)} onChange={(v) => setSettings({ maxSteps: Number(v) })} options={[
                  { value: "10", label: "10 steps" }, { value: "25", label: "25 steps" }, { value: "50", label: "50 steps" }, { value: "100", label: "100 steps" },
                ]} />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1.5fr_1fr]">
              <Field label="Agent API URL" hint="The Python backend (backend/main.py). Default: http://127.0.0.1:8000">
                <Input value={settings.agentApiUrl} onChange={(e) => { setSettings({ agentApiUrl: e.target.value }); setEngineTest({ state: "idle" }); }} placeholder="http://127.0.0.1:8000" className="font-mono text-[12.5px]" />
              </Field>
              <Field label="Access token (optional)" hint="Only if AGENT_TOKEN is set in backend/.env">
                <Input type="password" value={settings.agentToken} onChange={(e) => setSettings({ agentToken: e.target.value })} placeholder="x-agent-token" className="font-mono text-[12.5px]" />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Pages per reader run">
                <Select value={String(settings.maxSources)} onChange={(v) => setSettings({ maxSources: Number(v) })} options={[
                  { value: "1", label: "1 page" }, { value: "2", label: "2 pages" }, { value: "3", label: "3 pages" }, { value: "4", label: "4 pages" },
                ]} />
              </Field>
              <div className="flex items-end gap-2">
                <Button size="sm" variant="secondary" loading={engineTest.state === "loading"} icon={<Play className="h-3.5 w-3.5" />} onClick={testBrowser}>
                  Test agent
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSettings({ browseEngine: "reader", agentApiUrl: "" }); setEngineTest({ state: "ok", message: "Using the built-in live reader engine" }); pushToast("Browser engine set to live reader", "ok"); }}>
                  Use reader
                </Button>
              </div>
            </div>

            {engineTest.state !== "idle" && (
              <div className={cn("mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed", engineTest.state === "ok" ? "text-[#0f9f6e] dark:text-[#4ade9f]" : engineTest.state === "err" ? "text-[#d13a3f] dark:text-[#ff8a8e]" : "text-ter")}>
                {engineTest.state === "loading" && <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" />}
                {engineTest.state === "ok" && <Check className="mt-0.5 h-3 w-3 shrink-0" />}
                {engineTest.state === "err" && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />}
                {engineTest.message}
              </div>
            )}

            <pre className="mt-3 overflow-x-auto rounded-lg border border-[rgb(var(--line))] bg-[var(--code-bg)] p-3 font-mono text-[10.5px] leading-relaxed text-[#dfe3f5]">{`cd backend
pip install -r requirements.txt
cp .env.example .env     # add your LLM key
uvicorn main:app --port 8000`}</pre>
            <p className="mt-2 text-[11px] leading-relaxed text-ter">
              Screenshots are captured in the <code className="rounded bg-[rgb(var(--text)/0.06)] px-1">on_step_end</code> hook through <code className="rounded bg-[rgb(var(--text)/0.06)] px-1">ScreenshotEvent(full_page=False)</code>, together with <code className="rounded bg-[rgb(var(--text)/0.06)] px-1">history.urls()</code> and <code className="rounded bg-[rgb(var(--text)/0.06)] px-1">history.model_thoughts()</code>, then streamed over SSE.
            </p>
          </section>

          {/* data */}
          <section className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-[13px] font-semibold text-pri">Workspace data</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={exportData}>Export JSON</Button>
              <Button size="sm" variant="ghost" icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => { toggleTheme(); pushToast("Theme toggled", "ok"); }}>Toggle theme</Button>
              <Button size="sm" variant="ghost" className="text-[#e5484d]" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmReset(true)}>Clear my data</Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ter">
              Chats, agent runs, projects and usage are stored in this browser under the <code className="rounded bg-[rgb(var(--text)/0.06)] px-1">aster:</code>{" "}
              namespace. Clearing removes them permanently for this account.
            </p>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
            <div className="flex items-center gap-2 text-[12px] text-ter"><Check className="h-4 w-4 text-[#10b981]" /> Signed in locally · AI can make mistakes.</div>
            <Button size="sm" variant="secondary" onClick={signOut}>Sign out</Button>
          </section>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Clear workspace data?"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={() => { resetData(); setConfirmReset(false); }}>Delete everything</Button>
          </>
        }
      >
        <div className={cn("flex items-start gap-2.5 rounded-lg border border-[rgb(229_72_77/0.26)] bg-[rgb(229_72_77/0.06)] p-3")}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#e5484d]" />
          <p className="text-[12.5px] leading-relaxed text-sec">
            This permanently deletes all chats, agent runs and projects for <b className="text-pri">{user?.email}</b>. Your account and
            settings stay. Export a copy first if you need one.
          </p>
        </div>
      </Modal>
    </div>
  );
}
