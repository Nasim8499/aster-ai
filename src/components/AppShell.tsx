import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  Globe2,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useApp, type Page } from "@/lib/store";
import { Avatar, Badge, Button, IconButton, Input, Logo, Modal, ProgressRing } from "./ui";
import { cn } from "@/utils/cn";

function groupLabel(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Previous 7 days";
  if (days <= 30) return "Previous 30 days";
  return "Older";
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const {
    user, conversations, activeConversationId, newConversation, openConversation, deleteConversation,
    renameConversation, togglePin, planId, usage, limits, settings, toggleTheme, signOut, setPage, pushToast,
  } = useApp();
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const filtered = useMemo(
    () => conversations.filter((c) => (c.title + " " + c.messages.map((m) => m.content).join(" ")).toLowerCase().includes(query.toLowerCase())),
    [conversations, query],
  );
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((c) => {
      const key = groupLabel(c.updatedAt);
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    return [...map.entries()];
  }, [filtered]);

  const go = (p: Page) => {
    setPage(p);
    onNavigate?.();
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-1.5 py-3.5">
        <Logo size={28} />
        <IconButton label="Expand sidebar" onClick={() => setCollapsed(false)} className="mt-0.5"><ChevronsRight className="h-4 w-4" /></IconButton>
        <IconButton label="New chat" onClick={() => { newConversation(); go("chat"); }}><Plus className="h-4 w-4" /></IconButton>
        <IconButton label="Chats" onClick={() => go("chat")}><MessageSquare className="h-4 w-4" /></IconButton>
        <IconButton label="Plans & usage" onClick={() => go("plans")}><BarChart3 className="h-4 w-4" /></IconButton>
        <IconButton label="Settings" onClick={() => go("settings")}><SettingsIcon className="h-4 w-4" /></IconButton>
        {user?.role === "admin" && <IconButton label="Admin" onClick={() => go("admin")}><Shield className="h-4 w-4" /></IconButton>}
        <div className="mt-auto flex flex-col items-center gap-1.5">
          <IconButton label="Theme" onClick={toggleTheme}>{settings.theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</IconButton>
          <button onClick={() => go("settings")}><Avatar name={user?.name ?? "A"} color={user?.avatarColor} size={26} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-3">
        <button onClick={() => go("home")} className="flex min-w-0 items-center gap-2">
          <Logo size={26} />
          <span className="truncate text-[14.5px] font-semibold tracking-[-0.03em] text-pri">Aster<span className="text-[var(--accent)]">.</span></span>
        </button>
        <div className="ml-auto flex items-center">
          <IconButton label="Collapse sidebar" size={26} onClick={() => setCollapsed(true)}><ChevronsLeft className="h-4 w-4" /></IconButton>
          {onNavigate && <IconButton label="Close" size={26} onClick={onNavigate}><X className="h-4 w-4" /></IconButton>}
        </div>
      </div>

      <div className="px-2.5">
        <button
          onClick={() => { newConversation(); go("chat"); }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-medium text-pri transition-colors hover:bg-[rgb(var(--text)/0.06)]"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[rgb(var(--line))]"><Plus className="h-3 w-3" /></span>
          New chat
        </button>
      </div>

      <div className="relative mt-1 px-2.5">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ter" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          className="ring-focus w-full rounded-lg border border-transparent bg-[rgb(var(--text)/0.035)] py-1.5 pl-8 pr-2.5 text-[12.5px] text-pri placeholder:text-ter focus:border-[rgb(var(--line))]"
        />
      </div>

      <div className="thin-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && (
          <div className="px-2 py-6 text-center">
            <p className="text-[12px] text-ter">{query ? "No chats match that search." : "No chats yet."}</p>
            {!query && <p className="mt-0.5 text-[11px] text-ter">Start a conversation below.</p>}
          </div>
        )}
        {groups.map(([label, list]) => (
          <div key={label} className="mb-1">
            <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold tracking-[0.08em] text-ter uppercase">{label}</div>
            {list.map((c) => {
              const hasBrowse = c.messages.some((m) => m.kind === "browse");
              return (
                <div key={c.id} className={cn("group relative flex items-center rounded-lg", activeConversationId === c.id ? "bg-[rgb(var(--text)/0.07)]" : "hover:bg-[rgb(var(--text)/0.04)]")}>
                  <button
                    onClick={() => { openConversation(c.id); onNavigate?.(); }}
                    onDoubleClick={() => setRenaming({ id: c.id, title: c.title })}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                  >
                    {hasBrowse ? <Globe2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0 text-ter" />}
                    <span className="line-clamp-1 min-w-0 flex-1 text-[12.5px] text-pri">{c.title || "New chat"}</span>
                    {c.pinned && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                  </button>
                  <div className="absolute right-1 flex items-center rounded-lg bg-[var(--bg-elevated)] opacity-0 shadow-sm-soft transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton label="Rename" size={24} onClick={() => setRenaming({ id: c.id, title: c.title })}><Pencil className="h-3 w-3" /></IconButton>
                    <IconButton label={c.pinned ? "Unpin" : "Pin"} size={24} onClick={() => togglePin(c.id)}><Sparkles className={cn("h-3 w-3", c.pinned && "text-[var(--accent)]")} /></IconButton>
                    <IconButton label="Delete" size={24} onClick={() => deleteConversation(c.id)}><Trash2 className="h-3 w-3" /></IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-[rgb(var(--line))] p-2">
        <button onClick={() => go("plans")} className="mb-1.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[rgb(var(--text)/0.04)]">
          <ProgressRing value={Math.min(100, (usage.agent / Math.max(1, limits.agent)) * 100)} size={24} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-medium text-pri">{planId === "free" ? "Free plan" : planId === "pro" ? "Pro plan" : "Team plan"}</span>
            <span className="block text-[10px] text-ter">{usage.chat}/{limits.chat} chats · {usage.agent}/{limits.agent} browses</span>
          </span>
          <span className="text-[10.5px] font-medium text-[var(--accent)]">{planId === "free" ? "Upgrade" : "Manage"}</span>
        </button>
        <div className="flex items-center gap-1">
          <IconButton label="Plans & usage" onClick={() => go("plans")}><BarChart3 className="h-4 w-4" /></IconButton>
          <IconButton label="Settings" onClick={() => go("settings")}><SettingsIcon className="h-4 w-4" /></IconButton>
          <IconButton label="Toggle theme" onClick={toggleTheme}>{settings.theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</IconButton>
          {user?.role === "admin" && <IconButton label="Admin dashboard" onClick={() => go("admin")}><Shield className="h-4 w-4" /></IconButton>}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => go("settings")} title={user?.email} className="rounded-full"><Avatar name={user?.name ?? "A"} color={user?.avatarColor} size={24} /></button>
            <IconButton label="Sign out" onClick={() => { signOut(); pushToast("Signed out", "ok"); }}><LogOut className="h-4 w-4" /></IconButton>
          </div>
        </div>
      </div>

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename chat"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => { if (renaming) renameConversation(renaming.id, renaming.title); setRenaming(null); }}>Save</Button>
          </>
        }
      >
        <Input
          autoFocus
          value={renaming?.title ?? ""}
          onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && renaming) { renameConversation(renaming.id, renaming.title); setRenaming(null); }
          }}
          placeholder="Chat title"
        />
      </Modal>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, planId, settings, toggleTheme, setPage } = useApp();
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--bg)]">
      <aside className="hidden w-[260px] shrink-0 border-r border-[rgb(var(--line))] bg-[rgb(var(--text)/0.014)] md:flex md:flex-col">
        <SidebarBody />
      </aside>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] md:hidden" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", stiffness: 380, damping: 36 }} className="fixed inset-y-0 left-0 z-50 w-[272px] border-r border-[rgb(var(--line))] bg-[var(--bg-elevated)] md:hidden">
              <SidebarBody onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <button onClick={() => setDrawer(true)} aria-label="Open sidebar" className="absolute left-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-lg text-sec hover:bg-[rgb(var(--text)/0.05)] hover:text-pri md:hidden">
          <Menu className="h-4 w-4" />
        </button>
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1 md:hidden">
          <Badge tone={planId === "free" ? "neutral" : "accent"}>{planId}</Badge>
          <IconButton label="Toggle theme" size={30} onClick={toggleTheme}>{settings.theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</IconButton>
          <button onClick={() => setPage("settings")} aria-label="Account settings" title={user?.email}><Avatar name={user?.name ?? "A"} color={user?.avatarColor} size={24} /></button>
        </div>

        <main className="min-h-0 flex-1 pt-10 md:pt-0">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
