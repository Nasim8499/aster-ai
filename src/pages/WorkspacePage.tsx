import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Globe2,
  MessageSquare,
  RefreshCw,
  Share2,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import BrowseCard from "@/components/BrowseCard";
import Markdown from "@/components/Markdown";
import { Avatar, Badge, Button, Logo, Segmented, Skeleton, useCopy } from "@/components/ui";
import type { Message } from "@/lib/types";
import { useApp } from "@/lib/store";
import { relTime } from "@/lib/format";
import { cn } from "@/utils/cn";

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-[rgb(var(--text)/0.055)] px-4 py-2.5 text-[15px] leading-relaxed text-pri sm:max-w-[75%]">
        {message.content}
      </div>
    </div>
  );
}

function AgentMark() {
  return (
    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white shadow-sm-soft">
      {<Sparkles className="h-3.5 w-3.5" />}
    </div>
  );
}

function AssistantActions({ message }: { message: Message }) {
  const { regenerate, startBrowseTask, pushToast } = useApp();
  const { copied, copy } = useCopy();
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  return (
    <div className="mt-1.5 flex items-center gap-0.5">
      <button onClick={() => copy(message.content)} className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-ter hover:bg-[rgb(var(--text)/0.05)] hover:text-pri">
        {copied ? <Check className="h-3 w-3 text-[#10b981]" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : ""}
      </button>
      <button
        onClick={() => {
          if (message.browse) startBrowseTask(message.browse.task);
          else regenerate(message.id);
        }}
        className="rounded-md p-1.5 text-ter hover:bg-[rgb(var(--text)/0.05)] hover:text-pri"
        aria-label="Regenerate"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => { setVote("up"); pushToast("Thanks for the feedback", "ok"); }}
        className={cn("rounded-md p-1.5 hover:bg-[rgb(var(--text)/0.05)]", vote === "up" ? "text-[#10b981]" : "text-ter hover:text-pri")}
        aria-label="Good response"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => { setVote("down"); pushToast("Feedback noted — try regenerating with a more specific prompt", "info"); }}
        className={cn("rounded-md p-1.5 hover:bg-[rgb(var(--text)/0.05)]", vote === "down" ? "text-[#e5484d]" : "text-ter hover:text-pri")}
        aria-label="Bad response"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => { copy(message.content); pushToast("Answer copied — share it anywhere", "ok"); }} className="rounded-md p-1.5 text-ter hover:bg-[rgb(var(--text)/0.05)] hover:text-pri" aria-label="Share">
        <Share2 className="h-3.5 w-3.5" />
      </button>
      <span className="ml-1 hidden text-[10.5px] text-ter sm:inline">
        {message.browse ? (message.browse.engine === "reader" ? "live web" : "real Chrome") : message.model === "gemini" ? "Gemini" : "demo model"} · {relTime(message.createdAt)}
      </span>
    </div>
  );
}

function ThreadMessage({ message }: { message: Message }) {
  if (message.role === "user") return <UserBubble message={message} />;
  return (
    <div className="flex gap-3">
      <AgentMark />
      <div className="min-w-0 flex-1">
        {message.browse && <div className="mb-3"><BrowseCard browse={message.browse} /></div>}
        {message.browse && message.content && (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.08em] text-ter uppercase">Final result</span>
            <span className="h-px flex-1 bg-[rgb(var(--line))]" />
            {message.browse.status === "done" && <span className="text-[10px] text-[#0f9f6e] dark:text-[#4ade9f]">completed</span>}
          </div>
        )}
        {message.content ? (
          <Markdown text={message.content} />
        ) : message.streaming && !message.browse ? (
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2 text-[12px] text-ter">
              <span className="flex gap-1">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.14 }} />)}</span>
              Thinking…
            </div>
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ) : null}
        {message.streaming && message.content && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] bg-[var(--accent)] caret-blink" />}
        {message.error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-[rgb(229_72_77/0.26)] bg-[rgb(229_72_77/0.06)] p-2.5 text-[12.5px] text-[#b3353a] dark:text-[#ff9a9d]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {message.error}
          </div>
        )}
        {!message.streaming && message.content && <AssistantActions message={message} />}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const {
    activeConversation, sendChat, stopChat, startBrowseTask, mode, setMode, settings, setSettings,
    chatBusy, browseBusy, stopBrowse, chatProvider, user, planId, limits, usage, setPage,
  } = useApp();
  const [value, setValue] = useState("");
  const [menu, setMenu] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const messages = activeConversation?.messages ?? [];
  const busy = chatBusy || browseBusy;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content, messages[messages.length - 1]?.browse?.screenshot]);

  useEffect(() => {
    area.current?.focus();
  }, [activeConversation?.id]);

  const submit = (override?: string) => {
    const prompt = (override ?? value).trim();
    if (!prompt || busy) return;
    setValue("");
    if (mode === "agent") startBrowseTask(prompt);
    else sendChat(prompt);
  };

  const empty = messages.length === 0;
  const limitHit = mode === "agent" ? usage.agent >= limits.agent : usage.chat >= limits.chat;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* top bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3 sm:px-4">
        <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-semibold tracking-[-0.01em] text-pri hover:bg-[rgb(var(--text)/0.05)]">
          {activeConversation?.title ?? "New chat"}
          <ChevronDown className="h-3.5 w-3.5 text-ter" />
        </button>
        {activeConversation && <Badge tone="neutral" className="hidden sm:inline-flex">{messages.length} messages</Badge>}
        <AnimatePresence>
          {menu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute left-3 top-12 z-30 w-60 overflow-hidden rounded-xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-1 shadow-lg-soft">
                <div className="px-2 py-1.5 text-[10.5px] font-semibold tracking-[0.1em] text-ter uppercase">This conversation</div>
                <button onClick={() => { setPage("home"); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-sec hover:bg-[rgb(var(--text)/0.05)] hover:text-pri">
                  <MessageSquare className="h-3.5 w-3.5" /> New chat
                </button>
                <button onClick={() => { void navigator.clipboard?.writeText(messages.map((m) => `${m.role}: ${m.content}`).join("\n\n")); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-sec hover:bg-[rgb(var(--text)/0.05)] hover:text-pri">
                  <Copy className="h-3.5 w-3.5" /> Copy conversation
                </button>
                <button onClick={() => { setPage("settings"); setMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-sec hover:bg-[rgb(var(--text)/0.05)] hover:text-pri">
                  <Globe2 className="h-3.5 w-3.5" /> Browser & model settings
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] bg-[var(--bg-elevated)] px-2.5 py-1.5 sm:flex">
            <span className={cn("h-1.5 w-1.5 rounded-full", settings.provider === "server" ? "bg-[#10b981]" : "bg-[var(--accent)]")} />
            <span className="text-[11.5px] text-sec">{settings.provider === "server" ? settings.geminiModel : "Demo model"}</span>
          </div>
          <button onClick={() => setPage("plans")} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] text-ter hover:text-pri">
            <Avatar name={user?.name ?? "A"} color={user?.avatarColor} size={22} />
            <span className="hidden sm:inline">{planId}</span>
          </button>
        </div>
      </div>

      {/* thread */}
      <div ref={scroller} className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} className="mb-4">
              <Logo size={44} />
            </motion.div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-pri sm:text-[30px]">
              {mode === "agent" ? "Give the agent a task" : "What can I help with?"}
            </h1>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ter">
              {mode === "agent"
                ? "Browser Use will drive your real Chrome, step by step, and stream a live screenshot of every page it opens."
                : "Ask anything. Switch to Agent when you want your own Chrome to research the web for you."}
            </p>
            {mode === "agent" && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-[rgb(245_158_11/0.3)] bg-[rgb(245_158_11/0.07)] px-3.5 py-2.5 text-left">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a16207] dark:text-[#fbbf24]" />
                <p className="text-[11.5px] leading-relaxed text-[#8a5a06] dark:text-[#fbbf24]">
                  <b>Fully close Chrome before starting.</b> The agent takes control of your real Chrome profile, so it must not already be running.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-5">
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
                    <ThreadMessage message={m} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="h-6" />
          </div>
        )}
      </div>

      {/* composer */}
      <div className="shrink-0 bg-[var(--bg)] px-3 pb-2.5 pt-1 sm:px-4">
        <div className="mx-auto w-full max-w-3xl">
          {chatProvider && chatProvider !== "gemini" && chatProvider !== "demo" && (
            <div className="mb-2 rounded-lg border border-[rgb(245_158_11/0.3)] bg-[rgb(245_158_11/0.07)] px-3 py-1.5 text-[10.5px] leading-relaxed text-[#8a5a06] dark:text-[#fbbf24]">
              {chatProvider}
            </div>
          )}
          {mode === "agent" && settings.browseEngine === "real" && !busy && (
            <div className="mb-2 flex items-center gap-1.5 px-1 text-[10.5px] text-[#a16207] dark:text-[#fbbf24]">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>Fully close Chrome before starting — the agent takes over your real profile.</span>
            </div>
          )}
          {limitHit && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-[rgb(245_158_11/0.3)] bg-[rgb(245_158_11/0.07)] px-3 py-2">
              <p className="flex-1 text-[11.5px] text-[#8a5a06] dark:text-[#fbbf24]">
                You've reached the {mode === "agent" ? "agent run" : "chat"} limit on the {planId} plan.
              </p>
              <Button size="sm" variant="primary" onClick={() => setPage("plans")}>Upgrade</Button>
            </div>
          )}
          <div className="rounded-[22px] border border-[rgb(var(--line))] bg-[var(--bg-elevated)] p-2 shadow-lg-soft">
            <textarea
              ref={area}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={mode === "agent" ? "Ask Aster to browse the web for you…" : "Message Aster…"}
              className="thin-scroll max-h-44 min-h-[42px] w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-pri placeholder:text-ter focus:outline-none"
              style={{ height: "auto" }}
            />
            <div className="flex items-center gap-1.5 px-0.5 pt-1">
              <Segmented
                size="sm"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "chat", label: <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Chat</span> },
                  { value: "agent", label: <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3" /> Agent</span> },
                ]}
              />
              <span className="hidden truncate pl-1 text-[10.5px] text-ter sm:block">
                {mode === "agent" ? "Real browser · live preview · citations" : "Instant answers · markdown · code"}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => setSettings({ provider: settings.provider === "demo" ? "server" : "demo" })}
                  title="Switch model provider"
                  className="hidden rounded-md px-1.5 py-1 text-[10.5px] font-medium text-ter hover:bg-[rgb(var(--text)/0.05)] hover:text-pri sm:block"
                >
                  {settings.provider === "demo" ? "Demo model" : settings.geminiModel}
                </button>
                {busy ? (
                  <button
                    onClick={() => (browseBusy ? stopBrowse() : stopChat())}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[rgb(var(--line))] px-3 text-[12px] font-medium text-sec hover:text-pri"
                  >
                    <Square className="h-3 w-3 fill-current" /> Stop
                  </button>
                ) : null}
                <button
                  onClick={() => submit()}
                  disabled={!value.trim() || busy || limitHit}
                  aria-label={mode === "agent" ? "Start browsing" : "Send message"}
                  className="ink-btn grid h-9 w-9 place-items-center rounded-full disabled:opacity-30"
                >
                  <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.3} />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-center text-[10.5px] text-ter">
            <Bot className="h-3 w-3" />
            <span>Aster {mode === "agent" ? "browses real websites (screenshots via Microlink)" : "can make mistakes"} · Check important details.</span>
            <button onClick={() => setPage("settings")} className="hidden underline underline-offset-2 hover:text-sec sm:inline">Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}
