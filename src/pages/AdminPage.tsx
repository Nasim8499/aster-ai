import { useEffect, useState } from "react";
import { Activity, Bot, Database, MessageSquare, RefreshCw, Server, ShieldCheck, Users } from "lucide-react";
import { Avatar, Badge, Button, Select } from "@/components/ui";
import { useApp } from "@/lib/store";
import { PLANS, type PlanId } from "@/lib/types";
import { fullDate, relTime } from "@/lib/format";

interface Stats {
  users: number;
  conversations: number;
  runs: number;
  completed: number;
  messages: number;
}

function readStats(): Stats {
  const read = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(`aster:${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const convos = read<any[]>("conversations", []);
  const users = read<any[]>("users", []);
  const browseMessages = convos.flatMap((c) => (c.messages ?? []).filter((m: any) => m?.kind === "browse"));
  return {
    users: users.length,
    conversations: convos.length,
    messages: convos.reduce((n, c) => n + (c.messages?.length ?? 0), 0),
    runs: browseMessages.length,
    completed: browseMessages.filter((m: any) => m.browse?.status === "done").length,
  };
}

export default function AdminPage() {
  const { user, allUsers, conversations, planId, upgrade, pushToast } = useApp();
  const [stats, setStats] = useState<Stats>(() => readStats());

  useEffect(() => setStats(readStats()), []);

  if (user?.role !== "admin") {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-sm">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-ter" />
          <h1 className="text-[16px] font-semibold text-pri">Admin access required</h1>
          <p className="mt-1 text-[12.5px] text-ter">Sign in with the admin account to open the dashboard.</p>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Accounts", value: stats.users, icon: Users, hint: "Local accounts" },
    { label: "Conversations", value: stats.conversations, icon: MessageSquare, hint: `${stats.messages} messages` },
    { label: "Browse runs", value: stats.runs, icon: Bot, hint: `${stats.completed} completed` },
    { label: "Model", value: "Gemini", icon: Server, hint: "Provider registry" },
  ];

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-pri">Admin dashboard</h1>
            <p className="mt-1 text-[13px] text-sec">Workspace health, accounts and model configuration.</p>
          </div>
          <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => { setStats(readStats()); pushToast("Stats refreshed from local storage", "ok"); }}>
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-3.5 shadow-sm-soft">
              <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-ter uppercase">
                <c.icon className="h-3.5 w-3.5" /> {c.label}
              </div>
              <div className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-pri">{c.value}</div>
              <div className="text-[11px] text-ter">{c.hint}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] shadow-sm-soft">
            <div className="flex items-center gap-2 border-b border-[rgb(var(--line))] px-4 py-3">
              <Users className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-[13px] font-semibold text-pri">Accounts</h2>
              <Badge tone="neutral" className="ml-auto">{allUsers.length}</Badge>
            </div>
            <div className="divide-y divide-[rgb(var(--line))]">
              {allUsers.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-2.5 px-4 py-2.5">
                  <Avatar name={u.name} color={u.avatarColor} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-pri">{u.name}</span>
                      {u.role === "admin" && <Badge tone="accent">admin</Badge>}
                      {u.id === user.id && <Badge tone="green">you</Badge>}
                    </div>
                    <div className="truncate text-[11px] text-ter">{u.email} · joined {fullDate(u.createdAt)}</div>
                  </div>
                  <Select
                    className="w-[104px]"
                    value={u.plan}
                    onChange={(v) => {
                      if (u.id === user.id) {
                        upgrade(v as PlanId);
                      } else {
                        // Admin plan changes persist through the same local store.
                        try {
                          const raw = localStorage.getItem("aster:users");
                          const list = raw ? JSON.parse(raw) : [];
                          localStorage.setItem("aster:users", JSON.stringify(list.map((x: any) => (x.id === u.id ? { ...x, plan: v } : x))));
                          pushToast(`${u.email} moved to ${v}. Reload to see it reflected.`, "ok");
                        } catch {
                          pushToast("Could not update that account", "err");
                        }
                      }
                    }}
                    options={PLANS.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
              <div className="mb-2 flex items-center gap-2">
                <Database className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-[13px] font-semibold text-pri">Backend status</h2>
              </div>
              <div className="space-y-1.5 text-[12px]">
                {[
                  ["Auth middleware", "Requires ADMIN_PASSWORD + signed cookie"],
                  ["Browser Use v4", "Server-side key only"],
                  ["Gemini chat", "Server-side key only"],
                  ["Database", "Schema included; running locally"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2 border-t border-[rgb(var(--line))] pt-1.5">
                    <span className="text-sec">{k}</span>
                    <span className="text-right text-[10.5px] text-ter">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="text-[13px] font-semibold text-pri">Your recent runs</h2>
              </div>
              {(() => {
                const browseRuns = conversations
                  .flatMap((c) => c.messages.filter((m) => m.browse).map((m) => ({ id: m.id, ...m.browse! })))
                  .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
                  .slice(0, 5);
                if (!browseRuns.length) return <p className="text-[12px] text-ter">No browsing runs yet.</p>;
                return browseRuns.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 border-t border-[rgb(var(--line))] py-1.5 text-[11.5px]">
                    <span className="min-w-0 flex-1 truncate text-sec">{r.task}</span>
                    <Badge tone={r.status === "done" ? "green" : r.status === "error" ? "red" : "neutral"}>{r.status}</Badge>
                    <span className="text-[10px] text-ter">{relTime(r.endedAt ?? r.startedAt)}</span>
                  </div>
                ));
              })()}
            </div>

            <div className="rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-4 shadow-sm-soft">
              <h2 className="mb-1 text-[13px] font-semibold text-pri">Billing & plans</h2>
              <p className="text-[11.5px] leading-relaxed text-ter">
                Plan management placeholder: connect a billing provider and persist subscriptions in the <code className="font-mono">subscriptions</code>{" "}
                table. Current account is on the <b className="text-sec">{planId}</b> plan.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[10.5px] text-ter">Admin data is read from this browser. In production, serve these metrics from the server API.</p>
      </div>
    </div>
  );
}
