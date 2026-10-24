import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleDashed,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCw,
  Search,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { useState } from "react";
import type { Artifact, BrowseState } from "@/lib/types";
import { downloadHtml, downloadMarkdown, downloadPdf } from "@/lib/export";
import { useApp } from "@/lib/store";
import { Badge, Button, IconButton, useCopy } from "./ui";
import { cn } from "@/utils/cn";

function hostOf(url: string | null) {
  if (!url) return "about:blank";
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function favicon(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<BrowseState["status"], string> = {
  idle: "Ready",
  running: "Browsing",
  paused: "Paused",
  done: "Completed",
  error: "Failed",
  stopped: "Stopped",
};

export default function BrowseCard({ browse }: { browse: BrowseState }) {
  const { pauseBrowse, resumeBrowse, stopBrowse, pushToast, startBrowseTask, user } = useApp();
  const [tab, setTab] = useState<"plan" | "timeline" | "sources" | "logs">("plan");
  const [open, setOpen] = useState(true);
  const [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [tabBusy, setTabBusy] = useState(false);
  const { copied, copy } = useCopy();

  const running = browse.status === "running";
  const paused = browse.status === "paused";
  const isReal = browse.engine === "real";
  // Both engines support pause: the Python backend calls agent.pause().
  const pausable = true;
  const done = browse.status === "done";
  const shotSrc = browse.screenshot ? `${browse.screenshot}${reload && browse.screenshot.includes("mshots") ? `&r=${reload}` : ""}` : null;
  const completedSteps = browse.steps.filter((s) => s.status === "done").length;
  const icon = favicon(browse.currentUrl);

  const artifact: Artifact = {
    kind: "markdown",
    title: browse.task.slice(0, 80),
    language: "markdown",
    filename: `${browse.task.slice(0, 40).replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "answer"}.md`,
    content: browse.answer,
    files: [],
    outline: [],
    updatedAt: Date.now(),
  };

  const exportAs = async (kind: "md" | "pdf" | "html") => {
    if (!browse.answer) return pushToast("There is no answer to export yet", "err");
    setTabBusy(true);
    try {
      if (kind === "md") downloadMarkdown(artifact);
      if (kind === "pdf") await downloadPdf(artifact);
      if (kind === "html") downloadHtml(artifact);
      pushToast(`Exported as ${kind.toUpperCase()}`, "ok");
    } catch (e) {
      pushToast(`Export failed: ${e instanceof Error ? e.message : "unknown error"}`, "err");
    } finally {
      setTabBusy(false);
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[rgb(var(--line))] bg-[var(--bg-elevated)] shadow-sm-soft", expanded && "fixed inset-2 z-[75] flex flex-col shadow-lg-soft sm:inset-6")}>
      {/* header */}
      {isReal && (browse.status === "running" || browse.status === "paused" || browse.status === "error") && (
        <div className="flex items-start gap-2 border-b border-[rgb(245_158_11/0.28)] bg-[rgb(245_158_11/0.07)] px-3 py-1.5">
          <span className="mt-[3px] text-[10px] leading-none">⚠️</span>
          <p className="text-[10.5px] leading-relaxed text-[#8a5a06] dark:text-[#fbbf24]">
            <b>Fully close Chrome before starting.</b> The agent controls your real Chrome profile — a profile-lock error means Chrome is still running.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[12.5px] font-medium text-pri">
                {browse.status === "running" ? (isReal ? "Driving your real Chrome" : "Browsing the web") : browse.status === "paused" ? "Browsing paused" : browse.status === "error" ? "Browsing failed" : browse.status === "stopped" ? "Browsing stopped" : isReal ? "Chrome run completed" : "Browsed the web"}
              </span>
              <Badge tone={running ? "accent" : done ? "green" : browse.status === "error" ? "red" : "neutral"}>{STATUS_LABEL[browse.status]}</Badge>
            </span>
            <span className="flex items-center gap-1.5 truncate text-[10.5px] text-ter">
              {isReal ? "Real Chrome · Browser Use" : "Live reader · real pages"}
              <span>·</span>
              {completedSteps}/{browse.steps.length} steps
              <span>·</span>
              {browse.sources.length} pages
            </span>
          </span>
          <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-ter transition-transform", open && "rotate-180")} />
        </button>
        <div className="flex items-center gap-1">
          {running && (
            <>
              {pausable && <Button size="sm" variant="secondary" icon={<Pause className="h-3 w-3" />} onClick={pauseBrowse}>Pause</Button>}
              <Button size="sm" variant="danger" icon={<Square className="h-3 w-3 fill-current" />} onClick={stopBrowse}>Stop</Button>
            </>
          )}
          {paused && <Button size="sm" variant="primary" icon={<Play className="h-3 w-3" />} onClick={resumeBrowse}>Resume</Button>}
          {!running && !paused && (
            <Button size="sm" variant="secondary" icon={<RotateCw className="h-3 w-3" />} onClick={() => startBrowseTask(browse.task)}>
              Re-run
            </Button>
          )}
          <IconButton label={expanded ? "Exit fullscreen" : "Expand live view"} size={28} onClick={() => setExpanded((e) => !e)}>
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </IconButton>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 34 }} className="overflow-hidden">
            <div className={cn("grid gap-0 border-t border-[rgb(var(--line))]", expanded ? "min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-[minmax(0,1fr)_300px]")}>
              {/* live viewport */}
              <div className={cn("flex min-h-0 flex-col border-[rgb(var(--line))] lg:border-r", expanded && "flex-1")}>
                <div className="flex items-center gap-2 border-b border-[rgb(var(--line))] bg-[rgb(var(--text)/0.02)] px-2.5 py-1.5">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[rgb(var(--line))] bg-[var(--bg-elevated)] px-2 py-[3px]">
                    <Lock className="h-2.5 w-2.5 shrink-0 text-[#10b981]" />
                    {icon && <img src={icon} alt="" className="h-3 w-3 rounded-sm" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                    <span className="truncate font-mono text-[10.5px] text-sec">{hostOf(browse.currentUrl)}</span>
                    {(running || paused) && <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />}
                  </div>
                  {!isReal && (
                    <IconButton label="Reload screenshot" size={22} onClick={() => setReload((r) => r + 1)} disabled={!browse.currentUrl}>
                      <RotateCw className="h-3 w-3" />
                    </IconButton>
                  )}
                  <a href={browse.currentUrl ?? "#"} target="_blank" rel="noreferrer" aria-label="Open page in a new tab" className={cn("grid h-[22px] w-[22px] place-items-center rounded-md text-ter hover:text-pri", !browse.currentUrl && "pointer-events-none opacity-40")}>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className={cn("relative bg-[rgb(var(--text)/0.03)]", expanded ? "min-h-[300px] flex-1" : "h-[220px] sm:h-[260px]")}>
                  <AnimatePresence mode="wait">
                    {shotSrc ? (
                      <motion.img
                        key={shotSrc}
                        src={shotSrc}
                        alt={`Live screenshot of ${browse.currentTitle ?? "the page"}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 h-full w-full object-cover object-top"
                        onLoad={() => setTabBusy(false)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                        {browse.screenshotLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                            <p className="text-[11.5px] font-medium text-sec">Capturing live screenshot…</p>
                            <div className="w-full max-w-[220px] space-y-1.5">
                              <div className="shimmer h-2.5 rounded" />
                              <div className="shimmer h-2.5 w-4/5 rounded" />
                            </div>
                          </>
                        ) : (
                          <>
                            <Search className="h-5 w-5 text-ter" />
                            <p className="text-[11.5px] text-ter">The live viewport appears when the agent opens a page.</p>
                          </>
                        )}
                      </div>
                    )}
                  </AnimatePresence>
                  {(running || paused) && shotSrc && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-transparent">
                      <motion.div className="h-full w-1/3 bg-[var(--accent)]" animate={{ x: ["-100%", "320%"] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
                    </div>
                  )}
                  {browse.currentTitle && (
                    <div className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-1.5 pt-6 text-[10.5px] font-medium text-white">
                      {browse.currentTitle}
                    </div>
                  )}
                </div>

                {browse.sources.length > 0 && (
                  <div className="thin-scroll flex gap-1.5 overflow-x-auto border-t border-[rgb(var(--line))] px-2 py-1.5">
                    {browse.sources.map((s, i) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="group flex shrink-0 items-center gap-1.5 rounded-md border border-[rgb(var(--line))] px-1.5 py-1 text-[10.5px] text-ter hover:text-pri">
                        <span className="grid h-3.5 w-3.5 place-items-center rounded-sm bg-[var(--accent-soft)] text-[9px] font-semibold text-[var(--accent)]">{i + 1}</span>
                        <span className="max-w-[130px] truncate">{s.title || hostOf(s.url)}</span>
                        <ArrowUpRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* plan / sources / logs */}
              <div className="flex min-h-[220px] flex-col">
                <div className="flex items-center gap-1 border-b border-[rgb(var(--line))] px-2 py-1.5">
                  {(["plan", "timeline", "sources", "logs"] as const).filter((t) => t !== "timeline" || isReal || browse.timeline.length > 0).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={cn("rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors", tab === t ? "bg-[rgb(var(--text)/0.06)] text-pri" : "text-ter hover:text-sec")}
                    >
                      {t}{t === "sources" && browse.sources.length > 0 ? ` ${browse.sources.length}` : ""}
                    </button>
                  ))}
                  <span className="ml-auto pr-1 text-[10px] text-ter">
                    {browse.status === "done" ? "done" : browse.status}
                  </span>
                </div>

                <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-2">
                  {tab === "plan" && (
                    <ol className="space-y-0.5">
                      {browse.steps.map((step) => (
                        <li key={step.id} className="flex items-center gap-2 rounded-md px-1.5 py-1">
                          {step.status === "done" ? (
                            <Check className="h-3 w-3 text-[#10b981]" />
                          ) : step.status === "active" ? (
                            <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />
                          ) : (
                            <CircleDashed className="h-3 w-3 text-ter" />
                          )}
                          <span className={cn("text-[11.5px]", step.status === "pending" ? "text-ter" : "text-pri")}>{step.label}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {tab === "timeline" && (
                    <div className="space-y-1">
                      {browse.timeline.length === 0 && (
                        <p className="px-1 py-3 text-[11px] leading-relaxed text-ter">
                          Thoughts, actions and URLs appear here after each Browser Use step.
                        </p>
                      )}
                      {browse.timeline.map((entry) => (
                        <div key={entry.id} className="rounded-md border border-[rgb(var(--line))] p-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("rounded px-1 py-[1px] text-[8.5px] font-semibold tracking-wide uppercase", entry.kind === "thought" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : entry.kind === "action" ? "bg-[rgb(16_185_129/0.12)] text-[#0f9f6e] dark:text-[#4ade9f]" : "bg-[rgb(var(--text)/0.06)] text-ter")}>
                              {entry.kind}
                            </span>
                            <span className="ml-auto font-mono text-[9px] text-ter">
                              {new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                            </span>
                          </div>
                          {entry.kind === "url" ? (
                            <a href={entry.url ?? entry.text} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-[10px] text-[var(--accent)] hover:underline">{entry.text}</a>
                          ) : (
                            <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[10.5px] leading-relaxed text-sec">{entry.text}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "sources" && (
                    <div className="space-y-1.5">
                      {browse.sources.length === 0 && <p className="px-1 py-3 text-[11px] text-ter">No pages read yet.</p>}
                      {browse.sources.map((s, i) => (
                        <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block rounded-md border border-[rgb(var(--line))] p-2 hover:bg-[rgb(var(--text)/0.03)]">
                          <div className="flex items-center gap-1.5">
                            <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-[var(--accent-soft)] text-[9px] font-semibold text-[var(--accent)]">{i + 1}</span>
                            <span className="truncate text-[11.5px] font-medium text-pri">{s.title}</span>
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[9.5px] text-ter">{hostOf(s.url)}</div>
                          <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-ter">{s.excerpt.replace(/\s+/g, " ").slice(0, 140)}</p>
                        </a>
                      ))}
                    </div>
                  )}

                  {tab === "logs" && (
                    <div className="space-y-1 font-mono">
                      {browse.logs.map((l) => (
                        <div key={l.id} className="flex gap-1.5 text-[10px] leading-relaxed">
                          <span className="shrink-0 text-ter">{new Date(l.ts).toLocaleTimeString([], { hour12: false })}</span>
                          <span className={cn(l.tone === "success" ? "text-[#0f9f6e] dark:text-[#4ade9f]" : l.tone === "error" ? "text-[#d13a3f] dark:text-[#ff8a8e]" : l.tone === "warn" ? "text-[#a16207] dark:text-[#fbbf24]" : l.tone === "network" ? "text-[var(--accent)]" : "text-sec")}>
                            {l.text}
                          </span>
                        </div>
                      ))}
                      {running && <div className="flex items-center gap-1.5 pl-0 pt-1 text-[10px] text-ter"><Loader2 className="h-2.5 w-2.5 animate-spin" /> live</div>}
                    </div>
                  )}
                </div>

                {browse.answer && (
                  <div className="flex flex-wrap items-center gap-1 border-t border-[rgb(var(--line))] px-1.5 py-1">
                    <button onClick={() => copy(browse.answer)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] text-ter hover:text-pri">
                      {copied ? <Check className="h-2.5 w-2.5" /> : <Download className="h-2.5 w-2.5" />} {copied ? "Copied" : "Copy"}
                    </button>
                    <button onClick={() => exportAs("md")} disabled={tabBusy} className="rounded px-1.5 py-0.5 text-[10.5px] text-ter hover:text-pri">.md</button>
                    <button onClick={() => exportAs("pdf")} disabled={tabBusy} className="rounded px-1.5 py-0.5 text-[10.5px] text-ter hover:text-pri">.pdf</button>
                    <button onClick={() => exportAs("html")} disabled={tabBusy} className="rounded px-1.5 py-0.5 text-[10.5px] text-ter hover:text-pri">.html</button>
                    <span className="ml-auto pr-1 text-[9.5px] text-ter">{isReal ? "real chrome" : "reader"}</span>
                  </div>
                )}
              </div>
            </div>

            {browse.error && (
              <div className="border-t border-[rgb(229_72_77/0.26)] bg-[rgb(229_72_77/0.06)] px-3 py-2 text-[11.5px] leading-relaxed text-[#b3353a] dark:text-[#ff9a9d]">
                <b>Agent error:</b> {browse.error}
                {browse.hint && <span className="mt-0.5 block text-[10.5px] opacity-90">{browse.hint}</span>}
              </div>
            )}

            {!running && !browse.error && browse.engineNote && browse.sources.length === 0 && (
              <div className="border-t border-[rgb(var(--line))] px-3 py-2 text-[10.5px] leading-relaxed text-ter">{browse.engineNote}</div>
            )}

            {running && (
              <div className="flex items-center gap-2 border-t border-[rgb(var(--line))] px-3 py-1.5">
                <Terminal className="h-3 w-3 text-ter" />
                <span className="truncate text-[10.5px] text-ter">
                  {browse.logs[browse.logs.length - 1]?.text ?? "Starting the browser…"}
                </span>
                <span className="ml-auto flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="h-1 w-1 rounded-full bg-[var(--accent)]" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {expanded && (
        <button onClick={() => setExpanded(false)} className="absolute right-3 top-2.5 grid h-7 w-7 place-items-center rounded-md text-ter hover:text-pri" aria-label="Close expanded view">
          <X className="h-4 w-4" />
        </button>
      )}
      {user?.plan === "free" && browse.sources.length > 0 && browse.status === "running" && (
        <div className="border-t border-[rgb(var(--line))] px-3 py-1 text-[10px] text-ter">Free plan · {browse.sources.length}/{browse.steps.length} pages read</div>
      )}
    </div>
  );
}
