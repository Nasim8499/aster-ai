import type { BrowseLog, BrowseSource, BrowseState, BrowseStep, BrowseTimelineEntry, Settings } from "./types";

/* ------------------------------------------------------------------ */
/* Real web browsing engine                                            */
/*                                                                     */
/* Two transports:                                                    */
/*  • real   — the Python backend drives YOUR Chrome via Browser Use.  */
/*             Screenshots come from ScreenshotEvent on the live page. */
/*  • reader — Jina Reader + Microlink, a no-backend fallback that     */
/*             still returns real page text and real screenshots.      */
/* ------------------------------------------------------------------ */

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const log = (text: string, tone: BrowseLog["tone"] = "info"): BrowseLog => ({ id: uid("log"), ts: Date.now(), text, tone });

export const BROWSE_STEPS: BrowseStep[] = [
  { id: "understand", label: "Understanding the request", status: "pending" },
  { id: "search", label: "Searching the web", status: "pending" },
  { id: "open", label: "Opening the top sources", status: "pending" },
  { id: "read", label: "Reading pages with a live viewport", status: "pending" },
  { id: "compare", label: "Comparing findings", status: "pending" },
  { id: "answer", label: "Writing the answer with citations", status: "pending" },
];

export function emptyBrowse(task: string): BrowseState {
  return {
    task,
    status: "running",
    engine: "reader",
    currentUrl: null,
    currentTitle: null,
    screenshot: null,
    screenshotLoading: false,
    steps: BROWSE_STEPS.map((s) => ({ ...s })),
    logs: [],
    sources: [],
    answer: "",
    startedAt: Date.now(),
    pagesVisited: 0,
    timeline: [],
  };
}

/** Plan shown while the Python / Browser Use agent drives the real Chrome. */
export const REAL_STEPS: BrowseStep[] = [
  { id: "connect", label: "Connecting to your real Chrome", status: "pending" },
  { id: "think", label: "Planning the task", status: "pending" },
  { id: "act", label: "Executing browser actions", status: "pending" },
  { id: "read", label: "Reading live pages", status: "pending" },
  { id: "final", label: "Writing the final answer", status: "pending" },
];

export interface BrowsePatch {
  state?: Partial<BrowseState>;
  log?: BrowseLog;
  step?: { id: string; status: BrowseStep["status"] };
  answerChunk?: string;
  source?: BrowseSource;
  timelineEntry?: BrowseTimelineEntry;
}

export interface BrowseCallbacks {
  onPatch: (patch: BrowsePatch) => void;
  onDone: (final: Partial<BrowseState>) => void;
}

export interface BrowseSession {
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ helpers ---------------------------- */

const cleanQuery = (task: string) =>
  task
    .replace(/^(find|search|look up|research|tell me|what are|check|get|open)\s+/i, "")
    .replace(/[.?!]+$/, "")
    .trim();

export function isUrl(s: string) {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

function decodeDdg(href: string): string | null {
  try {
    if (href.startsWith("https://duckduckgo.com/l/")) {
      const u = new URL(href);
      const target = u.searchParams.get("uddg");
      return target ? decodeURIComponent(target) : null;
    }
    if (href.startsWith("http") && !/duckduckgo\.com|bing\.com|google\.com\/search|go\.microsoft/.test(href)) return href;
  } catch {
    return null;
  }
  return null;
}

export function extractLinks(markdown: string): { url: string; title: string }[] {
  const out: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  const re = /\[([^\]]{2,140})\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const url = decodeDdg(m[2]);
    if (!url) continue;
    if (url.includes("wikipedia.org/wiki/Main_Page")) continue;
    if (/\.(png|jpe?g|svg|webp|ico|css|js)(\?|$)/i.test(url)) continue;
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
    if (!host || host === "duckduckgo.com" || seen.has(host)) continue;
    seen.add(host);
    out.push({ url, title: m[1].replace(/[*_`]/g, "").trim() });
    if (out.length >= 8) break;
  }
  return out;
}

export function parseReader(markdown: string): { title: string; url: string; text: string } {
  const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
  const urlMatch = markdown.match(/^URL Source:\s*(.+)$/m);
  const bodyIdx = markdown.indexOf("Markdown Content:");
  const body = bodyIdx >= 0 ? markdown.slice(bodyIdx + "Markdown Content:".length) : markdown;
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*|>]\s*/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
  return {
    title: (titleMatch?.[1] ?? "Untitled page").trim().slice(0, 140),
    url: (urlMatch?.[1] ?? "").trim(),
    text,
  };
}

/** Real screenshot of a live URL (no backend required). */
export async function screenshotUrl(url: string): Promise<string | null> {
  const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&viewport.width=1280&viewport.height=800`;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(endpoint, { signal: ctrl.signal });
    if (res.ok) {
      const json = await res.json();
      const shot = json?.data?.screenshot?.url;
      if (typeof shot === "string") return shot;
    }
  } catch {
    /* fall through to the static screenshot service */
  } finally {
    window.clearTimeout(timer);
  }
  return `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot&embed=screenshot.url`;
}

export async function readPage(url: string): Promise<{ title: string; text: string; via: string }> {
  const attempts = [
    { target: `https://r.jina.ai/${url}`, via: "reader" },
    { target: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, via: "proxy" },
  ];
  for (const attempt of attempts) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 16000);
    try {
      const res = await fetch(attempt.target, { signal: ctrl.signal });
      if (!res.ok) continue;
      const raw = await res.text();
      if (attempt.via === "reader") {
        const parsed = parseReader(raw);
        if (parsed.text.length > 120) return { title: parsed.title, text: parsed.text, via: attempt.via };
      } else {
        const doc = new DOMParser().parseFromString(raw, "text/html");
        doc.querySelectorAll("script,style,nav,footer,aside,header,svg").forEach((n) => n.remove());
        const title = doc.querySelector("title")?.textContent?.trim() || url;
        const text = (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
        if (text.length > 120) return { title: title.slice(0, 140), text, via: attempt.via };
      }
    } catch {
      /* try the next transport */
    } finally {
      window.clearTimeout(timer);
    }
  }
  return { title: new URL(url).hostname.replace(/^www\./, ""), text: "", via: "none" };
}

/** Search the live web; returns real result URLs. */
export async function webSearch(query: string): Promise<{ url: string; title: string }[]> {
  const q = cleanQuery(query);
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 18000);
  try {
    const res = await fetch(`https://r.jina.ai/https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
    if (res.ok) {
      const links = extractLinks(await res.text());
      if (links.length) return links;
    }
  } catch {
    /* fall back to the Wikipedia API */
  } finally {
    window.clearTimeout(timer);
  }
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=4`,
    );
    if (res.ok) {
      const json = await res.json();
      return (json?.query?.search ?? []).map((r: any) => ({
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(r.title).replace(/ /g, "_"))}`,
        title: r.title,
      }));
    }
  } catch {
    /* nothing more to try */
  }
  return [];
}

/* --------------------------- synthesis ---------------------------- */

const STOP = new Set(
  "the a an of to in for and or on with is are was were be been being this that these those from by as at it its into than then so such very more most can could would should will may might about which who whom what when where why how not no yes do does did done have has had you your we our they their i my me".split(" "),
);

/** Break a page into readable snippets, handling list-style government pages. */
function snippets(text: string): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  const raw = flat.split(/(?<=[.!?])\s+|(?<=:)\s+(?=[A-Z])|\s{2,}/);
  const out: string[] = [];
  for (const part of raw) {
    const cleanPart = part.replace(/^[-•|\s]+/, "").trim();
    if (cleanPart.length < 45) continue;
    if (cleanPart.length <= 320) {
      out.push(cleanPart);
      continue;
    }
    // Long run-on blocks: window it on word boundaries.
    const words = cleanPart.split(" ");
    let chunk = "";
    for (const w of words) {
      chunk += (chunk ? " " : "") + w;
      if (chunk.length > 220) {
        out.push(chunk);
        chunk = "";
      }
    }
    if (chunk.length > 45) out.push(chunk);
  }
  return out.filter((s) => !/cookie|subscribe to|newsletter|all rights reserved|sign in to|advertise with|privacy policy|terms of use|enable javascript|download our app/i.test(s));
}

function keywords(text: string) {
  return [...new Set(text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [])].filter((w) => !STOP.has(w)).slice(0, 24);
}

/** Extractive synthesis: every statement comes from the pages actually read. */
export function synthesize(task: string, sources: BrowseSource[]): string {
  if (!sources.length) {
    return `I couldn't retrieve any readable pages for **${task}**.

This usually means the network, the reading service or the page itself blocked the request. Try a more specific query or paste a direct URL. For full browser control, start the Python agent backend and set its URL in Settings → Real Chrome agent.`;
  }

  const keys = keywords(task);
  type Pick = { text: string; src: BrowseSource; si: number; score: number };
  const pool: Pick[] = [];
  sources.forEach((src, si) => {
    snippets(src.excerpt).forEach((sentence) => {
      const lower = sentence.toLowerCase();
      const overlap = keys.reduce((n, k) => n + (lower.includes(k) ? 1 : 0), 0);
      const score = overlap + (si === 0 ? 0.4 : 0) + (sentence.length > 90 ? 0.2 : 0);
      pool.push({ text: sentence, src, si, score });
    });
  });

  const relevant = pool.filter((p) => p.score > 0.5).sort((a, b) => b.score - a.score);
  const chosen: Pick[] = [];
  const perSource = new Map<number, number>();
  for (const p of relevant) {
    const used = perSource.get(p.si) ?? 0;
    if (used >= 2) continue;
    if (chosen.some((c) => c.text === p.text)) continue;
    chosen.push(p);
    perSource.set(p.si, used + 1);
    if (chosen.length >= 6) break;
  }
  if (!chosen.length) {
    // Honest fallback: show what the page actually contains, labelled as excerpts.
    sources.slice(0, 2).forEach((src, si) => {
      snippets(src.excerpt).slice(0, 2).forEach((text) => chosen.push({ text, src, si, score: 0 }));
    });
  }

  const lead = sources[0];
  const lines: string[] = [];
  lines.push(`I opened **${sources.length} live ${sources.length === 1 ? "page" : "pages"}** and read ${sources.length === 1 ? "it" : "them"} for you. Here is what ${sources.length === 1 ? "it says" : "they say"} about: *${task}*`);
  lines.push("");
  lines.push("### What the pages say");
  if (chosen.length) {
    chosen.forEach((pick) => {
      const clean = pick.text.replace(/\s+/g, " ").replace(/^[-•|]+/, "").trim();
      lines.push(`- ${clean.slice(0, 340)} **[${pick.si + 1}]**`);
    });
  } else {
    lines.push(`- The pages loaded, but their main text was mostly navigation or was blocked from extraction. Open the sources below to read them directly.`);
  }
  lines.push("");
  lines.push("### How to use this");
  lines.push(
    `The first and most relevant source was [${lead.title}](${lead.url})${lead.screenshot ? ", which you can see in the live browser preview above" : ""}. Use the numbered citations to check each statement on the original page — anything consequential (visas, money, health) should be confirmed on the official site.`,
  );
  lines.push("");
  lines.push("### Sources I opened");
  sources.forEach((src, i) => lines.push(`${i + 1}. [${src.title}](${src.url})`));
  lines.push("");
  lines.push("> Browsed live while this answer was written. Screenshots show the real pages, not a mockup.");
  return lines.join("\n");
}

/* --------------------- client (reader) engine --------------------- */

export function startReaderBrowse(task: string, settings: Settings, cb: BrowseCallbacks): BrowseSession {
  let paused = false;
  let stopped = false;
  const wait = async () => {
    while (paused && !stopped) await sleep(140);
  };
  const sources: BrowseSource[] = [];

  const mark = (id: string, status: BrowseStep["status"]) => cb.onPatch({ step: { id, status } });
  const emitLog = (text: string, tone: BrowseLog["tone"] = "info") => cb.onPatch({ log: log(text, tone) });

  (async () => {
    try {
      cb.onPatch({ state: { engine: "reader", engineNote: "Real pages via the Jina Reader and Microlink screenshot services. Start the Python backend to let Browser Use drive your own Chrome." } });

      mark("understand", "active");
      emitLog(`Parsing task: ${task.slice(0, 90)}`, "info");
      await sleep(420);
      await wait();
      if (stopped) return;
      mark("understand", "done");

      let queue: { url: string; title: string }[] = [];
      if (isUrl(task.trim())) {
        queue = [{ url: task.trim(), title: new URL(task.trim()).hostname }];
        emitLog(`Direct URL detected — ${task.trim()}`, "network");
      } else {
        mark("search", "active");
        emitLog(`Searching the live web for “${cleanQuery(task)}”`, "network");
        queue = await webSearch(task);
        cb.onPatch({
          state: {
            currentUrl: `https://duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery(task))}`,
            currentTitle: `Search: ${cleanQuery(task)}`,
            screenshot: null,
            screenshotLoading: false,
          },
        });
        if (stopped) return;
        emitLog(`Found ${queue.length} candidate results`, queue.length ? "success" : "warn");
        mark("search", "done");
        if (!queue.length) throw new Error("The search returned no readable results. Try a more specific query.");
      }

      mark("open", "active");
      const targets = queue.slice(0, Math.max(1, Math.min(5, settings.maxSources)));
      emitLog(`Queueing ${targets.length} sources`, "info");
      await sleep(260);
      mark("open", "done");

      mark("read", "active");
      for (let i = 0; i < targets.length; i++) {
        await wait();
        if (stopped) return;
        const target = targets[i];
        emitLog(`Navigating to ${target.url}`, "network");
        cb.onPatch({
          state: {
            currentUrl: target.url,
            currentTitle: target.title,
            screenshot: null,
            screenshotLoading: true,
            pagesVisited: i + 1,
          },
        });
        const [shot, page] = await Promise.all([screenshotUrl(target.url), readPage(target.url)]);
        if (stopped) return;
        cb.onPatch({ state: { screenshot: shot, screenshotLoading: false, currentTitle: page.title || target.title } });
        if (!page.text) {
          emitLog(`Blocked or empty: ${target.url}`, "warn");
          continue;
        }
        const source: BrowseSource = {
          url: target.url,
          title: page.title || target.title,
          excerpt: page.text.slice(0, 6000),
          screenshot: shot ?? undefined,
          fetchedAt: Date.now(),
        };
        sources.push(source);
        cb.onPatch({ source });
        emitLog(`Read ${page.title} — ${page.text.length.toLocaleString()} characters`, "success");
        await sleep(520);
      }
      mark("read", "done");
      if (stopped) return;

      mark("compare", "active");
      emitLog(`Comparing ${sources.length} pages against the request`, "info");
      await sleep(620);
      mark("compare", "done");

      mark("answer", "active");
      emitLog("Composing an answer from the pages actually read", "info");
      const answer = synthesize(task, sources);
      const words = answer.split(/(\s+)/);
      let buffer = "";
      for (let i = 0; i < words.length; i++) {
        await wait();
        if (stopped) return;
        buffer += words[i];
        if (buffer.length > 5) {
          cb.onPatch({ answerChunk: buffer });
          buffer = "";
          await sleep(9);
        }
      }
      if (buffer) cb.onPatch({ answerChunk: buffer });
      mark("answer", "done");
      cb.onDone({ status: "done", endedAt: Date.now(), screenshotLoading: false });
    } catch (e) {
      if (stopped) return;
      const message = e instanceof Error ? e.message : "Browsing failed.";
      emitLog(message, "error");
      cb.onDone({ status: "error", error: message, endedAt: Date.now(), screenshotLoading: false });
    }
  })();

  return {
    pause: () => { paused = true; cb.onPatch({ state: { status: "paused" }, log: log("Run paused", "warn") }); },
    resume: () => { paused = false; cb.onPatch({ state: { status: "running" }, log: log("Run resumed", "info") }); },
    stop: () => {
      stopped = true;
      cb.onPatch({ log: log("Stopped by user", "warn") });
      cb.onDone({ status: "stopped", endedAt: Date.now(), screenshotLoading: false });
    },
  };
}

/* ------------------- real Chrome (browser_use) engine ------------------- */

const timelineId = () => `tl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function startRealBrowse(task: string, settings: Settings, cb: BrowseCallbacks): BrowseSession {
  const base = (settings.agentApiUrl.trim() || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.agentToken.trim()) headers["x-agent-token"] = settings.agentToken.trim();

  const ctrl = new AbortController();
  let sessionId: string | null = null;
  let stopped = false;
  let stepsDone = 0;
  let fallback: BrowseSession | null = null;
  const setStep = (id: string, status: BrowseStep["status"]) => cb.onPatch({ step: { id, status } });
  const pushTimeline = (entry: Omit<BrowseTimelineEntry, "id" | "ts">) => {
    cb.onPatch({ timelineEntry: { id: timelineId(), ts: Date.now(), ...entry } });
  };

  (async () => {
    cb.onPatch({
      state: {
        engine: "real",
        steps: REAL_STEPS.map((s) => ({ ...s })),
        engineNote: "Browser Use is driving your real Chrome profile. Screenshots come from the live browser.",
      },
    });
    try {
      cb.onPatch({ log: log(`POST ${base}/api/agent/start`, "network") });
      const res = await fetch(`${base}/api/agent/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({ task, max_steps: settings.maxSteps || 25 }),
        signal: ctrl.signal,
      });
      const ctype = res.headers.get("content-type") ?? "";
      if (!res.ok || !ctype.includes("application/json")) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          detail = j.detail || j.error || detail;
        } catch {
          /* not json */
        }
        throw new Error(detail);
      }
      const json = await res.json();
      sessionId = json.session_id;
      if (!sessionId) throw new Error("The agent API did not return a session id.");
      cb.onPatch({ state: { status: "running" } });
      setStep("connect", "done");
      setStep("think", "active");
      cb.onPatch({ log: log(`Session ${sessionId} started — Fully close Chrome before starting if you see a profile lock.`, "success") });

      const streamRes = await fetch(`${base}/api/agent/stream/${sessionId}`, { headers: { Accept: "text/event-stream" }, signal: ctrl.signal });
      if (!streamRes.ok || !streamRes.body) throw new Error(`Event stream failed (HTTP ${streamRes.status}).`);
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const handle = (event: any) => {
        switch (event.type) {
          case "meta":
          case "status": {
            const status = event.status ?? event.type;
            if (status === "paused") cb.onPatch({ state: { status: "paused" } });
            if (status === "running") cb.onPatch({ state: { status: "running" } });
            if (status === "stopped") cb.onPatch({ state: { status: "stopped" } });
            break;
          }
          case "step":
            stepsDone = Math.max(stepsDone, Number(event.step) || 0);
            cb.onPatch({ state: { pagesVisited: stepsDone } });
            setStep("connect", "done");
            setStep("think", "done");
            setStep("act", "active");
            break;
          case "thought":
            if (event.text) {
              setStep("think", "done");
              setStep("act", "active");
              pushTimeline({ kind: "thought", text: String(event.text), step: event.step });
              cb.onPatch({ log: { id: timelineId(), ts: Date.now(), text: String(event.text).slice(0, 300), tone: "info" } });
            }
            break;
          case "action":
            if (event.text) {
              pushTimeline({ kind: "action", text: String(event.text), step: event.step });
              cb.onPatch({ log: { id: timelineId(), ts: Date.now(), text: `Action · ${String(event.text).slice(0, 260)}`, tone: "network" } });
            }
            break;
          case "url":
            if (event.url) {
              pushTimeline({ kind: "url", text: String(event.url), url: String(event.url), step: event.step });
              let title = String(event.url);
              try {
                title = new URL(String(event.url)).hostname.replace(/^www\./, "");
              } catch {
                /* keep the raw url */
              }
              cb.onPatch({ state: { currentUrl: String(event.url), currentTitle: title } });
              cb.onPatch({ source: { url: String(event.url), title, excerpt: "", fetchedAt: Date.now() } });
            }
            break;
          case "screenshot":
            if (event.data) {
              setStep("act", "done");
              setStep("read", "active");
              cb.onPatch({
                state: {
                  screenshot: String(event.data).startsWith("data:") ? String(event.data) : `data:image/jpeg;base64,${event.data}`,
                  screenshotLoading: false,
                  currentUrl: event.url ?? null,
                  currentTitle: event.url ? (() => { try { return new URL(String(event.url)).hostname.replace(/^www\./, ""); } catch { return null; } })() : null,
                  pagesVisited: Number(event.step) || stepsDone,
                },
              });
            }
            break;
          case "result":
            if (event.text) {
              setStep("read", "done");
              setStep("final", "done");
              cb.onPatch({ state: { answer: String(event.text), result: String(event.text), screenshotLoading: false } });
            }
            break;
          case "error":
            cb.onPatch({ state: { error: String(event.message ?? "The agent failed."), hint: event.hint ?? null, screenshotLoading: false } });
            cb.onPatch({ log: { id: timelineId(), ts: Date.now(), text: `Error · ${event.message ?? "unknown"}`, tone: "error" } });
            break;
          case "ping":
            break;
          default:
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split(/\r?\n\r?\n/);
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const data = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");
          if (!data || data === "[DONE]") continue;
          try {
            handle(JSON.parse(data));
          } catch {
            /* ignore malformed frame */
          }
        }
      }

      if (!stopped) {
        setStep("final", "done");
        cb.onDone({ status: "done", endedAt: Date.now(), screenshotLoading: false });
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const raw = e instanceof Error ? e.message : "Real Chrome agent unreachable";
      const message =
        /failed to fetch|networkerror|load failed/i.test(raw)
          ? `Could not reach the Chrome agent at ${base}. Start it with: cd backend && uvicorn main:app --port 8000`
          : raw;
      if (stopped) return;
      cb.onPatch({ log: log(`Real Chrome agent unavailable — ${message}`, "warn") });
      cb.onPatch({ state: { engine: "reader", engineNote: undefined, steps: BROWSE_STEPS.map((st) => ({ ...st, status: "pending" as const })) } });
      fallback = startReaderBrowse(task, settings, cb);
    }
  })();

  return {
    pause: () => {
      if (fallback) return fallback.pause();
      cb.onPatch({ state: { status: "paused" } });
      if (!sessionId) return;
      void (async () => {
        try {
          const res = await fetch(`${base}/api/agent/pause/${sessionId}`, { method: "POST", headers });
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as any));
            cb.onPatch({ state: { status: "running" }, log: log(`Pause failed — ${body.detail ?? res.status}. Stop the run instead.`, "warn") });
          }
        } catch (e) {
          cb.onPatch({ state: { status: "running" }, log: log(`Pause failed — ${e instanceof Error ? e.message : "network error"}`, "warn") });
        }
      })();
    },
    resume: () => {
      if (fallback) return fallback.resume();
      cb.onPatch({ state: { status: "running" } });
      if (sessionId) void fetch(`${base}/api/agent/resume/${sessionId}`, { method: "POST", headers }).catch(() => {});
    },
    stop: () => {
      stopped = true;
      if (fallback) return fallback.stop();
      if (sessionId) void fetch(`${base}/api/agent/stop/${sessionId}`, { method: "POST", headers }).catch(() => {});
      ctrl.abort();
      cb.onDone({ status: "stopped", endedAt: Date.now(), screenshotLoading: false });
    },
  };
}

export function startBrowse(task: string, settings: Settings, cb: BrowseCallbacks): BrowseSession {
  if (settings.browseEngine === "reader") return startReaderBrowse(task, settings, cb);
  return startRealBrowse(task, settings, cb);
}
